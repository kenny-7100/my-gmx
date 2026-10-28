import useSWR from "swr";

import { getIsSolanaNetworkEnabled } from "config/ab";
import { isSolanaNetwork, type SolanaNetworkId } from "config/chains";
import { useChainId } from "lib/chains";
import type { TokenBalancesData } from "sdk/utils/tokens/types";

export function getSolanaBalancesKey(networkId: SolanaNetworkId, owner: string) {
  return [networkId, "solanaBalances", owner] as const;
}

export function useSolanaBalances(owner: string | undefined) {
  const { networkId } = useChainId();
  const key =
    getIsSolanaNetworkEnabled() && isSolanaNetwork(networkId) && owner ? getSolanaBalancesKey(networkId, owner) : null;

  return useSWR<TokenBalancesData, Error>(
    key,
    async ([, , account]: ReturnType<typeof getSolanaBalancesKey>) => {
      const { fetchSolanaBalances } = await import("lib/solana/balances");
      return fetchSolanaBalances(account);
    },
    { keepPreviousData: false }
  );
}
