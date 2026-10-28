import { describe, expect, it } from "vitest";

import { getAddressKey, isEvmAddress, isSameAddress, normalizeAddress } from "utils/address";

const EVM = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const SOLANA = "So11111111111111111111111111111111111111112";
const HASH = `0x${"AB".repeat(32)}`;

describe("shared address identity", () => {
  it("normalizes EVM addresses while preserving base58 and opaque keys", () => {
    for (const [input, normalized, key, evm] of [
      [EVM, EVM, EVM.toLowerCase(), true],
      [EVM.toLowerCase(), EVM, EVM.toLowerCase(), true],
      [SOLANA, SOLANA, SOLANA, false],
      [SOLANA.toLowerCase(), SOLANA.toLowerCase(), SOLANA.toLowerCase(), false],
      [HASH, HASH, HASH.toLowerCase(), false],
      ["0xABCDEF", "0xABCDEF", "0xabcdef", false],
      ["", "", "", false],
    ] as const) {
      expect(normalizeAddress(input)).toBe(normalized);
      expect(getAddressKey(input)).toBe(key);
      expect(isEvmAddress(input)).toBe(evm);
    }
  });

  it("matches EVM casing without conflating base58 identities or missing values", () => {
    for (const [a, b, expected] of [
      [EVM, EVM.toLowerCase(), true],
      [EVM, "0x82AF49447D8a07e3bd95BD0d56f35241523fBab1", true],
      [HASH, HASH.toLowerCase(), true],
      [SOLANA, SOLANA, true],
      [SOLANA, SOLANA.toLowerCase(), false],
      [SOLANA, EVM, false],
      ["", "", false],
      [undefined, undefined, false],
      [EVM, undefined, false],
    ] as const) {
      expect(isSameAddress(a, b)).toBe(expected);
      expect(isSameAddress(b, a)).toBe(expected);
    }
  });
});
