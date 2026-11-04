import { fetchSolanaUiFlags } from "./fetchSolanaUiFlags";

export async function fetchSolanaTradingEnabled(): Promise<boolean> {
  if (import.meta.env.DEV) {
    const override = import.meta.env.VITE_APP_SOLANA_TRADING_OVERRIDE;
    if (override === "true") return true;
    if (override === "false") return false;
    if (override !== undefined && override !== "") {
      throw new Error("VITE_APP_SOLANA_TRADING_OVERRIDE must be true, false, or unset.");
    }
  }

  const flags = await fetchSolanaUiFlags();

  return flags.solanaTrading?.enabled === true;
}
