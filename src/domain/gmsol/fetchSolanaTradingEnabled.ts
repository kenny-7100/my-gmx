import { ARBITRUM } from "config/chains";
import type { UiFlags } from "domain/synthetics/uiFlags/uiFlags";
import { getOracleKeeperUrl } from "sdk/configs/oracleKeeper";

export async function fetchSolanaTradingEnabled(): Promise<boolean> {
  if (import.meta.env.DEV) {
    const override = import.meta.env.VITE_APP_SOLANA_TRADING_OVERRIDE;
    if (override === "true") return true;
    if (override === "false") return false;
    if (override !== undefined && override !== "") {
      throw new Error("VITE_APP_SOLANA_TRADING_OVERRIDE must be true, false, or unset.");
    }
  }

  const response = await fetch(`${getOracleKeeperUrl(ARBITRUM)}/ui-flags/v2`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch solanaTrading: HTTP ${response.status}`);
  }

  const flags = (await response.json()) as UiFlags;

  return flags.solanaTrading?.enabled === true;
}
