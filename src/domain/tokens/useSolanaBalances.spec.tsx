import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { SWRConfig, useSWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SWRConfigProp } from "App/swrConfig";
import { getIsSolanaNetworkEnabled, setAbFlagEnabled } from "config/ab";
import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";
import { FREQUENT_UPDATE_INTERVAL } from "lib/timeConstants";

import { getSolanaBalancesKey, useSolanaBalances } from "./useSolanaBalances";

const source = vi.hoisted(() => ({ networkId: -501 as number, loads: 0, read: vi.fn() }));
vi.mock("lib/chains", () => ({ useChainId: () => ({ networkId: source.networkId }) }));
vi.mock("lib/solana/balances", () => {
  source.loads++;
  return { fetchSolanaBalances: source.read };
});
const alice = "11111111111111111111111111111111";
const bob = "So11111111111111111111111111111111111111112";
const flagBefore = getIsSolanaNetworkEnabled();
function setup(owner: string | undefined) {
  const cache = new Map();
  const config = {
    ...SWRConfigProp,
    provider: () => cache,
    dedupingInterval: 0,
    shouldRetryOnError: false,
    keepPreviousData: true,
  };
  const wrapper = ({ children }: PropsWithChildren) => <SWRConfig value={config}>{children}</SWRConfig>;
  const result = {
    current: undefined as unknown as {
      balance: ReturnType<typeof useSolanaBalances>;
      mutate: ReturnType<typeof useSWRConfig>["mutate"];
    },
  };
  function Probe({ owner }: { owner: string | undefined }) {
    result.current = { balance: { ...useSolanaBalances(owner) }, mutate: useSWRConfig().mutate };
    return null;
  }
  const view = render(<Probe owner={owner} />, { wrapper });
  return {
    result,
    unmount: view.unmount,
    rerender: ({ owner }: { owner: string | undefined }) => view.rerender(<Probe owner={owner} />),
  };
}
beforeEach(() => {
  source.networkId = SOLANA_NETWORK_ID;
  source.read.mockReset().mockResolvedValue({ SOL: 0n });
  setAbFlagEnabled("solanaNetwork", true);
});
afterEach(() => {
  cleanup();
  setAbFlagEnabled("solanaNetwork", flagBefore);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Solana balances in shared SWR", () => {
  it("does not load the reader on EVM, with no owner or with the flag off", async () => {
    for (const [networkId, owner, enabled] of [
      [ARBITRUM, alice, true],
      [SOLANA_NETWORK_ID, undefined, true],
      [SOLANA_NETWORK_ID, alice, false],
    ] as const) {
      source.networkId = networkId;
      setAbFlagEnabled("solanaNetwork", enabled);
      const hook = setup(owner);
      await act(async () => {
        await vi.dynamicImportSettled();
      });
      expect(hook.result.current.balance.data).toBeUndefined();
      expect(hook.result.current.balance.error).toBeUndefined();
      expect(hook.result.current.balance.isLoading).toBe(false);
      hook.unmount();
    }
    expect(source.loads).toBe(0);
    expect(source.read).not.toHaveBeenCalled();
  });
  it("isolates cached and delayed results across owners, networks and disabled keys", async () => {
    let finish!: (value: Record<string, bigint>) => void;
    source.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result, rerender } = setup(alice);
    await waitFor(() => expect(source.read).toHaveBeenCalledWith(alice));
    expect(result.current.balance.isLoading).toBe(true);
    rerender({ owner: bob });
    await waitFor(() => expect(result.current.balance.data).toEqual({ SOL: 0n }));
    await act(async () => finish({ SOL: 9n }));
    expect(result.current.balance.data).toEqual({ SOL: 0n });
    source.networkId = ARBITRUM;
    rerender({ owner: bob });
    expect(result.current.balance.data).toBeUndefined();
    source.networkId = SOLANA_NETWORK_ID;
    rerender({ owner: undefined });
    expect(result.current.balance.data).toBeUndefined();
    rerender({ owner: bob });
    await waitFor(() => expect(result.current.balance.data).toEqual({ SOL: 0n }));
    setAbFlagEnabled("solanaNetwork", false);
    rerender({ owner: bob });
    expect(result.current.balance.data).toBeUndefined();
  });
  it("keeps errors distinct from zero and invalidates only the exposed owner/network key", async () => {
    const failure = new Error("RPC unavailable");
    source.read.mockRejectedValueOnce(failure);
    const { result } = setup(alice);
    await waitFor(() => expect(result.current.balance.error).toBe(failure));
    expect(result.current.balance.data).toBeUndefined();
    expect(result.current.balance.isLoading).toBe(false);
    await act(async () => {
      await result.current.mutate(getSolanaBalancesKey(SOLANA_NETWORK_ID, bob));
    });
    expect(result.current.balance.error).toBe(failure);
    await act(async () => {
      await result.current.mutate(getSolanaBalancesKey(SOLANA_NETWORK_ID, alice));
    });
    expect(result.current.balance.data).toEqual({ SOL: 0n });
    expect(result.current.balance.error).toBeUndefined();
    source.read.mockRejectedValueOnce(failure);
    await act(async () => {
      await result.current.mutate(getSolanaBalancesKey(SOLANA_NETWORK_ID, alice));
    });
    expect(result.current.balance.error).toBe(failure);
    expect(result.current.balance.data).toEqual({ SOL: 0n });
  });
  it("inherits the five second cadence and skips polling while hidden", async () => {
    vi.useFakeTimers();
    const { result } = setup(alice);
    await act(async () => {
      await vi.dynamicImportSettled();
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(result.current.balance.data).toEqual({ SOL: 0n });
    source.read.mockResolvedValue({ SOL: 1n });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FREQUENT_UPDATE_INTERVAL);
    });
    expect(result.current.balance.data).toEqual({ SOL: 1n });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    source.read.mockResolvedValue({ SOL: 2n });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FREQUENT_UPDATE_INTERVAL * 2);
    });
    expect(result.current.balance.data).toEqual({ SOL: 1n });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FREQUENT_UPDATE_INTERVAL);
    });
    expect(result.current.balance.data).toEqual({ SOL: 2n });
  });
});
