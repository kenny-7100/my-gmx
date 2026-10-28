import { bigMath } from "utils/bigmath";
import { MaxUint256, USD_DECIMALS } from "utils/numbers";

export const GMSOL_USD_DECIMALS = 20;

const GMSOL_USD_SCALE = 10n ** BigInt(USD_DECIMALS - GMSOL_USD_DECIMALS);
const MAX_GMSOL_VALUE = (1n << 128n) - 1n;

function requireUnsignedValue(value: bigint, maximum: bigint): bigint {
  if (typeof value !== "bigint") {
    throw new TypeError("Unit conversion requires a bigint value");
  }
  if (value < 0n || value > maximum) {
    throw new RangeError("Unit conversion value is out of range");
  }
  return value;
}

function getPriceScale(tokenDecimals: number): bigint {
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > USD_DECIMALS) {
    throw new RangeError("Token decimals must be an integer between 0 and 30");
  }
  return GMSOL_USD_SCALE * 10n ** BigInt(tokenDecimals);
}

/** Converts unsigned USD30 to USD20, rounding down. Signed PnL is not an order input. */
export function toGmsolUsd(value: bigint): bigint {
  requireUnsignedValue(value, MaxUint256);
  return requireUnsignedValue(bigMath.mulDiv(value, 1n, GMSOL_USD_SCALE), MAX_GMSOL_VALUE);
}

/** Converts unsigned USD20 to USD30 without rounding. */
export function fromGmsolUsd(value: bigint): bigint {
  requireUnsignedValue(value, MAX_GMSOL_VALUE);
  return value * GMSOL_USD_SCALE;
}

/** Converts a whole-token USD30 price to a USD20 price per smallest token unit. */
export function toGmsolPrice({
  price,
  tokenDecimals,
  roundUp,
}: {
  price: bigint;
  tokenDecimals: number;
  roundUp: boolean;
}): bigint {
  requireUnsignedValue(price, MaxUint256);
  const scale = getPriceScale(tokenDecimals);
  return requireUnsignedValue(bigMath.mulDiv(price, 1n, scale, roundUp), MAX_GMSOL_VALUE);
}

/** Converts a USD20 price per smallest token unit to a whole-token USD30 price. */
export function fromGmsolPrice({ price, tokenDecimals }: { price: bigint; tokenDecimals: number }): bigint {
  requireUnsignedValue(price, MAX_GMSOL_VALUE);
  return requireUnsignedValue(price * getPriceScale(tokenDecimals), MaxUint256);
}
