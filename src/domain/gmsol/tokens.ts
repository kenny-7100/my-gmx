import { GMSOL_NATIVE_TOKEN, GMSOL_TOKENS } from "config/gmsol/tokens";
import type { Token } from "sdk/utils/tokens/types";

export function getGmsolToken(address: string): Token | undefined {
  if (address === GMSOL_NATIVE_TOKEN.address) {
    return GMSOL_NATIVE_TOKEN;
  }
  return GMSOL_TOKENS.find((token) => token.address === address);
}
