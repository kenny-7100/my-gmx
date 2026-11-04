import { useMemo } from "react";
import useSWR from "swr";

import { ARBITRUM, SOLANA_NETWORK_ID } from "config/chains";
import type { TokensDataResult } from "domain/synthetics/tokens";
import { useOracleKeeperFetcher } from "lib/oracleKeeperFetcher/useOracleKeeperFetcher";
import { FREQUENT_UPDATE_INTERVAL } from "lib/timeConstants";
import type { TokenPricesData } from "sdk/utils/tokens/types";

import { buildGmsolTokensData } from "./buildGmsolTokensData";
import { fetchGmsolPrices } from "./fetchGmsolPrices";
import { getGmsolApiCacheKey } from "../api/gmsolApiSdk";

type PricesResponse = { pricesData: TokenPricesData | undefined; receivedAt: number };

export function useGmsolTokensData({ enabled }: { enabled: boolean }): TokensDataResult & { isUnavailable: boolean } {
  const oracleFetcher = useOracleKeeperFetcher(ARBITRUM);
  const { data, error } = useSWR<PricesResponse, Error>(
    enabled ? ["gmsolPrices", SOLANA_NETWORK_ID, getGmsolApiCacheKey(), oracleFetcher.url] : null,
    async () => ({ pricesData: await fetchGmsolPrices(oracleFetcher), receivedAt: Date.now() }),
    { refreshInterval: FREQUENT_UPDATE_INTERVAL }
  );

  const tokensData = useMemo(
    () => (data?.pricesData ? buildGmsolTokensData(data.pricesData) : undefined),
    [data?.pricesData]
  );

  return {
    tokensData,
    pricesUpdatedAt: data?.pricesData ? data.receivedAt : undefined,
    isGmxAccountBalancesLoaded: false,
    isWalletBalancesLoaded: false,
    isBalancesLoaded: false,
    error,
    isUnavailable: Boolean(error) || (data !== undefined && !data.pricesData),
  };
}
