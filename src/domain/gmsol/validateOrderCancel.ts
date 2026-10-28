import { address, getBase58Encoder, getProgramDerivedAddress } from "@solana/kit";

import {
  GMSOL_STORE_ADDRESS,
  GMSOL_STORE_PROGRAM_ID,
  SOLANA_SYSTEM_PROGRAM_ID,
  SOLANA_TOKEN_PROGRAM_ID,
} from "config/gmsol/program";

import type { OrderCancelInput } from "./buildOrderCancel";
import { copyOrderCallback, orderAddress } from "./orderBuilder";
import {
  ORDER_COMPUTE_BUDGET_PROGRAM,
  orderInstructionBytes,
  requireOrderValue,
  validateOrderComputeBudget,
} from "./orderValidation";
import { parseUnsignedOrderTransaction } from "./parseUnsignedOrderTransaction";
import type { UnsignedOrderTransactionInput } from "./parseUnsignedOrderTransaction";

export type OrderCancelValidationInput = Omit<OrderCancelInput, "owner"> &
  UnsignedOrderTransactionInput & {
    // Independent approved action budget; not inferred from unsigned bytes.
    computeUnitLimit: number;
    computeUnitPrice: bigint;
  };
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
// Pinned close_order_v2 discriminator, Borsh string length and the sole allowed reason, "cancel".
const CANCEL_DATA = [213, 217, 98, 100, 225, 205, 76, 184, 6, 0, 0, 0, 99, 97, 110, 99, 101, 108];
const optionalAddress = (value: string | undefined) => (value === undefined ? undefined : orderAddress(value));

/** Validates one owner cancellation, including its exact ATA setup. No chain or wallet access. */
export async function validateOrderCancel(input: OrderCancelValidationInput) {
  const bytes = new Uint8Array(input.bytes);
  const parsed = parseUnsignedOrderTransaction({ ...input, bytes });
  const wallet = parsed.wallet;
  const order = orderAddress(input.order);
  const receiver = orderAddress(input.receiver);
  const rentReceiver = orderAddress(input.rentReceiver);
  requireOrderValue(
    receiver === wallet && rentReceiver === wallet,
    "Order cancellation receivers must match the owner"
  );
  const referrer = optionalAddress(input.referrerWallet);
  requireOrderValue(referrer !== wallet, "Order owner cannot be the referrer");
  const callback = copyOrderCallback(input.callback);
  const tokens = [input.initialCollateralToken, input.finalOutputToken, input.longToken, input.shortToken].map(
    optionalAddress
  );
  const unwrap = input.shouldUnwrapNativeToken;
  requireOrderValue(typeof unwrap === "boolean", "Explicit native unwrap flag is required");
  const mints = [...new Set(tokens.filter((token): token is string => token !== undefined))];
  requireOrderValue(parsed.instructions.length === 3 + mints.length, "Unexpected cancellation instruction count");
  validateOrderComputeBudget(parsed, input);

  const publicKey = getBase58Encoder();
  type PdaSeed = Parameters<typeof getProgramDerivedAddress>[0]["seeds"][number];
  const derive = async (program: string, seeds: PdaSeed[]) =>
    (await getProgramDerivedAddress({ programAddress: address(program), seeds }))[0];
  const text = (value: string) => new TextEncoder().encode(value);
  const pda = (...seeds: PdaSeed[]) => derive(GMSOL_STORE_PROGRAM_ID, seeds);
  const storeSeed = publicKey.encode(GMSOL_STORE_ADDRESS);
  const ata = (owner: string, mint: string) =>
    derive(ATA_PROGRAM, [publicKey.encode(owner), publicKey.encode(SOLANA_TOKEN_PROGRAM_ID), publicKey.encode(mint)]);
  const [storeWallet, user, referrerUser, eventAuthority, callbackAuthority, escrowAddresses, receiverAddresses] =
    await Promise.all([
      pda(text("store_wallet"), storeSeed),
      pda(text("user"), storeSeed, publicKey.encode(wallet)),
      referrer === undefined ? GMSOL_STORE_PROGRAM_ID : pda(text("user"), storeSeed, publicKey.encode(referrer)),
      pda(text("__event_authority")),
      pda(text("callback")),
      Promise.all(mints.map((mint) => ata(order, mint))),
      Promise.all(mints.map((mint) => ata(wallet, mint))),
    ]);
  const escrows = new Map(mints.map((mint, i) => [mint, escrowAddresses[i]]));
  const atas = new Map(mints.map((mint, i) => [mint, receiverAddresses[i]]));
  const output = (mint: string) => (unwrap && mint === WRAPPED_SOL ? wallet : atas.get(mint)!);

  // Distinct role families may only alias within explicitly supported token or wallet roles.
  const distinct = [
    wallet,
    GMSOL_STORE_ADDRESS,
    storeWallet,
    user,
    order,
    eventAuthority,
    GMSOL_STORE_PROGRAM_ID,
    SOLANA_SYSTEM_PROGRAM_ID,
    SOLANA_TOKEN_PROGRAM_ID,
    ATA_PROGRAM,
    ORDER_COMPUTE_BUDGET_PROGRAM,
    ...mints,
    ...escrowAddresses,
    ...receiverAddresses,
  ];
  if (referrer !== undefined) distinct.push(referrerUser);
  if (callback) distinct.push(callbackAuthority, callback.program, callback.shared_data, callback.partitioned_data);
  requireOrderValue(new Set(distinct).size === distinct.length, "Unsupported cancellation account alias");
  const roles = [
    wallet,
    GMSOL_STORE_ADDRESS,
    storeWallet,
    wallet,
    receiver,
    rentReceiver,
    user,
    referrerUser,
    order,
    ...tokens.map((mint) => mint ?? GMSOL_STORE_PROGRAM_ID),
    ...tokens.map((mint) => (mint === undefined ? GMSOL_STORE_PROGRAM_ID : escrows.get(mint)!)),
    ...tokens.map((mint) => (mint === undefined ? GMSOL_STORE_PROGRAM_ID : output(mint))),
    SOLANA_SYSTEM_PROGRAM_ID,
    SOLANA_TOKEN_PROGRAM_ID,
    ATA_PROGRAM,
    callback ? callbackAuthority : GMSOL_STORE_PROGRAM_ID,
    callback?.program ?? GMSOL_STORE_PROGRAM_ID,
    callback?.shared_data ?? GMSOL_STORE_PROGRAM_ID,
    callback?.partitioned_data ?? GMSOL_STORE_PROGRAM_ID,
    eventAuthority,
    GMSOL_STORE_PROGRAM_ID,
  ];

  const close = parsed.instructions[parsed.instructions.length - 1];
  const data = orderInstructionBytes(close.dataBase64);
  requireOrderValue(
    close.program.address === GMSOL_STORE_PROGRAM_ID &&
      data.length === CANCEL_DATA.length &&
      CANCEL_DATA.every((byte, i) => data[i] === byte),
    "Unexpected cancellation instruction data or program"
  );
  requireOrderValue(
    close.accounts.length === roles.length && close.accounts.every((a, i) => a.address === roles[i]),
    "Unexpected cancellation account"
  );

  // Rust collects a HashSet of mints: each ATA must appear once before close, in any order.
  const remaining = new Set(mints);
  for (const ix of parsed.instructions.slice(2, -1)) {
    const data = orderInstructionBytes(ix.dataBase64);
    const mint = ix.accounts[3]?.address;
    requireOrderValue(
      ix.program.address === ATA_PROGRAM &&
        data.length === 1 &&
        data[0] === 1 &&
        mint !== undefined &&
        remaining.delete(mint),
      "Unexpected cancellation ATA setup"
    );
    const expected = [wallet, atas.get(mint)!, wallet, mint, SOLANA_SYSTEM_PROGRAM_ID, SOLANA_TOKEN_PROGRAM_ID];
    requireOrderValue(
      ix.accounts.length === expected.length && ix.accounts.every((a, i) => a.address === expected[i]),
      "Unexpected cancellation ATA account"
    );
  }
  requireOrderValue(remaining.size === 0, "Missing cancellation ATA setup");
  const privileges = new Map(distinct.map((key) => [key, { isSigner: false, isWritable: false }]));
  privileges.set(wallet, { isSigner: true, isWritable: true });
  const writable = [GMSOL_STORE_ADDRESS, storeWallet, user, order, ...escrowAddresses, ...receiverAddresses];
  if (referrer !== undefined) writable.push(referrerUser);
  if (callback) writable.push(callback.shared_data, callback.partitioned_data);
  for (const key of writable) privileges.set(key, { isSigner: false, isWritable: true });
  requireOrderValue(parsed.accounts.length === privileges.size, "Unexpected cancellation account count");
  for (const account of parsed.accounts) {
    const expected = privileges.get(account.address);
    requireOrderValue(
      expected && expected.isSigner === account.isSigner && expected.isWritable === account.isWritable,
      "Unexpected cancellation privileges"
    );
  }
  return {
    status: "validated-cancel" as const,
    network: parsed.network,
    wallet,
    order,
    receiver,
    rentReceiver,
    recentBlockhash: parsed.recentBlockhash,
    bytes,
  };
}
