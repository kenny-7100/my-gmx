import { afterEach, expect, it } from "vitest";

import { setAbFlagEnabled } from "config/ab";
import { ARBITRUM, AVALANCHE, SOLANA_NETWORK_ID } from "config/chains";
import { getNativeToken, NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";
import { getIsEquivalentTokens } from "sdk/utils/tokens";

import { loadNetworkTokenLookup } from "./loadNetworkTokenLookup";

afterEach(() => setAbFlagEnabled("solanaNetwork", false));

it("resolves scoped metadata and relationships exactly while preserving EVM errors and flag isolation", async () => {
  setAbFlagEnabled("solanaNetwork", false);
  await expect(loadNetworkTokenLookup(SOLANA_NETWORK_ID)).rejects.toThrow("Solana network is disabled");
  for (const networkId of [ARBITRUM, AVALANCHE] as const) {
    const lookup = await loadNetworkTokenLookup(networkId);
    expect(lookup.getToken(NATIVE_TOKEN_ADDRESS)).toBe(getNativeToken(networkId));
    expect(() => lookup.getToken("unknown")).toThrow(`Incorrect address "unknown" for chainId ${networkId}`);
  }
  setAbFlagEnabled("solanaNetwork", true);
  const lookup = await loadNetworkTokenLookup(SOLANA_NETWORK_ID);
  const { GMSOL_NATIVE_TOKEN, GMSOL_TOKENS } = await import("config/gmsol/tokens");
  expect(lookup.networkId).toBe(SOLANA_NETWORK_ID);
  expect(lookup.getToken(NATIVE_TOKEN_ADDRESS)).toBe(GMSOL_NATIVE_TOKEN);
  expect(lookup.getToken("unknown")).toBeUndefined();
  expect(getIsEquivalentTokens(GMSOL_NATIVE_TOKEN, lookup.getToken(GMSOL_NATIVE_TOKEN.wrappedAddress)!)).toBe(true);
  for (const token of GMSOL_TOKENS) {
    expect(lookup.getToken(token.address)).toBe(token);
    expect(lookup.getToken(token.address.toLowerCase())).toBeUndefined();
    if (token.wrappedAddress) {
      const collateral = lookup.getToken(token.wrappedAddress)!;
      expect(getIsEquivalentTokens(token, collateral)).toBe(true);
    }
  }
  const evm = await loadNetworkTokenLookup(ARBITRUM);
  setAbFlagEnabled("solanaNetwork", false);
  expect(() => lookup.getToken(NATIVE_TOKEN_ADDRESS)).toThrow("Solana network is disabled");
  expect(evm.getToken(NATIVE_TOKEN_ADDRESS)).toBe(getNativeToken(ARBITRUM));
});
