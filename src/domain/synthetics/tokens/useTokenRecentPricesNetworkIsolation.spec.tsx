import { act, cleanup, render } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";

import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";
import { PRICES_UPDATE_INTERVAL } from "lib/timeConstants";
import { getWrappedToken } from "sdk/configs/tokens";

import { useTokenRecentPricesRequest } from "./useTokenRecentPricesData";

const source = vi.hoisted(() => ({ networkId: -501, read: vi.fn() }));
vi.mock("lib/chains", () => ({ useChainId: () => ({ networkId: source.networkId }) }));
vi.mock("lib/oracleKeeperFetcher/useOracleKeeperFetcher", () => ({
  useOracleKeeperFetcher: () => ({ url: "https://keeper.test", fetchTickers: source.read }),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  source.read.mockReset();
});

it("hides EVM prices and timestamps on Solana while retaining the original EVM cache", async () => {
  vi.useFakeTimers();
  const token = getWrappedToken(ARBITRUM);
  let finish!: (value: { tokenAddress: string; minPrice: string; maxPrice: string }[]) => void;
  source.read
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValue([{ tokenAddress: token.address, minPrice: "100", maxPrice: "110" }]);
  const config = { provider: () => new Map(), keepPreviousData: true };
  const wrapper = ({ children }: PropsWithChildren) => (
    <MemoryRouter>
      <SWRConfig value={config}>{children}</SWRConfig>
    </MemoryRouter>
  );
  const result = { current: undefined as ReturnType<typeof useTokenRecentPricesRequest> | undefined };
  function Probe() {
    result.current = useTokenRecentPricesRequest(ARBITRUM);
    return null;
  }
  const view = render(<Probe />, { wrapper });
  expect(result.current).toEqual({
    pricesData: undefined,
    updatedAt: undefined,
    error: undefined,
    isPriceDataLoading: false,
  });
  await act(() => vi.advanceTimersByTimeAsync(PRICES_UPDATE_INTERVAL * 2));
  expect(source.read).not.toHaveBeenCalled();
  source.networkId = ARBITRUM;
  await act(async () => {
    view.rerender(<Probe />);
  });
  expect(result.current!.isPriceDataLoading).toBe(true);
  source.networkId = SOLANA_NETWORK_ID;
  view.rerender(<Probe />);
  await act(async () => {
    finish([{ tokenAddress: token.address, minPrice: "100", maxPrice: "110" }]);
  });
  expect(result.current!.pricesData).toBeUndefined();
  expect(result.current!.updatedAt).toBeUndefined();
  const reads = source.read.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(PRICES_UPDATE_INTERVAL * 2));
  expect(source.read).toHaveBeenCalledTimes(reads);
  source.networkId = ARBITRUM;
  await act(async () => {
    view.rerender(<Probe />);
  });
  await act(() => vi.advanceTimersByTimeAsync(PRICES_UPDATE_INTERVAL));
  expect(result.current!.pricesData?.[token.address]?.minPrice).toBe(100n * 10n ** 18n);
  expect(result.current!.isPriceDataLoading).toBe(false);
  source.networkId = SOLANA_NETWORK_ID;
  view.rerender(<Probe />);
  expect(result.current!.pricesData).toBeUndefined();
  expect(result.current!.updatedAt).toBeUndefined();
});
