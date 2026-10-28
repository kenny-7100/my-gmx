// @vitest-environment node
import { address, getAddressDecoder, getBase64Decoder } from "@solana/kit";
import { AccountState, getTokenEncoder } from "@solana-program/token-2022";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SOLANA_TOKEN_2022_PROGRAM_ID, SOLANA_TOKEN_PROGRAM_ID } from "config/gmsol/program";
import { GMSOL_NATIVE_TOKEN } from "config/gmsol/tokens";
import { getSolanaRpcUrl } from "config/rpc";

import { fetchSolanaBalances } from "./balances";
vi.hoisted(() => {
  vi.stubGlobal("self", { location: { host: "localhost" } });
  vi.stubGlobal("localStorage", { getItem: () => null });
});
const owner = address("11111111111111111111111111111111");
const mint = address("So11111111111111111111111111111111111111112");
const tokens = [{ address: mint, tokenProgram: SOLANA_TOKEN_PROGRAM_ID }];
const huge = 9007199254740993n;
const encode = (overrides = {}) =>
  getBase64Decoder().decode(
    getTokenEncoder().encode({
      mint,
      owner,
      amount: huge,
      delegate: null,
      state: AccountState.Initialized,
      isNative: null,
      delegatedAmount: 0n,
      closeAuthority: null,
      extensions: null,
      ...overrides,
    })
  );
const account = (overrides = {}) => ({
  data: [encode(), "base64"],
  executable: false,
  lamports: huge,
  owner: SOLANA_TOKEN_PROGRAM_ID,
  space: 165,
  ...overrides,
});
function respond(values: (addresses: string[]) => unknown[], failAt = -1) {
  const requests: string[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      expect(String(url)).toBe(getSolanaRpcUrl());
      const body = JSON.parse(init.body);
      requests.push(body.params[0]);
      if (requests.length === failAt) throw new Error("RPC unavailable");
      const json = JSON.stringify(
        { jsonrpc: "2.0", id: body.id, result: { context: { slot: 1 }, value: values(body.params[0]) } },
        (_, value) => (typeof value === "bigint" ? `bigint:${value}` : value)
      ).replace(/"bigint:(\d+)"/g, "$1");
      return new Response(json, { headers: { "content-type": "application/json" } });
    })
  );
  return requests;
}
afterEach(() => vi.unstubAllGlobals());
describe("raw Solana balances", () => {
  it.each([
    [SOLANA_TOKEN_PROGRAM_ID, "aqxoAhCwpy3oB1BpNw9hL1HdLYLgPpbPjzxDrrQj3Fs"],
    [SOLANA_TOKEN_2022_PROGRAM_ID, "2sZUUBGq1i6aE47ZoxCaCW89jmYm2EXLPPmNMgMDXHMS"],
  ])("preserves precision, zero and missing balances with %s", async (program, ata) => {
    const extensions = program === SOLANA_TOKEN_2022_PROGRAM_ID ? [{ __kind: "ImmutableOwner" }] : null;
    for (const amount of [huge, 0n, null]) {
      const value =
        amount === null
          ? null
          : account({
              owner: program,
              lamports: amount,
              data: [encode({ amount, extensions, state: AccountState.Frozen }), "base64"],
            });
      const requests = respond(() => [value, value]);
      expect(await fetchSolanaBalances(owner, { tokens: [{ address: mint, tokenProgram: program }] })).toEqual({
        [GMSOL_NATIVE_TOKEN.address]: amount ?? 0n,
        [mint]: amount ?? 0n,
      });
      expect(requests[0][1]).toBe(ata);
    }
  });
  it.each([99, 100, 200])("reads all %i mints in bounded batches", async (count) => {
    const batchTokens = Array.from({ length: count }, (_, i) => {
      const bytes = new Uint8Array(32);
      new DataView(bytes.buffer).setUint32(0, i + 1);
      return { address: getAddressDecoder().decode(bytes), tokenProgram: SOLANA_TOKEN_PROGRAM_ID };
    });
    const requests = respond((addresses) => addresses.map(() => null));
    const result = await fetchSolanaBalances(owner, { tokens: batchTokens });
    expect(Object.keys(result)).toHaveLength(count + 1);
    expect(Object.values(result).every((value) => value === 0n)).toBe(true);
    expect(requests.map((batch) => batch.length)).toEqual(
      Array.from({ length: Math.ceil((count + 1) / 100) }, (_, i) => Math.min(100, count + 1 - i * 100))
    );
    respond((addresses) => addresses.map(() => null), 2);
    if (count >= 100)
      await expect(fetchSolanaBalances(owner, { tokens: batchTokens })).rejects.toThrow("RPC unavailable");
  });
  it.each([
    { owner },
    { executable: true },
    { data: [encode({ owner: mint }), "base64"] },
    { data: [encode({ mint: owner }), "base64"] },
    { data: [encode({ state: AccountState.Uninitialized }), "base64"] },
    { data: ["AA==", "base64"] },
    { data: [encode() + "AA==", "base64"] },
  ])("rejects malformed or mismatched token accounts: %j", async (overrides) => {
    respond(() => [null, account(overrides)]);
    await expect(fetchSolanaBalances(owner, { tokens })).rejects.toThrow();
  });
  it("rejects incomplete responses and transport failures", async () => {
    respond(() => [null]);
    await expect(fetchSolanaBalances(owner, { tokens })).rejects.toThrow("Incomplete");
    respond(() => [], 1);
    await expect(fetchSolanaBalances(owner, { tokens })).rejects.toThrow("RPC unavailable");
  });
});
