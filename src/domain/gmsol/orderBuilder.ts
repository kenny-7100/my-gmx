import type { Callback, TransactionGroup } from "@gmsol-labs/gmsol-sdk";
import { getBase58Encoder, getCompiledTransactionMessageDecoder, getTransactionDecoder } from "@solana/kit";

export const MAX_ORDER_TRANSACTION_BYTES = 1232;
const encodeAddress = getBase58Encoder();

export function orderAddress(value: string): string {
  if (encodeAddress.encode(value).length !== 32) throw new Error("Invalid order address");
  return value;
}
export function copyOrderLookupTables(tables: ReadonlyMap<string, readonly string[]>): Map<string, string[]> {
  const luts = new Map<string, string[]>();
  for (const [table, accounts] of tables) {
    if (accounts.length === 0 || accounts.length > 256) throw new Error("Invalid lookup table contents");
    luts.set(orderAddress(table), accounts.map(orderAddress));
  }
  if (luts.size === 0) throw new Error("Explicit lookup table contents are required");
  return luts;
}

export function copyOrderCallback(callback: Callback | undefined): Callback | undefined {
  return callback === undefined
    ? undefined
    : {
        version: callback.version,
        program: orderAddress(callback.program),
        shared_data: orderAddress(callback.shared_data),
        partitioned_data: orderAddress(callback.partitioned_data),
      };
}

/** Structural builder checks only; the complete pre-signature allowlist is a separate boundary. */
export function serializeUnsignedOrder(
  group: TransactionGroup,
  scope: { owner: string; recentBlockhash: string }
): Uint8Array {
  try {
    const batches = group.serialize();
    if (batches.length !== 1 || batches[0].length !== 1)
      throw new Error("Order action requires exactly one transaction");
    const bytes = new Uint8Array(batches[0][0]);
    if (bytes.length === 0 || bytes.length > MAX_ORDER_TRANSACTION_BYTES)
      throw new Error("Invalid order transaction size");
    const transaction = getTransactionDecoder().decode(bytes);
    const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
    if (message.version !== 0 || (message.addressTableLookups?.length ?? 0) === 0) {
      throw new Error("Order action must use explicit lookup tables");
    }
    if (Object.values(transaction.signatures).some((signature) => signature !== null)) {
      throw new Error("Expected an unsigned order transaction");
    }
    if (message.staticAccounts[0] !== scope.owner || message.lifetimeToken !== scope.recentBlockhash) {
      throw new Error("Order transaction context mismatch");
    }
    return bytes;
  } finally {
    group.free();
  }
}
