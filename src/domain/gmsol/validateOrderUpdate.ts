import { address, getBase58Encoder, getProgramDerivedAddress } from "@solana/kit";

import { GMSOL_STORE_ADDRESS, GMSOL_STORE_PROGRAM_ID } from "config/gmsol/program";

import type { OrderUpdateInput } from "./buildOrderUpdate";
import { orderAddress } from "./orderBuilder";
import {
  ORDER_COMPUTE_BUDGET_PROGRAM as COMPUTE_BUDGET_PROGRAM,
  orderInstructionBytes as dataBytes,
  requireOrderValue as requireValue,
  validateOrderComputeBudget,
} from "./orderValidation";
import { parseUnsignedOrderTransaction } from "./parseUnsignedOrderTransaction";
import type { UnsignedOrderTransactionInput } from "./parseUnsignedOrderTransaction";

export type ExpectedOrderUpdateParams = {
  // Protocol units: USD20 / contract unit prices, with raw-token minOutput for increases.
  sizeDeltaValue: bigint | undefined;
  acceptablePrice: bigint | undefined;
  triggerPrice: bigint | undefined;
  minOutput: bigint | undefined;
  validFromTs: bigint | undefined;
};
export type OrderUpdateValidationInput = UnsignedOrderTransactionInput & {
  // Independent trusted order record and action values, never inferred from the transaction.
  order: string;
  kind: OrderUpdateInput["kind"];
  marketToken: string;
  callback: { program: string; sharedData: string; partitionedData: string } | undefined;
  params: ExpectedOrderUpdateParams;
  // Exact approved values for this action; there is no implicit production fee policy.
  computeUnitLimit: number;
  computeUnitPrice: bigint;
};
const UPDATE_DISCRIMINATOR = [195, 175, 207, 33, 171, 246, 41, 176];
const PARAM_KEYS = ["sizeDeltaValue", "acceptablePrice", "triggerPrice", "minOutput", "validFromTs"] as const;
function integer(bytes: Uint8Array, offset: number, size: number) {
  requireValue(offset + size <= bytes.length, "Truncated update instruction data");
  let value = 0n;
  for (let i = size - 1; i >= 0; i--) value = (value << 8n) | BigInt(bytes[offset + i]);
  return value;
}
function validateParams(bytes: Uint8Array, expected: ExpectedOrderUpdateParams) {
  requireValue(
    UPDATE_DISCRIMINATOR.every((b, i) => bytes[i] === b),
    "Unexpected update discriminator"
  );
  let offset = UPDATE_DISCRIMINATOR.length;
  let changes = 0;
  for (const key of PARAM_KEYS) {
    const wanted = expected[key];
    const signed = key === "validFromTs";
    const bits = signed ? 64n : 128n;
    if (wanted !== undefined) {
      requireValue(
        typeof wanted === "bigint" && wanted >= (signed ? -(1n << 63n) : 0n) && wanted < 1n << (signed ? 63n : bits),
        "Invalid expected update parameter"
      );
      changes++;
    }
    const tag = bytes[offset++];
    requireValue(tag === 0 || tag === 1, "Invalid update option tag");
    let value: bigint | undefined;
    if (tag === 1) {
      value = integer(bytes, offset, Number(bits / 8n));
      offset += Number(bits / 8n);
      if (signed && value >= 1n << 63n) value -= 1n << 64n;
    }
    requireValue(value === wanted, `Unexpected update parameter: ${key}`);
  }
  requireValue(changes > 0, "Order update has no changes");
  requireValue(offset === bytes.length, "Trailing update instruction data");
}

/** Checks one offline update only. This does not attest chain state or authorize signing. */
export async function validateOrderUpdate(input: OrderUpdateValidationInput) {
  const bytes = new Uint8Array(input.bytes);
  const parsed = parseUnsignedOrderTransaction({ ...input, bytes });
  const order = orderAddress(input.order);
  const kind = input.kind;
  requireValue(["LimitIncrease", "LimitDecrease", "StopLossDecrease"].includes(kind), "Unsupported update order kind");
  const marketToken = orderAddress(input.marketToken);
  const params = { ...input.params };
  const callback =
    input.callback === undefined
      ? undefined
      : {
          program: orderAddress(input.callback.program),
          sharedData: orderAddress(input.callback.sharedData),
          partitionedData: orderAddress(input.callback.partitionedData),
        };
  requireValue(parsed.instructions.length === 3, "Expected two budget instructions and one update");
  validateOrderComputeBudget(parsed, input);
  const update = parsed.instructions[2];
  requireValue(update.program.address === GMSOL_STORE_PROGRAM_ID, "Unexpected update program");
  requireValue(update.accounts.length === 10, "Unexpected update account count");
  validateParams(dataBytes(update.dataBase64), params);

  const programAddress = address(GMSOL_STORE_PROGRAM_ID);
  const seed = (value: string) => new TextEncoder().encode(value);
  const publicKey = getBase58Encoder();
  const [[market], [eventAuthority], [callbackAuthority]] = await Promise.all([
    getProgramDerivedAddress({
      programAddress,
      seeds: [seed("market"), publicKey.encode(GMSOL_STORE_ADDRESS), publicKey.encode(marketToken)],
    }),
    getProgramDerivedAddress({ programAddress, seeds: [seed("__event_authority")] }),
    getProgramDerivedAddress({ programAddress, seeds: [seed("callback")] }),
  ]);
  const roles = [
    parsed.wallet,
    GMSOL_STORE_ADDRESS,
    market,
    order,
    callback ? callbackAuthority : GMSOL_STORE_PROGRAM_ID,
    callback?.program ?? GMSOL_STORE_PROGRAM_ID,
    callback?.sharedData ?? GMSOL_STORE_PROGRAM_ID,
    callback?.partitionedData ?? GMSOL_STORE_PROGRAM_ID,
    eventAuthority,
    GMSOL_STORE_PROGRAM_ID,
  ];
  // Only absent optional roles may alias the program sentinel in this supported subset.
  const distinct = [...roles.slice(0, 4), eventAuthority, GMSOL_STORE_PROGRAM_ID, COMPUTE_BUDGET_PROGRAM];
  if (callback) distinct.push(callbackAuthority, callback.program, callback.sharedData, callback.partitionedData);
  requireValue(new Set(distinct).size === distinct.length, "Unsupported update account alias");
  const privileges = new Map(distinct.map((key) => [key, { isSigner: false, isWritable: false }]));
  privileges.set(parsed.wallet, { isSigner: true, isWritable: true });
  for (const key of [market, order, ...(callback ? [callback.sharedData, callback.partitionedData] : [])]) {
    privileges.set(key, { isSigner: false, isWritable: true });
  }
  requireValue(
    update.accounts.every((account, i) => account.address === roles[i]),
    "Unexpected update account"
  );
  requireValue(parsed.accounts.length === privileges.size, "Unexpected transaction account count");
  for (const account of parsed.accounts) {
    const expected = privileges.get(account.address);
    requireValue(
      expected && expected.isSigner === account.isSigner && expected.isWritable === account.isWritable,
      "Unexpected update account privileges"
    );
  }
  return {
    status: "validated-update" as const,
    network: parsed.network,
    wallet: parsed.wallet,
    recentBlockhash: parsed.recentBlockhash,
    order,
    kind,
    marketToken,
    bytes,
  };
}
