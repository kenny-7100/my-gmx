import useSWR from "swr";

import { getIsSolanaNetworkEnabled } from "config/ab";
import { isSolanaNetwork, SOLANA_NETWORK_ID } from "config/chains";
import { useChainId } from "lib/chains";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

import type { UiFlags } from "./uiFlags";

export function useSolanaUiFlagsRequest({ enabled = true }: { enabled?: boolean } = {}) {
  const { networkId } = useChainId();
  const active = enabled && getIsSolanaNetworkEnabled() && isSolanaNetwork(networkId);
  const { data, error, isLoading } = useSWR<UiFlags, Error>(
    active ? ["solanaUiFlags", SOLANA_NETWORK_ID] : null,
    async () => {
      const { fetchSolanaUiFlags } = await import("domain/gmsol/fetchSolanaTradingEnabled");
      return fetchSolanaUiFlags();
    },
    { refreshInterval: CONFIG_UPDATE_INTERVAL, keepPreviousData: false }
  );

  return {
    uiFlags: active ? data : undefined,
    error: active ? error : undefined,
    isLoading: active && isLoading,
    active,
  };
}
