import { useMemo } from "react";
import useSWR from "swr";

import { getIsSolanaNetworkEnabled } from "config/ab";
import { ARBITRUM, isSolanaNetwork } from "config/chains";
import { useChainId } from "lib/chains";
import { FreshnessMetricId } from "lib/metrics";
import { freshnessMetrics } from "lib/metrics/reportFreshnessMetric";
import type { DayPriceCandle } from "lib/oracleKeeperFetcher/types";
import { useOracleKeeperFetcher } from "lib/oracleKeeperFetcher/useOracleKeeperFetcher";
import { ContractsChainId } from "sdk/configs/chains";
import { getToken } from "sdk/configs/tokens";

import { type PriceDelta, getPriceDelta } from "./priceDelta";

export type { PriceDelta } from "./priceDelta";

export type PriceDeltaMap = Partial<Record<string, PriceDelta>>;
type PriceDeltaResponse = {
  networkId: number;
  candles?: DayPriceCandle[];
  priceDeltas?: PriceDeltaMap;
};

export function use24hPriceDeltaRequest(chainId: number, tokenAddresses: (string | undefined)[]) {
  const { networkId } = useChainId();
  const solanaSource = isSolanaNetwork(chainId);
  const active = solanaSource ? isSolanaNetwork(networkId) && getIsSolanaNetworkEnabled() : !isSolanaNetwork(networkId);
  const oracleKeeperFetcher = useOracleKeeperFetcher((solanaSource ? ARBITRUM : chainId) as ContractsChainId);
  const { data, error, isLoading } = useSWR<PriceDeltaResponse, Error>(
    active ? [chainId, solanaSource ? "gmsol" : oracleKeeperFetcher.url, "use24PriceDelta"] : null,
    {
      fetcher: async () => {
        if (solanaSource) {
          const { fetchGmsol24hPriceDeltas } = await import("domain/gmsol/gmsolOracleFetcher");
          return { networkId: chainId, priceDeltas: await fetchGmsol24hPriceDeltas() };
        }
        const candles = await oracleKeeperFetcher.fetch24hPrices();
        freshnessMetrics.reportThrottled(chainId, FreshnessMetricId.Prices24h);
        return { networkId: chainId, candles };
      },
      keepPreviousData: false,
    }
  );

  const priceDeltaMap = useMemo(() => {
    if (!active || (solanaSource && (!data || error)) || (data && data.networkId !== chainId)) return undefined;
    return Object.fromEntries(
      tokenAddresses
        .filter((address): address is string => Boolean(address))
        .map((address) => [
          address,
          solanaSource ? data?.priceDeltas?.[address] : getPriceDelta(data?.candles, getToken(chainId, address).symbol),
        ])
    );
  }, [active, chainId, data, error, solanaSource, tokenAddresses]);

  return { priceDeltaMap, error: active ? error : undefined, isLoading: active && isLoading };
}

export function use24hPriceDeltaMap(
  chainId: number,
  tokenAddresses: (string | undefined)[]
): PriceDeltaMap | undefined {
  return use24hPriceDeltaRequest(chainId, tokenAddresses).priceDeltaMap;
}
