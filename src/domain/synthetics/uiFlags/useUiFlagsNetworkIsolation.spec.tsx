import { act, cleanup, render } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { SWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";

import { SWRConfigProp } from "App/swrConfig";
import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

import { persistApiFlags, readPersistedUiFlags, UiFlags, useUiFlagsRequest } from "./useUiFlagsRequest";

const source = vi.hoisted(() => ({ networkId: 42161, read: vi.fn(), get: vi.fn() }));
vi.mock("lib/chains", () => ({ useChainId: () => ({ chainId: 42161, networkId: source.networkId }) }));
vi.mock("lib/oracleKeeperFetcher", () => ({
  getOracleKeeperFetcher: (...args: unknown[]) => {
    source.get(...args);
    return { fetchUiFlags: source.read };
  },
}));
const flags = (enabled: boolean): UiFlags => ({ apiMarkets: { enabled, createdAt: "", updatedAt: "" } });
function setup() {
  const config = { ...SWRConfigProp, provider: () => new Map(), keepPreviousData: true, shouldRetryOnError: false };
  const wrapper = ({ children }: PropsWithChildren) => <SWRConfig value={config}>{children}</SWRConfig>;
  const result = { current: undefined as UiFlags | undefined };
  function Probe() {
    result.current = useUiFlagsRequest().uiFlags;
    return null;
  }
  const view = render(<Probe />, { wrapper });
  return { result, rerender: () => view.rerender(<Probe />), unmount: view.unmount };
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  source.networkId = ARBITRUM;
  source.read.mockReset();
  source.get.mockReset();
});

it.each(["resolve", "reject"])("isolates persisted, cached and late EVM flags on Solana (%s)", async (outcome) => {
  vi.useFakeTimers();
  persistApiFlags(ARBITRUM, flags(true));
  source.networkId = SOLANA_NETWORK_ID;
  let finish!: (value: UiFlags) => void;
  let fail!: (error: Error) => void;
  source.read
    .mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          finish = resolve;
          fail = reject;
        })
    )
    .mockResolvedValue(flags(false));
  const view = setup();
  expect(view.result.current).toBeUndefined();
  await act(() => vi.advanceTimersByTimeAsync(CONFIG_UPDATE_INTERVAL * 2));
  expect(source.get).not.toHaveBeenCalled();
  expect(readPersistedUiFlags(ARBITRUM)).toEqual(flags(true));
  source.networkId = ARBITRUM;
  await act(async () => {
    view.rerender();
  });
  expect(view.result.current).toEqual(flags(true));
  await act(() => vi.advanceTimersByTimeAsync(20));
  expect(source.read).toHaveBeenCalledTimes(1);
  source.networkId = SOLANA_NETWORK_ID;
  view.rerender();
  await act(async () => {
    if (outcome === "resolve") finish(flags(false));
    else fail(new Error("Keeper unavailable"));
  });
  expect(view.result.current).toBeUndefined();
  expect(readPersistedUiFlags(ARBITRUM)).toEqual(flags(outcome === "reject"));
  await act(() => vi.advanceTimersByTimeAsync(CONFIG_UPDATE_INTERVAL * 2));
  expect(source.read).toHaveBeenCalledTimes(1);
  source.networkId = ARBITRUM;
  await act(async () => {
    view.rerender();
  });
  await act(() => vi.advanceTimersByTimeAsync(CONFIG_UPDATE_INTERVAL * 2));
  expect(view.result.current).toEqual(flags(false));
  source.networkId = SOLANA_NETWORK_ID;
  view.rerender();
  expect(view.result.current).toBeUndefined();
  view.unmount();
});
