import { act, cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig, useSWRConfig } from "swr";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { getIsSolanaNetworkEnabled, setAbFlagEnabled } from "config/ab";
import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";
import type { Token } from "sdk/utils/tokens/types";

import { useSolanaWalletAssets } from "./useSolanaWalletAssets";

const source = vi.hoisted(() => ({ networkId: -501 as number, balances: vi.fn(), prices: vi.fn(), evm: vi.fn() }));
vi.mock("lib/chains", () => ({ useChainId: () => ({ networkId: source.networkId }) }));
vi.mock("lib/solana/balances", () => ({ fetchSolanaBalances: source.balances }));
vi.mock("domain/gmsol/gmsolOracleFetcher", () => ({ fetchGmsolTokenPrices: source.prices }));
vi.mock("lib/oracleKeeperFetcher/useOracleKeeperFetcher", () => ({
  useOracleKeeperFetcher: () => ({ url: "https://keeper.test", fetchTickers: source.evm }),
}));
let sol: Token;
let usdc: Token;
beforeAll(async () => {
  const config = await import("config/gmsol/tokens");
  sol = config.GMSOL_NATIVE_TOKEN;
  usdc = config.GMSOL_TOKENS.find((token) => token.symbol === "USDC")!;
});
const flagBefore = getIsSolanaNetworkEnabled();
afterEach(() => {
  cleanup();
  setAbFlagEnabled("solanaNetwork", flagBefore);
  vi.resetAllMocks();
});
function setup() {
  let result!: ReturnType<typeof useSolanaWalletAssets>;
  let refresh!: () => Promise<unknown>;
  function Probe({ owner }: { owner?: string }) {
    result = useSolanaWalletAssets(owner);
    const { mutate } = useSWRConfig();
    refresh = () => mutate(() => true);
    return null;
  }
  const cache = new Map();
  const config = { provider: () => cache, keepPreviousData: true, shouldRetryOnError: false, dedupingInterval: 0 };
  const tree = (owner?: string) => (
    <MemoryRouter>
      <SWRConfig value={config}>
        <Probe owner={owner} />
      </SWRConfig>
    </MemoryRouter>
  );
  const view = render(tree("alice"));
  return { result: () => result, refresh: () => refresh(), rerender: (owner?: string) => view.rerender(tree(owner)) };
}

it("values raw balances exactly, preserves zero and missing prices, and rejects partial totals and stale failures", async () => {
  source.networkId = SOLANA_NETWORK_ID;
  setAbFlagEnabled("solanaNetwork", true);
  const raw = 9_007_199_254_740_993n;
  source.balances.mockResolvedValue({ [sol.address]: raw, [usdc.address]: 0n });
  source.prices.mockResolvedValue({ [sol.address]: { minPrice: 100n * 10n ** 30n, maxPrice: 100n * 10n ** 30n } });
  const hook = setup();
  await waitFor(() => expect(hook.result().walletUsd).toBe(raw * 10n ** 23n));
  expect(hook.result().assets.find((token) => token.address === usdc.address)?.balanceUsd).toBe(0n);
  source.balances.mockResolvedValue({ [sol.address]: raw, [usdc.address]: 1n });
  await act(async () => {
    await hook.refresh();
  });
  expect(hook.result().assets.find((token) => token.address === usdc.address)?.balance).toBe(1n);
  expect(hook.result().walletUsd).toBeUndefined();
  source.prices.mockRejectedValue(new Error("Keeper unavailable"));
  await act(async () => {
    await hook.refresh();
  });
  expect(hook.result().walletUsd).toBeUndefined();
  expect(hook.result().assets[0].balance).toBe(raw);
  source.balances.mockRejectedValue(new Error("RPC unavailable"));
  await act(async () => {
    await hook.refresh();
  });
  expect(hook.result().assets).toEqual([]);
  expect(hook.result().error?.message).toBe("RPC unavailable");
  expect(hook.result().isLoading).toBe(false);
  expect(source.evm).not.toHaveBeenCalled();
});

it("uses only the explicit owner and discards late account data, disabled output and EVM requests", async () => {
  source.networkId = SOLANA_NETWORK_ID;
  setAbFlagEnabled("solanaNetwork", true);
  let finish!: (data: Record<string, bigint>) => void;
  source.balances
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValue({ [sol.address]: 0n });
  source.prices.mockResolvedValue({});
  const hook = setup();
  await waitFor(() => expect(source.balances).toHaveBeenCalledWith("alice"));
  hook.rerender("bob");
  await waitFor(() => expect(hook.result().walletUsd).toBe(0n));
  await act(async () => {
    finish({ [sol.address]: 99n });
  });
  expect(hook.result().assets[0].balance).toBe(0n);
  for (const [networkId, owner, enabled] of [
    [ARBITRUM, "bob", true],
    [SOLANA_NETWORK_ID, undefined, true],
    [SOLANA_NETWORK_ID, "bob", false],
  ] as const) {
    source.networkId = networkId;
    setAbFlagEnabled("solanaNetwork", enabled);
    hook.rerender(owner);
    expect(hook.result().assets).toEqual([]);
    expect(hook.result().walletUsd).toBeUndefined();
  }
  expect(source.balances).toHaveBeenCalledTimes(2);
  expect(source.evm).not.toHaveBeenCalled();
});
