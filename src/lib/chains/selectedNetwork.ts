import { getIsSolanaNetworkEnabled } from "config/ab";
import { SELECTED_SOLANA_NETWORK_LOCAL_STORAGE_KEY } from "config/localStorage";

export function getIsSolanaNetworkSelected(): boolean {
  return getIsSolanaNetworkEnabled() && localStorage.getItem(SELECTED_SOLANA_NETWORK_LOCAL_STORAGE_KEY) === "true";
}
