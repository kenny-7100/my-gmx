import { act, cleanup, render, waitFor } from "@testing-library/react";
import { SWRConfig, useSWRConfig } from "swr";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { getIsSolanaNetworkEnabled, setAbFlagEnabled } from "config/ab";
import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";
import { OracleKeeperFetcher } from "lib/oracleKeeperFetcher";
import { getTokenBySymbol } from "sdk/configs/tokens";

import { use24hPriceDeltaRequest } from "./use24hPriceDeltaMap";

const source = vi.hoisted(() => ({ networkId: -501 as number, evmRead: vi.fn() }));
vi.mock("lib/chains", () => ({ useChainId: () => ({ networkId: source.networkId }) }));
vi.mock("lib/oracleKeeperFetcher/useOracleKeeperFetcher", () => ({
  useOracleKeeperFetcher: () => ({ url: "https://keeper.test", fetch24hPrices: source.evmRead }),
}));
const flagBefore = getIsSolanaNetworkEnabled();
let native: string;
let wrapped: string;
beforeAll(async () => {
  const { GMSOL_NATIVE_TOKEN, GMSOL_TOKENS } = await import("config/gmsol/tokens");
  native = GMSOL_NATIVE_TOKEN.address;
  wrapped = GMSOL_TOKENS.find((token) => token.symbol === "WSOL")!.address;
});
const arbSol = getTokenBySymbol(ARBITRUM, "SOL").address;
const candle = { tokenSymbol: "SOL", open: 100, close: 100, high: 110, low: 90 };
const config = { provider: () => new Map(), keepPreviousData: true, dedupingInterval: 0, shouldRetryOnError: false };
afterEach(() => {
  cleanup();
  setAbFlagEnabled("solanaNetwork", flagBefore);
  source.networkId = SOLANA_NETWORK_ID;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("isolates EVM and Solana 24h data, late reads, errors and real zero changes", async () => {
  const solanaRead = vi.spyOn(OracleKeeperFetcher.prototype, "fetch24hPrices").mockResolvedValue([candle]);
  let finish!: (value: (typeof candle)[]) => void;
  solanaRead.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  source.evmRead.mockResolvedValue([{ ...candle, close: 120 }]);
  let result!: ReturnType<typeof use24hPriceDeltaRequest>;
  let evm!: ReturnType<typeof use24hPriceDeltaRequest>;
  let refresh!: () => Promise<unknown>;
  function Probe() {
    const { mutate } = useSWRConfig();
    refresh = () => mutate(() => true);
    result = use24hPriceDeltaRequest(SOLANA_NETWORK_ID, [native, wrapped, wrapped.toLowerCase(), "unknown"]);
    evm = use24hPriceDeltaRequest(ARBITRUM, [arbSol]);
    return null;
  }
  setAbFlagEnabled("solanaNetwork", false);
  const view = render(
    <SWRConfig value={config}>
      <Probe />
    </SWRConfig>
  );
  const rerender = async () => {
    await act(async () => {
      view.rerender(
        <SWRConfig value={config}>
          <Probe />
        </SWRConfig>
      );
    });
  };
  expect(result.priceDeltaMap).toBeUndefined();
  expect(evm.priceDeltaMap).toBeUndefined();
  expect(solanaRead).not.toHaveBeenCalled();
  setAbFlagEnabled("solanaNetwork", true);
  source.networkId = ARBITRUM;
  await rerender();
  await waitFor(() => expect(evm.priceDeltaMap?.[arbSol]?.deltaPercentage).toBe(20));
  expect(solanaRead).not.toHaveBeenCalled();
  source.networkId = SOLANA_NETWORK_ID;
  await rerender();
  await waitFor(() => expect(solanaRead).toHaveBeenCalledTimes(1));
  expect(evm.priceDeltaMap).toBeUndefined();
  source.networkId = ARBITRUM;
  await rerender();
  await act(async () => {
    finish([candle]);
  });
  expect(result.priceDeltaMap).toBeUndefined();
  expect(result.error).toBeUndefined();
  source.networkId = SOLANA_NETWORK_ID;
  await rerender();
  await waitFor(() => expect(result.priceDeltaMap?.[wrapped]?.deltaPercentage).toBe(0));
  expect(result.priceDeltaMap?.[native]?.close).toBe(100);
  expect(result.priceDeltaMap?.[wrapped.toLowerCase()]).toBeUndefined();
  expect(result.priceDeltaMap?.unknown).toBeUndefined();
  const failure = new DOMException("Timed out", "TimeoutError");
  solanaRead.mockRejectedValueOnce(failure);
  await act(async () => {
    await refresh();
  });
  expect(result.error).toBe(failure);
  expect(result.isLoading).toBe(false);
  expect(result.priceDeltaMap).toBeUndefined();
  solanaRead.mockResolvedValueOnce([{ ...candle, close: 90 }]);
  await act(async () => {
    await refresh();
  });
  expect(result.error).toBeUndefined();
  expect(result.priceDeltaMap?.[wrapped]?.deltaPercentage).toBe(-10);
  setAbFlagEnabled("solanaNetwork", false);
  await rerender();
  expect(result.priceDeltaMap).toBeUndefined();
  expect(result.error).toBeUndefined();
});
