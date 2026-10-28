import {
  getBase64Decoder,
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
  getTransactionDecoder,
  getTransactionEncoder,
} from "@solana/kit";

import { copyOrderLookupTables, MAX_ORDER_TRANSACTION_BYTES, orderAddress } from "./orderBuilder";

export type OrderTransactionAccount = {
  address: string;
  isSigner: boolean;
  isWritable: boolean;
  source: "static" | "lookup";
  lookupTable?: string;
  lookupIndex?: number;
};
export type ParsedUnsignedOrderTransaction = {
  status: "parsed";
  network: "solana-mainnet";
  wallet: string;
  recentBlockhash: string;
  accounts: OrderTransactionAccount[];
  instructions: {
    program: OrderTransactionAccount;
    accounts: OrderTransactionAccount[];
    dataBase64: string;
  }[];
};
export type UnsignedOrderTransactionInput = {
  network: "solana-mainnet";
  wallet: string;
  recentBlockhash: string;
  bytes: Uint8Array;
  // Explicit trusted contents; this pure parser does not attest on-chain validity or authority.
  lookupTables: ReadonlyMap<string, readonly string[]>;
};
const base64 = getBase64Decoder();
function requireValue(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(reason);
}

/** Parses structure and global privileges only. A parsed result is not permission to sign. */
export function parseUnsignedOrderTransaction(input: UnsignedOrderTransactionInput): ParsedUnsignedOrderTransaction {
  requireValue(input.network === "solana-mainnet", "Unsupported order network");
  const wallet = orderAddress(input.wallet);
  const recentBlockhash = orderAddress(input.recentBlockhash);
  const bytes = new Uint8Array(input.bytes);
  requireValue(bytes.length > 65 && bytes.length <= MAX_ORDER_TRANSACTION_BYTES, "Invalid transaction size");
  // Exactly one signature, with canonical shortvec length, followed by the v0 message prefix.
  requireValue(bytes[0] === 1 && bytes[65] === 0x80, "Expected a single-signer v0 transaction");
  const transaction = getTransactionDecoder().decode(bytes);
  requireValue(
    base64.decode(getTransactionEncoder().encode(transaction)) === base64.decode(bytes),
    "Noncanonical transaction bytes"
  );
  const signatures = Object.entries(transaction.signatures);
  requireValue(
    signatures.length === 1 && signatures[0][0] === wallet && signatures[0][1] === null,
    "Expected unsigned wallet signature"
  );
  const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  requireValue(message.version === 0, "Unsupported transaction version");
  requireValue(
    base64.decode(getCompiledTransactionMessageEncoder().encode(message)) === base64.decode(transaction.messageBytes),
    "Noncanonical or trailing message bytes"
  );
  const { header, staticAccounts } = message;
  requireValue(
    header.numSignerAccounts === 1 && header.numReadonlySignerAccounts === 0,
    "Unexpected signer privileges"
  );
  requireValue(
    staticAccounts.length > 0 && header.numReadonlyNonSignerAccounts <= staticAccounts.length - 1,
    "Invalid account header"
  );
  requireValue(staticAccounts[0] === wallet && message.lifetimeToken === recentBlockhash, "Transaction scope mismatch");
  const accounts: OrderTransactionAccount[] = staticAccounts.map((address, index) => ({
    address,
    isSigner: index === 0,
    isWritable: index < staticAccounts.length - header.numReadonlyNonSignerAccounts,
    source: "static",
  }));
  const tables = input.lookupTables.size > 0 ? copyOrderLookupTables(input.lookupTables) : input.lookupTables;
  const usedTables = new Set<string>();
  const writable: OrderTransactionAccount[] = [],
    readonly: OrderTransactionAccount[] = [];
  const lookups = message.addressTableLookups ?? [];
  for (const lookup of lookups) {
    requireValue(!usedTables.has(lookup.lookupTableAddress), "Duplicate lookup table");
    usedTables.add(lookup.lookupTableAddress);
    const table = tables.get(lookup.lookupTableAddress);
    requireValue(table !== undefined, "Missing lookup table contents");
    const usedIndexes = new Set<number>();
    requireValue(lookup.writableIndexes.length + lookup.readonlyIndexes.length > 0, "Empty lookup");
    for (const [indexes, target, isWritable] of [
      [lookup.writableIndexes, writable, true],
      [lookup.readonlyIndexes, readonly, false],
    ] as const) {
      for (const index of indexes) {
        requireValue(Number.isInteger(index) && index >= 0 && index < table.length, "Lookup index out of bounds");
        requireValue(!usedIndexes.has(index), "Duplicate lookup index");
        usedIndexes.add(index);
        target.push({
          address: table[index],
          isSigner: false,
          isWritable,
          source: "lookup",
          lookupTable: lookup.lookupTableAddress,
          lookupIndex: index,
        });
      }
    }
  }
  accounts.push(...writable, ...readonly);
  requireValue(
    accounts.length <= 256 && new Set(accounts.map((a) => a.address)).size === accounts.length,
    "Duplicate or excessive transaction accounts"
  );
  requireValue(message.instructions.length > 0, "Missing transaction instructions");
  const accountAt = (index: number) => {
    requireValue(
      Number.isInteger(index) && index >= 0 && index < accounts.length,
      "Instruction account index out of bounds"
    );
    return accounts[index];
  };
  const instructions = message.instructions.map((instruction) => {
    requireValue(
      instruction.programAddressIndex > 0 && instruction.programAddressIndex < staticAccounts.length,
      "Program must be a static non-signer account"
    );
    return {
      program: accountAt(instruction.programAddressIndex),
      accounts: Array.from(instruction.accountIndices ?? [], accountAt),
      dataBase64: base64.decode(instruction.data ?? new Uint8Array()),
    };
  });
  return { status: "parsed", network: input.network, wallet, recentBlockhash, accounts, instructions };
}
