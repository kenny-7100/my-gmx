import { watchSolanaLinkedEvmConnectors } from "lib/wallets/solanaLinkedEvmConnectors";

import { solanaWalletConnectors } from "./privySolanaConnectors";

// One chunk: Privy's Solana connectors and the EVM-connector watcher. bootstrap() loads it only when
// solanaNetwork is on, so a failed fetch reaches showAppLoadError instead of leaving the splash up.
export function startSolanaWallet() {
  watchSolanaLinkedEvmConnectors();
  return { connectors: solanaWalletConnectors };
}
