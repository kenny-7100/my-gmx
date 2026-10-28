import { act, cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig, useSWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";

import { getIsSolanaNetworkEnabled, setAbFlagEnabled } from "config/ab";
import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";

import { useTokenRecentPricesRequest } from "./useTokenRecentPricesData";

const source = vi.hoisted(() => ({ networkId: -501 as number, loads: 0, read: vi.fn(), evmRead: vi.fn() }));
vi.mock("lib/chains", () => ({ useChainId: () => ({ networkId: source.networkId }) }));
vi.mock("lib/oracleKeeperFetcher/useOracleKeeperFetcher", () => ({
  useOracleKeeperFetcher: () => ({ url: "https://keeper.test", fetchTickers: source.evmRead }),
}));
vi.mock("domain/gmsol/gmsolOracleFetcher", () => {
  source.loads++;
  return { fetchGmsolTokenPrices: source.read };
});
const flagBefore = getIsSolanaNetworkEnabled();
const config = { provider: () => new Map(), keepPreviousData: true, shouldRetryOnError: false, dedupingInterval: 0 };
afterEach(() => {
  cleanup();
  setAbFlagEnabled("solanaNetwork", flagBefore);
  vi.clearAllMocks();
});

it("loads only for an explicit selected Solana source and isolates errors and delayed data", async () => {
  let result: ReturnType<typeof useTokenRecentPricesRequest>;
  let refresh!: () => Promise<unknown>;
  function Probe({ enabled = true }: { enabled?: boolean }) {
    const { mutate } = useSWRConfig();
    refresh = () => mutate(() => true);
    result = useTokenRecentPricesRequest(SOLANA_NETWORK_ID, { enabled });
    return null;
  }
  setAbFlagEnabled("solanaNetwork", false);
  const view = render(
    <MemoryRouter>
      <SWRConfig value={config}>
        <Probe />
      </SWRConfig>
    </MemoryRouter>
  );
  const rerender = async (enabled = true) => {
    await act(async () => {
      view.rerender(
        <MemoryRouter>
          <SWRConfig value={config}>
            <Probe enabled={enabled} />
          </SWRConfig>
        </MemoryRouter>
      );
    });
  };
  await act(() => vi.dynamicImportSettled());
  expect(source.loads).toBe(0);
  setAbFlagEnabled("solanaNetwork", true);
  source.networkId = ARBITRUM;
  await rerender();
  source.networkId = SOLANA_NETWORK_ID;
  await rerender(false);
  expect(source.loads).toBe(0);

  let finish!: (prices: Record<string, { minPrice: bigint; maxPrice: bigint }>) => void;
  source.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await rerender();
  await waitFor(() => expect(source.read).toHaveBeenCalledTimes(1));
  source.networkId = ARBITRUM;
  await rerender();
  await act(async () => {
    finish({ SoL: { minPrice: 0n, maxPrice: 0n } });
  });
  expect(result!.pricesData).toBeUndefined();
  expect(result!.updatedAt).toBeUndefined();
  source.networkId = SOLANA_NETWORK_ID;
  const error = new Error("Keeper unavailable");
  source.read.mockRejectedValueOnce(error);
  await rerender();
  expect(result!.pricesData?.SoL.minPrice).toBe(0n);
  await act(async () => {
    await refresh();
  });
  await waitFor(() => expect(result!.error).toBe(error));
  expect(result!.isPriceDataLoading).toBe(false);
  await rerender(false);
  expect(result!.pricesData).toBeUndefined();
  expect(result!.error).toBeUndefined();
  expect(source.evmRead).not.toHaveBeenCalled();
});
