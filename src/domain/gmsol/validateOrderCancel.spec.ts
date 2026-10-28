// @vitest-environment node
import {
  address,
  getBase64Decoder,
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
  getTransactionDecoder,
} from "@solana/kit";
import { describe, expect, it } from "vitest";

import { buildOrderCancel } from "./buildOrderCancel";
import { parseUnsignedOrderTransaction } from "./parseUnsignedOrderTransaction";
import { validateOrderCancel } from "./validateOrderCancel";
import type { OrderCancelValidationInput } from "./validateOrderCancel";
import { loadPinnedSdk } from "../../../scripts/solana-sdk-vectors.mjs";
import callbacks from "../../../tools/solana-builder-probe/capability-fixtures.json";
import fixtures from "../../../tools/solana-builder-probe/unsigned-fixtures.json";

const basic = fixtures.cases.find((c) => c.name === "close-order")!;
const callbackCase = callbacks.cases.find((c) => c.name === "close-with-callback-referrer")!;
const usdc = fixtures.input.market.longTokenAddress;
const wrappedSol = "So11111111111111111111111111111111111111112";
function input(): OrderCancelValidationInput {
  return {
    network: "solana-mainnet",
    wallet: fixtures.input.payer,
    order: basic.order!,
    receiver: fixtures.input.payer,
    rentReceiver: fixtures.input.payer,
    recentBlockhash: fixtures.input.blockhash,
    bytes: Buffer.from(basic.transactions[0][0].bytesBase64, "base64"),
    lookupTables: new Map(fixtures.input.luts.map(([key, accounts]) => [key as string, accounts as string[]])),
    callback: undefined,
    referrerWallet: undefined,
    initialCollateralToken: usdc,
    finalOutputToken: usdc,
    longToken: usdc,
    shortToken: usdc,
    shouldUnwrapNativeToken: false,
    computeUnitLimit: 400_000,
    computeUnitPrice: 50_000n,
  };
}
function callbackInput(): OrderCancelValidationInput {
  return {
    ...input(),
    bytes: Buffer.from(callbackCase.transactions[0][0].bytesBase64, "base64"),
    order: "4qgbPJmg3UB29cPArm2vbTLhVVSBPsuyNrhirZ9fH8pp",
    callback: structuredClone(callbackCase.callback!),
    referrerWallet: callbackCase.referrer!,
  };
}
type Message = ReturnType<ReturnType<typeof getCompiledTransactionMessageDecoder>["decode"]>;
function mutate(request: OrderCancelValidationInput, change: (m: Message) => Message | void) {
  const tx = getTransactionDecoder().decode(request.bytes);
  const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  const changed = change(message) ?? message;
  request.bytes = Buffer.concat([
    request.bytes.subarray(0, 65),
    Buffer.from(getBase64Decoder().decode(getCompiledTransactionMessageEncoder().encode(changed)), "base64"),
  ]);
  return request;
}

describe("deterministic unsigned order cancellation validation", () => {
  it("accepts pinned fixtures and real WASM token aliases, absent roles and native outputs", async () => {
    for (const request of [input(), callbackInput()]) {
      const result = await validateOrderCancel(request);
      expect(result).toEqual({
        status: "validated-cancel",
        network: request.network,
        wallet: request.wallet,
        order: request.order,
        receiver: request.receiver,
        rentReceiver: request.rentReceiver,
        recentBlockhash: request.recentBlockhash,
        bytes: new Uint8Array(request.bytes),
      });
      expect(result.bytes).not.toBe(request.bytes);
    }
    const { sdk } = await loadPinnedSdk();
    for (const unwrap of [false, true]) {
      for (let mask = 0; mask < 16; mask++) {
        const request = input();
        const keys = ["initialCollateralToken", "finalOutputToken", "longToken", "shortToken"] as const;
        keys.forEach((key, i) => {
          request[key] = mask & (1 << i) ? (i % 2 ? usdc : wrappedSol) : undefined;
        });
        request.shouldUnwrapNativeToken = unwrap;
        // Fixed WASM vector budget; not a production policy.
        request.computeUnitLimit = 400_000;
        const built = await buildOrderCancel({ ...request, owner: request.wallet }, async () => sdk);
        request.bytes = built.bytes;
        expect((await validateOrderCancel(request)).status).toBe("validated-cancel");
        if (mask === 1) {
          await expect(validateOrderCancel({ ...request, shouldUnwrapNativeToken: !unwrap })).rejects.toThrow();
        }
        if (mask === 15) {
          // Preparation order is nondeterministic in the SDK's HashSet, but must precede close.
          mutate(request, (m) => {
            [m.instructions[2], m.instructions[3]] = [m.instructions[3], m.instructions[2]];
          });
          expect((await validateOrderCancel(request)).status).toBe("validated-cancel");
          await expect(
            validateOrderCancel(
              mutate(request, (m) => {
                m.instructions[3] = m.instructions[2];
              })
            )
          ).rejects.toThrow();
        }
      }
    }
  });

  it("rejects every replaced role, setup account, malformed reason and extra or reordered instruction", async () => {
    const changes: ((m: Message) => void)[] = [
      ...Array.from({ length: 30 }, (_, i) => (m: Message) => {
        const ix = m.instructions[3];
        ix.accountIndices![i] = [0, 3, 4, 5].includes(i) ? ix.accountIndices![1] : 0;
      }),
      ...Array.from({ length: 6 }, (_, i) => (m: Message) => {
        const ix = m.instructions[2];
        ix.accountIndices![i] = i === 0 || i === 2 ? ix.accountIndices![3] : 0;
      }),
      ...[0, 1, 2, 3].map((i) => (m: Message) => {
        m.instructions[i] = {
          ...m.instructions[i],
          programAddressIndex: m.instructions[(i + 2) % 4].programAddressIndex,
        };
      }),
      (m) => {
        m.staticAccounts[m.instructions[0].programAddressIndex] = address(fixtures.input.market.marketTokenAddress);
      },
      (m) => {
        m.instructions.push(m.instructions[3]);
      },
      (m) => {
        m.instructions.splice(2, 1);
      },
      (m) => {
        [m.instructions[2], m.instructions[3]] = [m.instructions[3], m.instructions[2]];
      },
      (m) => {
        [m.instructions[0], m.instructions[1]] = [m.instructions[1], m.instructions[0]];
      },
      (m) => {
        m.instructions[2] = { ...m.instructions[2], data: Buffer.from([0]) };
      },
      (m) => {
        m.instructions[2] = { ...m.instructions[2], data: Buffer.from([1, 0]) };
      },
      (m) => {
        m.instructions[3] = { ...m.instructions[3], accountIndices: m.instructions[3].accountIndices!.slice(1) };
      },
    ];
    for (const factory of [input, callbackInput]) {
      for (const change of changes) await expect(validateOrderCancel(mutate(factory(), change))).rejects.toThrow();
      const data = Buffer.from("d5d96264e1cd4cb80600000063616e63656c", "hex");
      const malformed = [
        ...Array.from({ length: data.length }, (_, i) => data.subarray(0, i)),
        Buffer.concat([data, Buffer.from([0])]),
        ...[0, 8, 12].map((i) => {
          const bytes = Buffer.from(data);
          bytes[i] ^= 255;
          return bytes;
        }),
      ];
      for (const bytes of malformed)
        await expect(
          validateOrderCancel(
            mutate(factory(), (m) => {
              m.instructions[3] = { ...m.instructions[3], data: bytes };
            })
          )
        ).rejects.toThrow();
    }
  });

  it("rejects wrong independent expectations and all static privilege changes and preserves asynchronous scope", async () => {
    for (const key of [
      "receiver",
      "rentReceiver",
      "order",
      "referrerWallet",
      "initialCollateralToken",
      "finalOutputToken",
      "longToken",
      "shortToken",
    ] as const) {
      const request = input();
      request[key] = key === "receiver" || key === "rentReceiver" ? request.recentBlockhash : request.wallet;
      await expect(validateOrderCancel(request)).rejects.toThrow();
    }
    for (const change of [
      (r: OrderCancelValidationInput) => {
        r.computeUnitLimit++;
      },
      (r: OrderCancelValidationInput) => {
        r.computeUnitPrice++;
      },
      (r: OrderCancelValidationInput) => {
        r.callback = undefined;
      },
      (r: OrderCancelValidationInput) => {
        r.referrerWallet = undefined;
      },
      (r: OrderCancelValidationInput) => {
        r.callback!.shared_data = r.order;
      },
    ]) {
      const request = callbackInput();
      change(request);
      await expect(validateOrderCancel(request)).rejects.toThrow();
    }
    const message = getCompiledTransactionMessageDecoder().decode(
      getTransactionDecoder().decode(callbackInput().bytes).messageBytes
    );
    const lutMessage = getCompiledTransactionMessageDecoder().decode(
      getTransactionDecoder().decode(input().bytes).messageBytes
    );
    if (lutMessage.version !== 0) throw new Error("Expected v0 LUT fixture");
    for (const lookup of lutMessage.addressTableLookups!) {
      for (const index of [...lookup.writableIndexes, ...lookup.readonlyIndexes]) {
        const request = input();
        const tables = new Map(request.lookupTables);
        const accounts = [...tables.get(lookup.lookupTableAddress)!];
        accounts[index] = request.recentBlockhash;
        tables.set(lookup.lookupTableAddress, accounts);
        request.lookupTables = tables;
        expect(parseUnsignedOrderTransaction(request).status).toBe("parsed");
        await expect(validateOrderCancel(request)).rejects.toThrow();
      }
    }
    for (let index = 1; index < message.staticAccounts.length; index++) {
      await expect(
        validateOrderCancel(
          mutate(callbackInput(), (m) => {
            const boundary = m.staticAccounts.length - m.header.numReadonlyNonSignerAccounts;
            const other = index < boundary ? boundary : 1;
            [m.staticAccounts[index], m.staticAccounts[other]] = [m.staticAccounts[other], m.staticAccounts[index]];
            const remap = (i: number) => (i === index ? other : i === other ? index : i);
            m.instructions.forEach((ix, i) => {
              m.instructions[i] = {
                ...ix,
                programAddressIndex: remap(ix.programAddressIndex),
                accountIndices: ix.accountIndices?.map(remap),
              };
            });
          })
        )
      ).rejects.toThrow();
    }
    const request = callbackInput();
    const original = new Uint8Array(request.bytes);
    const validation = validateOrderCancel(request);
    request.bytes.fill(0);
    request.order = request.receiver = request.wallet;
    request.callback!.program = request.wallet;
    request.referrerWallet = undefined;
    request.initialCollateralToken = undefined;
    request.shouldUnwrapNativeToken = true;
    request.computeUnitPrice = 0n;
    request.lookupTables = new Map();
    const result = await validation;
    expect(result.bytes).toEqual(original);
    expect(result.order).toBe("4qgbPJmg3UB29cPArm2vbTLhVVSBPsuyNrhirZ9fH8pp");
  });
});
