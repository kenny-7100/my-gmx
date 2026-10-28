import { act, cleanup, render } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { SWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";

import {
  ARBITRUM,
  AVALANCHE,
  SOLANA_NETWORK_ID,
  SOURCE_BASE_MAINNET,
  type SourceChainId,
  type SettlementChainId,
} from "config/chains";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

import { useEmptyGmxAccounts } from "../useEmptyGmxAccounts";
import { useIsGmxAccount } from "../useIsGmxAccount";

const source = vi.hoisted(() => ({
  networkId: 42161,
  account: "0x0000000000000000000000000000000000000001",
  read: vi.fn(),
}));
vi.mock("lib/chains", () => ({ useChainId: () => ({ chainId: 42161, networkId: source.networkId }) }));
vi.mock("wagmi", () => ({ useAccount: () => ({ address: source.account }) }));
vi.mock("lib/multicall", () => ({ executeMulticall: (...args: unknown[]) => source.read(...args) }));

const balances = (amount: bigint) => ({
  data: { DataStore: { "0x0000000000000000000000000000000000000002": { returnValues: [amount] } } },
});
const swrConfig = { provider: () => new Map() };
function wrapper({ children }: PropsWithChildren) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
function mountRead(chainIds: SettlementChainId[] = [AVALANCHE]) {
  const result = { current: undefined as ReturnType<typeof useEmptyGmxAccounts> | undefined };
  function Probe() {
    result.current = useEmptyGmxAccounts(chainIds);
    return null;
  }
  const view = render(<Probe />, { wrapper });
  return { result, rerender: () => view.rerender(<Probe />), unmount: view.unmount };
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  source.networkId = ARBITRUM;
  source.read.mockReset();
});

it("keeps EVM account selection writable while Solana cannot restore or overwrite it", () => {
  let stored = true;
  const save = (value: boolean) => {
    stored = value;
  };
  const result = { current: undefined as ReturnType<typeof useIsGmxAccount> | undefined };
  function Probe({ srcChainId }: { srcChainId?: SourceChainId }) {
    result.current = useIsGmxAccount({
      chainId: ARBITRUM,
      srcChainId,
      storedIsGmxAccount: stored,
      setStoredIsGmxAccount: save,
    });
    return null;
  }
  const mounted = render(<Probe />);
  const view = {
    result,
    rerender: ({ srcChainId }: { srcChainId?: SourceChainId }) => mounted.rerender(<Probe srcChainId={srcChainId} />),
  };
  for (const srcChainId of [undefined, SOURCE_BASE_MAINNET] as const) {
    view.rerender({ srcChainId });
    expect(view.result.current![0]).toBe(true);
    if (srcChainId !== undefined) {
      act(() => view.result.current![1](false));
      expect(stored).toBe(true);
    }
    source.networkId = SOLANA_NETWORK_ID;
    view.rerender({ srcChainId });
    expect(view.result.current![0]).toBe(false);
    act(() => view.result.current![1](false));
    expect(stored).toBe(true);
    source.networkId = ARBITRUM;
    view.rerender({ srcChainId });
    expect(view.result.current![0]).toBe(true);
  }
  view.rerender({ srcChainId: undefined });
  act(() => view.result.current![1](false));
  view.rerender({ srcChainId: undefined });
  expect(view.result.current![0]).toBe(false);
});

it.each(["resolve", "reject"])(
  "stops empty-account polling and ignores late %s after switching back",
  async (outcome) => {
    vi.useFakeTimers();
    source.networkId = SOLANA_NETWORK_ID;
    let finishOld!: (value: ReturnType<typeof balances>) => void;
    let failOld!: (error: Error) => void;
    source.read
      .mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finishOld = resolve;
            failOld = reject;
          })
      )
      .mockResolvedValue(balances(0n));
    const view = mountRead();
    expect(view.result.current).toEqual({ emptyGmxAccounts: undefined, isLoading: false, error: undefined });
    await act(() => vi.advanceTimersByTimeAsync(CONFIG_UPDATE_INTERVAL));
    expect(source.read).not.toHaveBeenCalled();
    source.networkId = ARBITRUM;
    view.rerender();
    expect(view.result.current!.emptyGmxAccounts).toBeUndefined();
    source.networkId = SOLANA_NETWORK_ID;
    view.rerender();
    await act(() => vi.advanceTimersByTimeAsync(CONFIG_UPDATE_INTERVAL));
    expect(source.read).toHaveBeenCalledTimes(1);
    source.networkId = ARBITRUM;
    await act(async () => {
      view.rerender();
    });
    expect(view.result.current!.emptyGmxAccounts?.[AVALANCHE]).toBe(true);
    await act(async () => {
      if (outcome === "resolve") finishOld(balances(10n));
      else failOld(new Error("Late RPC failure"));
    });
    expect(view.result.current!.emptyGmxAccounts?.[AVALANCHE]).toBe(true);
    expect(view.result.current!.isLoading).toBe(false);
    expect(view.result.current!.error).toBeUndefined();
    source.read.mockResolvedValue(balances(10n));
    await act(() => vi.advanceTimersByTimeAsync(CONFIG_UPDATE_INTERVAL));
    expect(view.result.current!.emptyGmxAccounts?.[AVALANCHE]).toBe(false);
    view.unmount();
    const count = source.read.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(CONFIG_UPDATE_INTERVAL * 2));
    expect(source.read).toHaveBeenCalledTimes(count);
  }
);

it("keeps a failed chain unavailable even when another chain completes later", async () => {
  const error = new Error("RPC unavailable");
  let finish!: (value: ReturnType<typeof balances>) => void;
  source.read.mockRejectedValueOnce(error).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const view = mountRead([ARBITRUM, AVALANCHE]);
  await act(async () => {
    finish(balances(0n));
  });
  expect(view.result.current!.error).toBe(error);
  expect(view.result.current!.isLoading).toBe(false);
  expect(view.result.current!.emptyGmxAccounts?.[ARBITRUM]).toBeUndefined();
  expect(view.result.current!.emptyGmxAccounts?.[AVALANCHE]).toBe(true);
  source.networkId = SOLANA_NETWORK_ID;
  view.rerender();
  expect(view.result.current).toEqual({ emptyGmxAccounts: undefined, isLoading: false, error: undefined });
});
