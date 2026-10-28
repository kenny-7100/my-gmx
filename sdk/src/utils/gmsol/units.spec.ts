import { describe, expect, it } from "vitest";

import { fromGmsolPrice, fromGmsolUsd, toGmsolPrice, toGmsolUsd } from "utils/gmsol";

const MAX_U128 = (1n << 128n) - 1n;
const MAX_U256 = (1n << 256n) - 1n;

describe("gmsol order units FESOL-92", () => {
  it("preserves unsigned USD values at the USD20 rounding boundary and ABI maximum", () => {
    const vectors = [
      [0n, 0n],
      [9_999_999_999n, 0n],
      [10_000_000_000n, 1n],
      [10_000_000_001n, 1n],
      [123_456_789_012_345_678_901_234_567_890n, 12_345_678_901_234_567_890n],
      [MAX_U128 * 10_000_000_000n + 9_999_999_999n, MAX_U128],
    ];
    for (const [app, gmsol] of vectors) {
      expect(toGmsolUsd(app)).toBe(gmsol);
      expect(fromGmsolUsd(gmsol)).toBe(app - (app % 10_000_000_000n));
    }
  });

  it("converts whole-token prices using native mint decimals, not display multipliers", () => {
    // Decimal strings define exact $123456.789012345678901234 prices independently of the conversion.
    const wholeTokenPrice = BigInt("123456789012345678901234000000000000");
    const vectors: [number, bigint, bigint][] = [
      [6, 12_345_678_901_234_567_890n, BigInt("123456789012345678900000000000000000")],
      [8, 123_456_789_012_345_678n, BigInt("123456789012345678000000000000000000")],
      [9, 12_345_678_901_234_567n, BigInt("123456789012345670000000000000000000")],
      [18, 12_345_678n, BigInt("123456780000000000000000000000000000")],
      [24, 12n, BigInt("120000000000000000000000000000000000")],
    ];
    for (const [tokenDecimals, down, restored] of vectors) {
      expect(toGmsolPrice({ price: wholeTokenPrice, tokenDecimals, roundUp: false })).toBe(down);
      expect(toGmsolPrice({ price: wholeTokenPrice, tokenDecimals, roundUp: true })).toBe(down + 1n);
      expect(fromGmsolPrice({ price: down, tokenDecimals })).toBe(restored);
    }
    // Protocol Decimal::test_price_3: one USDC is $1, represented as 100000000000000.
    expect(toGmsolPrice({ price: 10n ** 30n, tokenDecimals: 6, roundUp: false })).toBe(100_000_000_000_000n);
  });

  it("keeps explicit rounding at zero, exact ticks, adjacent ticks and the u128 limit", () => {
    for (const tokenDecimals of [0, 6, 8, 9, 18, 24, 30]) {
      const tick = BigInt("1" + "0".repeat(10 + tokenDecimals));
      for (const [price, down, up] of [
        [0n, 0n, 0n],
        [tick - 1n, 0n, 1n],
        [tick, 1n, 1n],
        [tick + 1n, 1n, 2n],
      ]) {
        expect(toGmsolPrice({ price, tokenDecimals, roundUp: false })).toBe(down);
        expect(toGmsolPrice({ price, tokenDecimals, roundUp: true })).toBe(up);
      }
    }
    const maximumPrice = MAX_U128 * 10_000_000_000n;
    expect(toGmsolPrice({ price: maximumPrice, tokenDecimals: 0, roundUp: true })).toBe(MAX_U128);
    expect(toGmsolPrice({ price: maximumPrice + 1n, tokenDecimals: 0, roundUp: false })).toBe(MAX_U128);
    expect(() => toGmsolPrice({ price: maximumPrice + 1n, tokenDecimals: 0, roundUp: true })).toThrow(RangeError);
    expect(fromGmsolPrice({ price: MAX_U128, tokenDecimals: 24 })).toBe(MAX_U128 * 10n ** 34n);
  });

  it("rejects signed, overflowing and unsupported decimal inputs instead of clamping", () => {
    for (const value of [-1n, MAX_U256 + 1n, (MAX_U128 + 1n) * 10_000_000_000n]) {
      expect(() => toGmsolUsd(value)).toThrow(RangeError);
      expect(() => toGmsolPrice({ price: value, tokenDecimals: 0, roundUp: false })).toThrow(RangeError);
    }
    for (const value of [-1n, MAX_U128 + 1n]) {
      expect(() => fromGmsolUsd(value)).toThrow(RangeError);
      expect(() => fromGmsolPrice({ price: value, tokenDecimals: 9 })).toThrow(RangeError);
    }
    for (const tokenDecimals of [-1, 31, 1.5, NaN, Infinity]) {
      expect(() => toGmsolPrice({ price: 0n, tokenDecimals, roundUp: false })).toThrow(RangeError);
      expect(() => fromGmsolPrice({ price: 0n, tokenDecimals })).toThrow(RangeError);
    }
    for (const value of [0, 1.5, "1", undefined, null]) {
      expect(() => Reflect.apply(toGmsolUsd, undefined, [value])).toThrow(TypeError);
      expect(() => Reflect.apply(fromGmsolUsd, undefined, [value])).toThrow(TypeError);
    }
    expect(() => fromGmsolPrice({ price: MAX_U128, tokenDecimals: 30 })).toThrow(RangeError);
  });
});
