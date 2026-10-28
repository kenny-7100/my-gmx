import { ARBITRUM } from "config/chains";
import type { UiFlags } from "domain/synthetics/uiFlags/uiFlags";
import { getOracleKeeperUrl } from "sdk/configs/oracleKeeper";

export function getSolanaTradingOverride(): boolean | undefined {
  if (import.meta.env.DEV) {
    const override = import.meta.env.VITE_APP_SOLANA_TRADING_OVERRIDE;
    if (override === "true") return true;
    if (override === "false") return false;
    if (override !== undefined && override !== "") {
      throw new Error("VITE_APP_SOLANA_TRADING_OVERRIDE must be true, false, or unset.");
    }
  }
  return undefined;
}

export async function fetchSolanaUiFlags(): Promise<UiFlags> {
  const response = await fetch(`${getOracleKeeperUrl(ARBITRUM)}/ui-flags/v2`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch solanaTrading: HTTP ${response.status}`);
  }

  const flags: unknown = await response.json();
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) {
    throw new Error("Invalid Solana UI flags response");
  }
  return flags as UiFlags;
}

export async function fetchSolanaTradingEnabled(): Promise<boolean> {
  const override = getSolanaTradingOverride();
  if (override !== undefined) return override;
  const flags = await fetchSolanaUiFlags();
  return flags.solanaTrading?.enabled === true;
}
