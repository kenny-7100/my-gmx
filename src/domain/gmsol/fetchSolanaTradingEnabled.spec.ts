import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ARBITRUM } from "config/chains";
import { getOracleKeeperUrl } from "sdk/configs/oracleKeeper";

import { fetchSolanaTradingEnabled } from "./fetchSolanaTradingEnabled";

beforeEach(() => vi.stubEnv("VITE_APP_SOLANA_TRADING_OVERRIDE", undefined));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("allows explicit overrides only in local development and rejects invalid development values", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  for (const dev of [true, false]) {
    vi.stubEnv("DEV", dev);
    for (const override of [undefined, "", "true", "false", "TRUE", "1"]) {
      vi.stubEnv("VITE_APP_SOLANA_TRADING_OVERRIDE", override);
      for (const remoteEnabled of [true, false]) {
        fetchMock
          .mockReset()
          .mockImplementation(async () => Response.json({ solanaTrading: { enabled: remoteEnabled } }));
        if (dev && override !== undefined && !["", "true", "false"].includes(override)) {
          await expect(fetchSolanaTradingEnabled()).rejects.toThrow("VITE_APP_SOLANA_TRADING_OVERRIDE");
          expect(fetchMock).not.toHaveBeenCalled();
        } else {
          const overridden = dev && (override === "true" || override === "false");
          await expect(fetchSolanaTradingEnabled()).resolves.toBe(overridden ? override === "true" : remoteEnabled);
          expect(fetchMock).toHaveBeenCalledTimes(overridden ? 0 : 1);
        }
      }
    }
  }
});

it("requires fresh explicit permission from the Arbitrum keeper on every read", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  for (const enabled of [true, false, undefined, "true", 1, null]) {
    fetchMock.mockClear().mockResolvedValueOnce(Response.json({ solanaTrading: { enabled } }));
    await expect(fetchSolanaTradingEnabled()).resolves.toBe(enabled === true);
    expect(fetchMock).toHaveBeenCalledWith(`${getOracleKeeperUrl(ARBITRUM)}/ui-flags/v2`, {
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
  }
  fetchMock.mockResolvedValueOnce(Response.json({}));
  await expect(fetchSolanaTradingEnabled()).resolves.toBe(false);
});

it("propagates failures instead of reusing an earlier permission", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ solanaTrading: { enabled: true } }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(fetchSolanaTradingEnabled()).resolves.toBe(true);
  for (const response of [
    new Response("", { status: 503 }),
    new Response("invalid JSON"),
    Response.json(null),
    Response.json([]),
  ]) {
    fetchMock.mockResolvedValueOnce(response);
    await expect(fetchSolanaTradingEnabled()).rejects.toThrow();
  }
  for (const error of [new TypeError("Network error"), new DOMException("Timed out", "TimeoutError")]) {
    fetchMock.mockRejectedValueOnce(error);
    await expect(fetchSolanaTradingEnabled()).rejects.toBe(error);
  }
});
