// @vitest-environment node
import { describe, expect, it } from "vitest";

import { decodeOrderCreateData } from "./decodeOrderCreateData";
import capabilities from "../../../tools/solana-builder-probe/capability-fixtures.json";
import native from "../../../tools/solana-builder-probe/native-fixtures.json";
import parameters from "../../../tools/solana-builder-probe/parameter-fixtures.json";
import unsigned from "../../../tools/solana-builder-probe/unsigned-fixtures.json";

const kinds = [
  "Liquidation",
  "AutoDeleveraging",
  "MarketSwap",
  "MarketIncrease",
  "MarketDecrease",
  "LimitSwap",
  "LimitIncrease",
  "LimitDecrease",
  "StopLossDecrease",
];
const swaps = ["NoSwap", "PnlTokenToCollateralToken", "CollateralToPnlToken"];
const base = {
  kind: "MarketIncrease",
  decreasePositionSwapType: undefined,
  executionLamports: 300000n,
  swapPathLength: 0,
  initialCollateralDeltaAmount: 10000000n,
  sizeDeltaValue: 10000000000000000000000n,
  isLong: true,
  isCollateralLong: true,
  minOutput: 0n,
  triggerPrice: undefined,
  acceptablePrice: 20000000000000n,
  shouldUnwrapNativeToken: true,
  validFromTs: undefined,
};
type Instruction = {
  name?: string;
  dataBase64: string;
  nonceHex?: string;
  decodedArgs?: {
    [key: string]: unknown;
    params?: Record<string, string | boolean | number | null>;
    callback_version?: number | null;
  };
};
function expectedParams(params: Record<string, string | boolean | number | null>) {
  const bigint = (key: string) => {
    const value = params[key];
    return value === null ? undefined : BigInt(value);
  };
  return {
    kind: params.kind,
    decreasePositionSwapType: params.decrease_position_swap_type ?? undefined,
    executionLamports: bigint("execution_lamports"),
    swapPathLength: params.swap_path_length,
    initialCollateralDeltaAmount: bigint("initial_collateral_delta_amount"),
    sizeDeltaValue: bigint("size_delta_value"),
    isLong: params.is_long,
    isCollateralLong: params.is_collateral_long,
    minOutput: bigint("min_output"),
    triggerPrice: bigint("trigger_price"),
    acceptablePrice: bigint("acceptable_price"),
    shouldUnwrapNativeToken: params.should_unwrap_native_token,
    validFromTs: bigint("valid_from_ts"),
  };
}

// Independent byte vectors use the fixed Rust field order, not the decoder's tables or reader.
function vector(
  create: boolean,
  high: boolean,
  kind = 3,
  swap: number | undefined = undefined,
  callback?: number,
  present = true
) {
  const chunks: Buffer[] = [];
  const tags: { offset: number; firstInvalid: number }[] = [];
  let length = 0;
  const put = (bytes: Buffer) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const byte = (n: number) => put(Buffer.from([n]));
  const tag = (n: number, firstInvalid = 2) => {
    tags.push({ offset: length, firstInvalid });
    byte(n);
  };
  const number = (n: bigint, size: number) => {
    const bytes = Buffer.alloc(size);
    const bits = BigInt.asUintN(size * 8, n);
    bytes.writeBigUInt64LE(BigInt.asUintN(64, bits));
    if (size === 16) bytes.writeBigUInt64LE(bits >> 64n, 8);
    put(bytes);
  };
  const u64 = high ? (1n << 64n) - 1n : 0n;
  const u128 = high ? (1n << 128n) - 1n : 0n;
  const i64 = high ? (1n << 63n) - 1n : -(1n << 63n);
  put(Buffer.from(create ? "c89d03b603a4a2f0" : "b2d7375a890f6c0f", "hex"));
  if (create) put(Buffer.from(Array.from({ length: 32 }, (_, i) => i)));
  tag(kind, 9);
  tag(swap === undefined ? 0 : 1);
  if (swap !== undefined) tag(swap, 3);
  number(u64, 8);
  byte(high ? 255 : 0);
  number(u64, 8);
  number(u128, 16);
  tag(Number(high));
  tag(Number(!high));
  for (let i = 0; i < 3; i++) {
    tag(Number(present));
    if (present) number(u128, 16);
  }
  tag(Number(high));
  tag(Number(present));
  if (present) number(i64, 8);
  if (create) {
    tag(callback === undefined ? 0 : 1);
    if (callback !== undefined) byte(callback);
  }
  return {
    bytes: Buffer.concat(chunks),
    tags,
    params: {
      kind: kinds[kind],
      decreasePositionSwapType: swap === undefined ? undefined : swaps[swap],
      executionLamports: u64,
      swapPathLength: high ? 255 : 0,
      initialCollateralDeltaAmount: u64,
      sizeDeltaValue: u128,
      isLong: high,
      isCollateralLong: !high,
      minOutput: present ? u128 : undefined,
      triggerPrice: present ? u128 : undefined,
      acceptablePrice: present ? u128 : undefined,
      shouldUnwrapNativeToken: high,
      validFromTs: present ? i64 : undefined,
    },
  };
}

describe("strict fixed-ABI order create and position data decoding", () => {
  it("decodes every create and prepare instruction in four pinned WASM fixture collections", () => {
    let count = 0;
    const collections: { cases: { name: string; transactions: { instructions: Instruction[] }[][] }[] }[] = [
      unsigned,
      parameters,
      capabilities,
      native,
    ];
    for (const collection of collections) {
      for (const c of collection.cases) {
        const instructions: Instruction[] = c.transactions.flat().flatMap((tx) => tx.instructions);
        const creates = instructions.filter((ix) => ix.name === "create_order_v2");
        let index = 0;
        for (const ix of instructions.filter((ix) => ["create_order_v2", "prepare_position"].includes(ix.name ?? ""))) {
          const reference = ix.decodedArgs ?? (ix.name === "prepare_position" ? creates[0].decodedArgs : undefined);
          const combo = c.name === "increase-tp-sl-force-position-true";
          let expected = reference?.params
            ? expectedParams(reference.params)
            : {
                ...base,
                ...(ix.name === "prepare_position" && combo
                  ? { executionLamports: 0n, shouldUnwrapNativeToken: false }
                  : {}),
                ...(ix.name === "create_order_v2" && index > 0
                  ? {
                      kind: index === 1 ? "LimitDecrease" : "StopLossDecrease",
                      initialCollateralDeltaAmount: 0n,
                      triggerPrice: index === 1 ? 25000000000000n : 10000000000000n,
                    }
                  : {}),
              };
          if (ix.name === "prepare_position" && c.name.startsWith("native-combo-")) {
            expected = { ...expected, executionLamports: 0n, shouldUnwrapNativeToken: false };
          }
          const result = decodeOrderCreateData(Buffer.from(ix.dataBase64, "base64"));
          expect(result).toEqual(
            ix.name === "prepare_position"
              ? { status: "decoded", name: ix.name, params: expected }
              : {
                  status: "decoded",
                  name: ix.name,
                  params: expected,
                  nonce: new Uint8Array(Buffer.from(ix.nonceHex!, "hex")),
                  callbackVersion: ix.decodedArgs?.callback_version ?? undefined,
                }
          );
          if (ix.name === "create_order_v2") index++;
          count++;
        }
      }
    }
    expect(count).toBe(33);
  });

  it("preserves integer boundaries, all ABI enums, option zero and independent nonce bytes", () => {
    for (const create of [false, true])
      for (const high of [false, true]) {
        for (let kind = 0; kind < kinds.length; kind++)
          for (const swap of [undefined, 0, 1, 2]) {
            for (const callback of [undefined, 0, 255])
              for (const present of [false, true]) {
                const v = vector(create, high, kind, swap, callback, present);
                const decoded = decodeOrderCreateData(v.bytes);
                expect(decoded.params).toEqual(v.params);
                if (decoded.name === "create_order_v2") {
                  expect(decoded.callbackVersion).toBe(callback);
                  expect([...decoded.nonce]).toEqual(Array.from({ length: 32 }, (_, i) => i));
                  v.bytes.fill(255, 8, 40);
                  expect(decoded.nonce[0]).toBe(0);
                }
              }
          }
      }
  });

  it("rejects every truncation, trailing data, wrong discriminator and noncanonical tags", () => {
    for (const create of [false, true])
      for (const swap of [undefined, 2])
        for (const callback of [undefined, 0])
          for (const present of [false, true]) {
            const { bytes, tags } = vector(create, true, 8, swap, callback, present);
            for (let end = 0; end < bytes.length; end++)
              expect(() => decodeOrderCreateData(bytes.subarray(0, end))).toThrow();
            for (const tail of [[0], [1], [255, 0]])
              expect(() => decodeOrderCreateData(Buffer.concat([bytes, Buffer.from(tail)]))).toThrow(/Trailing/);
            for (let i = 0; i < 8; i++) {
              const bad = Buffer.from(bytes);
              bad[i] ^= 1;
              expect(() => decodeOrderCreateData(bad)).toThrow(/discriminator/);
            }
            for (const { offset, firstInvalid } of tags)
              for (let value = firstInvalid; value <= 255; value++) {
                const bad = Buffer.from(bytes);
                bad[offset] = value;
                expect(() => decodeOrderCreateData(bad)).toThrow(/Invalid/);
              }
          }
  });
});
