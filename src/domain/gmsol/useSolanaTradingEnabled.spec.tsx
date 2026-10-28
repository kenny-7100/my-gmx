import { act, cleanup, render, waitFor } from "@testing-library/react";
import { SWRConfig, useSWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";

import { getIsSolanaNetworkEnabled, setAbFlagEnabled } from "config/ab";
import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";
import { useUiFlagEvents } from "domain/synthetics/uiFlags/useUiFlagEvents";

import { useSolanaTradingEnabled } from "./useSolanaTradingEnabled";

const source = vi.hoisted(() => ({ networkId: -501 as number, evm: vi.fn() }));
vi.mock("lib/chains", () => ({ useChainId: () => ({ chainId: 42161, networkId: source.networkId }) }));
vi.mock("lib/oracleKeeperFetcher", () => ({ getOracleKeeperFetcher: () => ({ fetchUiFlags: source.evm }) }));
const flagBefore = getIsSolanaNetworkEnabled();
const remoteFlags = (enabled: unknown) => ({
  solanaTrading: { enabled },
  showSolanaServiceDisruptionBanner: { enabled: true },
  showServiceDisruptionBanner: { enabled: true },
});
const config = { provider: () => new Map(), keepPreviousData: true, shouldRetryOnError: false, dedupingInterval: 0 };
let result: ReturnType<typeof useSolanaTradingEnabled>;
let events: ReturnType<typeof useUiFlagEvents>;
let refresh: () => Promise<unknown>;
function Probe({ enabled = true }: { enabled?: boolean }) {
  const { mutate } = useSWRConfig();
  refresh = () => mutate(() => true);
  result = useSolanaTradingEnabled({ enabled });
  events = useUiFlagEvents();
  return null;
}
function setup() {
  return render(
    <SWRConfig value={config}>
      <Probe />
    </SWRConfig>
  );
}
afterEach(() => {
  cleanup();
  setAbFlagEnabled("solanaNetwork", flagBefore);
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  source.evm.mockReset();
  source.networkId = SOLANA_NETWORK_ID;
});

it("shares one flags request, filters banners, preserves dismissals and closes trading on errors", async () => {
  setAbFlagEnabled("solanaNetwork", true);
  vi.stubEnv("VITE_APP_SOLANA_TRADING_OVERRIDE", undefined);
  const read = vi.fn().mockImplementation(async () => Response.json(remoteFlags(true)));
  vi.stubGlobal("fetch", read);
  source.evm.mockResolvedValue(remoteFlags(true));
  const view = setup();
  expect(result.isSolanaTradingEnabled).toBe(false);
  await waitFor(() => expect(result.isSolanaTradingEnabled).toBe(true));
  expect(read).toHaveBeenCalledTimes(1);
  expect(events.map((e) => e.data.id)).toEqual(["solana-service-disruption"]);
  await act(async () => {
    events[0].dismiss();
  });
  expect(events).toEqual([]);
  for (const enabled of [false, undefined, "true", null]) {
    read.mockImplementationOnce(async () => Response.json(remoteFlags(enabled)));
    await act(async () => {
      await refresh();
    });
    expect(result.isSolanaTradingEnabled).toBe(false);
  }
  read.mockResolvedValueOnce(Response.json(remoteFlags(true)));
  await act(async () => {
    await refresh();
  });
  expect(result.isSolanaTradingEnabled).toBe(true);
  const failure = new DOMException("Timed out", "TimeoutError");
  read.mockRejectedValueOnce(failure);
  await act(async () => {
    await refresh();
  });
  expect(result.isSolanaTradingEnabled).toBe(false);
  expect(result.error).toBe(failure);
  expect(result.isLoading).toBe(false);
  vi.stubEnv("DEV", true);
  for (const [override, allowed] of [
    ["true", true],
    ["false", false],
    ["invalid", false],
  ] as const) {
    vi.stubEnv("VITE_APP_SOLANA_TRADING_OVERRIDE", override);
    await act(async () => {
      view.rerender(
        <SWRConfig value={config}>
          <Probe />
        </SWRConfig>
      );
    });
    expect(result.isSolanaTradingEnabled).toBe(allowed);
    if (override === "invalid") expect(result.error?.message).toContain("VITE_APP_SOLANA_TRADING_OVERRIDE");
    else expect(result.error).toBeUndefined();
  }
  vi.stubEnv("VITE_APP_SOLANA_TRADING_OVERRIDE", undefined);
  source.networkId = ARBITRUM;
  await act(async () => {
    view.rerender(
      <SWRConfig value={config}>
        <Probe />
      </SWRConfig>
    );
  });
  await waitFor(() => expect(events.map((e) => e.data.id)).toEqual(["service-disruption"]));
  expect(result.isSolanaTradingEnabled).toBe(false);
  expect(result.error).toBeUndefined();
  expect(source.evm).toHaveBeenCalledTimes(1);
});

it("does not read on EVM or flag-off and hides a late Solana response after switching", async () => {
  setAbFlagEnabled("solanaNetwork", false);
  const read = vi.fn();
  vi.stubGlobal("fetch", read);
  source.evm.mockResolvedValue({});
  const view = setup();
  await act(() => vi.dynamicImportSettled());
  expect(read).not.toHaveBeenCalled();
  setAbFlagEnabled("solanaNetwork", true);
  source.networkId = ARBITRUM;
  await act(async () => {
    view.rerender(
      <SWRConfig value={config}>
        <Probe />
      </SWRConfig>
    );
  });
  expect(read).not.toHaveBeenCalled();
  let finish!: (response: Response) => void;
  read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  source.networkId = SOLANA_NETWORK_ID;
  await act(async () => {
    view.rerender(
      <SWRConfig value={config}>
        <Probe />
      </SWRConfig>
    );
  });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  source.networkId = ARBITRUM;
  await act(async () => {
    view.rerender(
      <SWRConfig value={config}>
        <Probe />
      </SWRConfig>
    );
    finish(Response.json(remoteFlags(true)));
  });
  expect(events).toEqual([]);
  expect(result.isSolanaTradingEnabled).toBe(false);
  expect(result.isLoading).toBe(false);
});
