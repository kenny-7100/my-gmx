import { requireOrderValue as requireValue } from "./orderValidation";

// Fixed store IDL at c6778dc9bf6444f9037c3b0d2dc219c857e1b45d.
const ORDER_KINDS = [
  "Liquidation",
  "AutoDeleveraging",
  "MarketSwap",
  "MarketIncrease",
  "MarketDecrease",
  "LimitSwap",
  "LimitIncrease",
  "LimitDecrease",
  "StopLossDecrease",
] as const;
const SWAP_TYPES = ["NoSwap", "PnlTokenToCollateralToken", "CollateralToPnlToken"] as const;
const DISCRIMINATORS = {
  create_order_v2: [200, 157, 3, 182, 3, 164, 162, 240],
  prepare_position: [178, 215, 55, 90, 137, 15, 108, 15],
} as const;

export type DecodedOrderCreateParams = {
  kind: (typeof ORDER_KINDS)[number];
  decreasePositionSwapType: (typeof SWAP_TYPES)[number] | undefined;
  executionLamports: bigint;
  swapPathLength: number;
  initialCollateralDeltaAmount: bigint;
  sizeDeltaValue: bigint;
  isLong: boolean;
  isCollateralLong: boolean;
  minOutput: bigint | undefined;
  triggerPrice: bigint | undefined;
  acceptablePrice: bigint | undefined;
  shouldUnwrapNativeToken: boolean;
  validFromTs: bigint | undefined;
};
export type DecodedOrderCreateData = {
  status: "decoded";
  params: DecodedOrderCreateParams;
} & (
  | { name: "prepare_position" }
  | { name: "create_order_v2"; nonce: Uint8Array; callbackVersion: number | undefined }
);

/** Decodes fixed Borsh bytes only; does not validate accounts, action intent or signing permission. */
export function decodeOrderCreateData(bytes: Uint8Array): DecodedOrderCreateData {
  let offset = 0;
  function take(size: number) {
    requireValue(offset + size <= bytes.length, "Truncated order create instruction data");
    const value = new Uint8Array(bytes.subarray(offset, offset + size));
    offset += size;
    return value;
  }
  function u8() {
    return take(1)[0];
  }
  function integer(size: number, signed = false) {
    const data = take(size);
    let value = 0n;
    for (let i = size - 1; i >= 0; i--) value = (value << 8n) | BigInt(data[i]);
    const bits = BigInt(size * 8);
    return signed && value >= 1n << (bits - 1n) ? value - (1n << bits) : value;
  }
  function boolean() {
    const tag = u8();
    requireValue(tag === 0 || tag === 1, "Invalid order create boolean tag");
    return tag === 1;
  }
  function option<T>(read: () => T): T | undefined {
    const tag = u8();
    requireValue(tag === 0 || tag === 1, "Invalid order create option tag");
    return tag === 1 ? read() : undefined;
  }
  function variant<T extends string>(variants: readonly T[]): T {
    const tag = u8();
    requireValue(tag < variants.length, "Invalid order create enum tag");
    return variants[tag];
  }
  const discriminator = take(8);
  const matches = (expected: readonly number[]) => expected.every((v, i) => discriminator[i] === v);
  const name = matches(DISCRIMINATORS.create_order_v2) ? "create_order_v2" : "prepare_position";
  requireValue(matches(DISCRIMINATORS[name]), "Unexpected order create discriminator");
  const nonce = name === "create_order_v2" ? take(32) : undefined;
  const params: DecodedOrderCreateParams = {
    kind: variant(ORDER_KINDS),
    decreasePositionSwapType: option(() => variant(SWAP_TYPES)),
    executionLamports: integer(8),
    swapPathLength: u8(),
    initialCollateralDeltaAmount: integer(8),
    sizeDeltaValue: integer(16),
    isLong: boolean(),
    isCollateralLong: boolean(),
    minOutput: option(() => integer(16)),
    triggerPrice: option(() => integer(16)),
    acceptablePrice: option(() => integer(16)),
    shouldUnwrapNativeToken: boolean(),
    validFromTs: option(() => integer(8, true)),
  };
  const result: DecodedOrderCreateData =
    nonce === undefined
      ? { status: "decoded", name: "prepare_position", params }
      : { status: "decoded", name: "create_order_v2", nonce, params, callbackVersion: option(u8) };
  requireValue(offset === bytes.length, "Trailing order create instruction data");
  return result;
}
