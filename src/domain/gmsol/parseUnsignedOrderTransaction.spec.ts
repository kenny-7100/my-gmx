// @vitest-environment node
import {
  getBase64Decoder,
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
  getTransactionDecoder,
} from "@solana/kit";
import { describe, expect, it } from "vitest";

import { parseUnsignedOrderTransaction } from "./parseUnsignedOrderTransaction";
import type { UnsignedOrderTransactionInput } from "./parseUnsignedOrderTransaction";
import capabilities from "../../../tools/solana-builder-probe/capability-fixtures.json";
import fixtures from "../../../tools/solana-builder-probe/unsigned-fixtures.json";

const fromBase64 = (value: string) => Buffer.from(value, "base64");
const toBase64 = getBase64Decoder();
const sample = fixtures.cases.find((c) => c.name === "close-order")!.transactions[0][0];
function input(): UnsignedOrderTransactionInput {
  return {
    network: "solana-mainnet",
    wallet: fixtures.input.payer,
    recentBlockhash: fixtures.input.blockhash,
    bytes: fromBase64(sample.bytesBase64),
    lookupTables: new Map(fixtures.input.luts.map(([key, accounts]) => [key as string, accounts as string[]])),
  };
}
function mutateMessage(
  mutate: (message: ReturnType<ReturnType<typeof getCompiledTransactionMessageDecoder>["decode"]>) => void
) {
  const request = input();
  const transaction = getTransactionDecoder().decode(request.bytes);
  const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  mutate(message);
  request.bytes = Buffer.concat([
    request.bytes.subarray(0, 65),
    fromBase64(toBase64.decode(getCompiledTransactionMessageEncoder().encode(message))),
  ]);
  return request;
}

describe("strict unsigned v0 order transaction parsing", () => {
  it("resolves all fixture instructions with original account order and preserves global privileges", () => {
    for (const collection of [fixtures, capabilities]) {
      for (const c of collection.cases.filter((c) => c.name.startsWith("update-") || c.name.startsWith("close-"))) {
        for (const group of c.transactions)
          for (const tx of group) {
            const request = input();
            request.bytes = fromBase64(tx.bytesBase64);
            const parsed = parseUnsignedOrderTransaction(request);
            expect(
              parsed.instructions.map((ix) => ({
                program: ix.program.address,
                accounts: ix.accounts.map((a) => a.address),
                dataBase64: ix.dataBase64,
              }))
            ).toEqual(tx.instructions.map(({ program, accounts, dataBase64 }) => ({ program, accounts, dataBase64 })));
            expect(parsed.accounts[0]).toEqual({
              address: request.wallet,
              isSigner: true,
              isWritable: true,
              source: "static",
            });
            expect(parsed.accounts.filter((a) => a.isSigner)).toHaveLength(1);
            expect(parsed.accounts.filter((a) => a.source === "lookup").every((a) => !a.isSigner)).toBe(true);
            expect(parsed.instructions.every((ix) => parsed.accounts.includes(ix.program))).toBe(true);
          }
      }
    }
  });

  it("rejects truncated, trailing, signed, noncanonical and unsupported transaction containers", () => {
    const bytes = input().bytes;
    const malformed = [
      bytes.subarray(0, bytes.length - 1),
      new Uint8Array([...bytes, 0]),
      new Uint8Array(1233),
      new Uint8Array([0x81, 0, ...bytes.subarray(1)]),
      new Uint8Array([...bytes.subarray(0, 69), bytes[69] | 0x80, 0, ...bytes.subarray(70)]),
    ];
    for (const [offset, value] of [
      [1, 1],
      [65, 0x81],
      [66, 2],
      [67, 1],
      [68, 255],
    ]) {
      const changed = bytes.slice();
      changed[offset] = value;
      malformed.push(changed);
    }
    for (const changed of malformed)
      expect(() => parseUnsignedOrderTransaction({ ...input(), bytes: changed })).toThrow();
    for (const key of ["wallet", "recentBlockhash"] as const) {
      const request = input();
      request[key] = fixtures.input.market.marketTokenAddress;
      expect(() => parseUnsignedOrderTransaction(request)).toThrow();
    }
  });

  it("rejects unresolved tables, aliasing and malformed compiled instruction indexes", () => {
    const mutations: Parameters<typeof mutateMessage>[0][] = [
      (m) => {
        m.staticAccounts[1] = m.staticAccounts[2];
      },
      (m) => {
        m.instructions[0] = { ...m.instructions[0], programAddressIndex: 255 };
      },
      (m) => {
        m.instructions[0] = { ...m.instructions[0], programAddressIndex: 0 };
      },
      (m) => {
        m.instructions[0] = { ...m.instructions[0], programAddressIndex: m.staticAccounts.length };
      },
      (m) => {
        m.instructions[0] = { ...m.instructions[0], accountIndices: [255] };
      },
    ];
    for (const mutate of mutations) {
      const request = mutateMessage(mutate);
      expect(() => parseUnsignedOrderTransaction(request)).toThrow();
    }
    const lookups = [
      (m: ReturnType<ReturnType<typeof getCompiledTransactionMessageDecoder>["decode"]>) => {
        if (m.version === 0) m.addressTableLookups!.push(m.addressTableLookups![0]);
      },
      (m: ReturnType<ReturnType<typeof getCompiledTransactionMessageDecoder>["decode"]>) => {
        if (m.version === 0) m.addressTableLookups![0] = { ...m.addressTableLookups![0], writableIndexes: [255] };
      },
      (m: ReturnType<ReturnType<typeof getCompiledTransactionMessageDecoder>["decode"]>) => {
        if (m.version === 0) {
          const lookup = m.addressTableLookups![0];
          m.addressTableLookups![0] = { ...lookup, writableIndexes: [lookup.readonlyIndexes[0]] };
        }
      },
    ];
    for (const mutate of lookups) {
      const request = mutateMessage(mutate);
      expect(() => parseUnsignedOrderTransaction(request)).toThrow();
    }
    const missing = input();
    missing.lookupTables = new Map();
    expect(() => parseUnsignedOrderTransaction(missing)).toThrow();
    const replaced = input();
    replaced.lookupTables = new Map(
      [...replaced.lookupTables].map(([key, accounts]) => [key, accounts.map(() => replaced.wallet)])
    );
    expect(() => parseUnsignedOrderTransaction(replaced)).toThrow("Duplicate");
  });
});
