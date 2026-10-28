import { useSolanaUiFlagsRequest } from "domain/synthetics/uiFlags/useSolanaUiFlagsRequest";

import { getSolanaTradingOverride } from "./fetchSolanaTradingEnabled";

export function useSolanaTradingEnabled({ enabled }: { enabled: boolean }) {
  const { uiFlags, error, isLoading, active } = useSolanaUiFlagsRequest({ enabled });
  let override: boolean | undefined;
  let overrideError: Error | undefined;
  if (active) {
    try {
      override = getSolanaTradingOverride();
    } catch (error) {
      overrideError = error;
    }
  }

  return {
    isSolanaTradingEnabled:
      active && !overrideError && (override ?? (!isLoading && !error && uiFlags?.solanaTrading?.enabled === true)),
    isLoading: active && override === undefined && !overrideError && isLoading,
    error: overrideError ?? (active && override === undefined ? error : undefined),
  };
}
