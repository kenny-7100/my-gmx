import { getIsSolanaNetworkEnabled } from "config/ab";
import { isSolanaNetwork, type NetworkId } from "config/chains";
import { getToken } from "sdk/configs/tokens";
import type { Token } from "sdk/utils/tokens/types";

export type NetworkTokenLookup = {
  networkId: NetworkId;
  getToken: (address: string) => Token | undefined;
};

/** Load at the data boundary, then pass the scoped synchronous lookup to shared consumers. */
export async function loadNetworkTokenLookup(networkId: NetworkId): Promise<NetworkTokenLookup> {
  if (!isSolanaNetwork(networkId)) {
    return { networkId, getToken: (address) => getToken(networkId, address) };
  }
  if (!getIsSolanaNetworkEnabled()) {
    throw new Error("Solana network is disabled");
  }
  const { getGmsolToken } = await import("domain/gmsol/tokens");
  return {
    networkId,
    getToken: (address) => {
      if (!getIsSolanaNetworkEnabled()) {
        throw new Error("Solana network is disabled");
      }
      return getGmsolToken(address);
    },
  };
}
