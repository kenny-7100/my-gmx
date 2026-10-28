import { useMemo } from "react";
import useSWR from "swr";

import { getIsSolanaNetworkEnabled } from "config/ab";
import { isSolanaNetwork } from "config/chains";
import { useTokenRecentPricesRequest } from "domain/synthetics/tokens/useTokenRecentPricesData";
import { useChainId } from "lib/chains";
import { convertToUsd, getMidPrice } from "sdk/utils/tokens";

import { loadNetworkTokenLookup } from "./loadNetworkTokenLookup";
import { useSolanaBalances } from "./useSolanaBalances";

/** Compose the existing readers for the shared wallet view; no separate wallet cache. */
export function useSolanaWalletAssets(owner: string | undefined) {
  const { networkId } = useChainId();
  const enabled = isSolanaNetwork(networkId) && getIsSolanaNetworkEnabled() && Boolean(owner);
  const balances = useSolanaBalances(owner);
  const prices = useTokenRecentPricesRequest(networkId, { enabled });
  const lookup = useSWR(enabled ? [networkId, "walletTokenLookup"] : null, ([id]) => loadNetworkTokenLookup(id), {
    refreshInterval: 0,
    keepPreviousData: false,
  });

  return useMemo(() => {
    const error = balances.error || lookup.error || prices.error;
    const currentBalances = enabled && !balances.error ? balances.data : undefined;
    const currentPrices = enabled && !prices.error ? prices.pricesData : undefined;
    const assets = Object.entries(currentBalances ?? {}).flatMap(([address, balance]) => {
      const token = lookup.data?.getToken(address);
      if (lookup.data && !token) throw new Error(`Unknown wallet token: ${address}`);
      if (!token) return [];
      const price = currentPrices?.[address];
      return [
        {
          ...token,
          balance,
          balanceUsd:
            balance === 0n ? 0n : price ? convertToUsd(balance, token.decimals, getMidPrice(price)) : undefined,
        },
      ];
    });
    // Never present a partial valuation as the wallet total.
    const complete = currentBalances && lookup.data && assets.length === Object.keys(currentBalances).length;
    const walletUsd =
      complete && assets.every((token) => token.balanceUsd !== undefined)
        ? assets.reduce((sum, token) => sum + token.balanceUsd!, 0n)
        : undefined;

    return {
      assets,
      walletUsd,
      isLoading: enabled && (balances.isLoading || lookup.isLoading || prices.isPriceDataLoading),
      error: enabled ? error : undefined,
    };
  }, [
    enabled,
    balances.data,
    balances.error,
    balances.isLoading,
    lookup.data,
    lookup.error,
    lookup.isLoading,
    prices.pricesData,
    prices.error,
    prices.isPriceDataLoading,
  ]);
}
