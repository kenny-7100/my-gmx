import { useMemo } from "react";
import useSWR from "swr";

import { isSolanaNetwork } from "config/chains";
import { useChainId } from "lib/chains";
import { getOracleKeeperFetcher } from "lib/oracleKeeperFetcher";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

import { UiFlags, confirmRelayControlFlags, persistApiFlags, readPersistedUiFlags } from "./uiFlags";

export * from "./uiFlags";

export function useUiFlagsRequest() {
  const { chainId, networkId } = useChainId();
  const enabled = !isSolanaNetwork(networkId);

  const fallbackData = useMemo(() => (enabled ? readPersistedUiFlags(chainId) : undefined), [chainId, enabled]);

  const { data: uiFlags } = useSWR<UiFlags>(
    enabled ? ["uiFlags", chainId] : null,
    async () => {
      const result = await confirmRelayControlFlags(chainId, await getOracleKeeperFetcher(chainId).fetchUiFlags());
      persistApiFlags(chainId, result);
      return result;
    },
    {
      refreshInterval: CONFIG_UPDATE_INTERVAL,
      fallbackData,
    }
  );

  return { uiFlags: enabled ? uiFlags : undefined };
}
