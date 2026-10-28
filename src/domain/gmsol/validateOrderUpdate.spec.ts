// @vitest-environment node
import {
  getBase64Decoder,
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
  getTransactionDecoder,
  address,
} from "@solana/kit";
import { describe, expect, it } from "vitest";

import { validateOrderUpdate } from "./validateOrderUpdate";
import type { OrderUpdateValidationInput } from "./validateOrderUpdate";
import callbacks from "../../../tools/solana-builder-probe/capability-fixtures.json";
import parameters from "../../../tools/solana-builder-probe/parameter-fixtures.json";
import fixtures from "../../../tools/solana-builder-probe/unsigned-fixtures.json";

const basic = fixtures.cases.find((c) => c.name === "update-order")!;
const callbackCase = callbacks.cases.find((c) => c.name === "update-with-callback")!;
const parameterCase = parameters.cases.find((c) => c.name === "update-explicit-options")!;
function input(): OrderUpdateValidationInput {
  return {
    network: "solana-mainnet",
    wallet: fixtures.input.payer,
    recentBlockhash: fixtures.input.blockhash,
    bytes: Buffer.from(basic.transactions[0][0].bytesBase64, "base64"),
    lookupTables: new Map(fixtures.input.luts.map(([key, accounts]) => [key as string, accounts as string[]])),
    order: basic.order!,
    kind: "LimitIncrease",
    marketToken: fixtures.input.market.marketTokenAddress,
    callback: undefined,
    params: {
      sizeDeltaValue: 100n * 10n ** 20n,
      acceptablePrice: 200n * 10n ** 11n,
      triggerPrice: undefined,
      minOutput: undefined,
      validFromTs: undefined,
    },
    computeUnitLimit: 200_000,
    computeUnitPrice: 50_000n,
  };
}
type Message = ReturnType<ReturnType<typeof getCompiledTransactionMessageDecoder>["decode"]>;
function mutate(request: OrderUpdateValidationInput, change: (message: Message) => Message | void) {
  const tx = getTransactionDecoder().decode(request.bytes);
  const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  const changed = change(message) ?? message;
  request.bytes = Buffer.concat([
    request.bytes.subarray(0, 65),
    Buffer.from(getBase64Decoder().decode(getCompiledTransactionMessageEncoder().encode(changed)), "base64"),
  ]);
  return request;
}
function callbackInput() {
  const request = input();
  request.bytes = Buffer.from(callbackCase.transactions[0][0].bytesBase64, "base64");
  request.order = "4qgbPJmg3UB29cPArm2vbTLhVVSBPsuyNrhirZ9fH8pp";
  request.params.acceptablePrice = undefined;
  request.callback = {
    program: callbackCase.callback!.program,
    sharedData: callbackCase.callback!.shared_data,
    partitionedData: callbackCase.callback!.partitioned_data,
  };
  return request;
}

describe("deterministic unsigned order update validation", () => {
  it("accepts fixed WASM updates with resolved LUTs, callbacks and full-width zero/signed parameters", async () => {
    const full = input();
    full.bytes = Buffer.from(parameterCase.transactions[0][0].bytesBase64, "base64");
    full.order = "Ft18pDb9XFMkpmdXLqRkHcsnz7G5LhDaMNnZbf6y3gS";
    full.params = {
      sizeDeltaValue: 1267650600228229401496703205393n,
      acceptablePrice: 0n,
      triggerPrice: 29n,
      minOutput: 0n,
      validFromTs: -37n,
    };
    for (const request of [input(), callbackInput(), full]) {
      const result = await validateOrderUpdate(request);
      expect(result).toEqual({
        status: "validated-update",
        network: request.network,
        wallet: request.wallet,
        recentBlockhash: request.recentBlockhash,
        order: request.order,
        kind: request.kind,
        marketToken: request.marketToken,
        bytes: new Uint8Array(request.bytes),
      });
      expect(result.bytes).not.toBe(request.bytes);
    }
    for (const [timestamp, encoded] of [
      [-(1n << 63n), "0000000000000080"],
      [(1n << 63n) - 1n, "ffffffffffffff7f"],
      [0n, "0000000000000000"],
    ] as const) {
      const request = input();
      request.params = {
        sizeDeltaValue: undefined,
        acceptablePrice: undefined,
        triggerPrice: undefined,
        minOutput: (1n << 128n) - 1n,
        validFromTs: timestamp,
      };
      mutate(request, (m) => {
        m.instructions[2] = {
          ...m.instructions[2],
          data: Buffer.from("c3afcf21abf629b000000001" + "ff".repeat(16) + "01" + encoded, "hex"),
        };
      });
      expect((await validateOrderUpdate(request)).status).toBe("validated-update");
    }
  });

  it("rejects every substituted role, program, extra action, malformed data and budget change", async () => {
    const changes: ((m: Message) => void)[] = [
      (m) => {
        m.staticAccounts[m.instructions[0].programAddressIndex] = address(fixtures.input.market.marketTokenAddress);
      },
      (m) => {
        m.instructions[2] = { ...m.instructions[2], programAddressIndex: m.instructions[0].programAddressIndex };
      },
      (m) => {
        m.instructions[2] = { ...m.instructions[2], accountIndices: m.instructions[2].accountIndices!.slice(1) };
      },
      ...Array.from({ length: 10 }, (_, i) => (m: Message) => {
        m.instructions[2].accountIndices![i] = i === 0 ? m.instructions[2].accountIndices![1] : 0;
      }),
      ...[0, 1, 2].map((i) => (m: Message) => {
        m.instructions[i] = { ...m.instructions[i], programAddressIndex: 0 };
      }),
      (m) => {
        m.instructions.push(m.instructions[2]);
      },
      (m) => {
        m.instructions.splice(0, 1);
      },
      (m) => {
        [m.instructions[0], m.instructions[1]] = [m.instructions[1], m.instructions[0]];
      },
      ...[0, 1].map((i) => (m: Message) => {
        m.instructions[i] = { ...m.instructions[i], accountIndices: [0] };
      }),
    ];
    for (const factory of [input, callbackInput]) {
      for (const change of changes) await expect(validateOrderUpdate(mutate(factory(), change))).rejects.toThrow();
      const original = Buffer.from(
        getBase64Decoder().decode(
          getCompiledTransactionMessageDecoder().decode(getTransactionDecoder().decode(factory().bytes).messageBytes)
            .instructions[2].data!
        ),
        "base64"
      );
      const malformed = [
        ...Array.from({ length: original.length }, (_, i) => original.subarray(0, i)),
        Buffer.concat([original, Buffer.from([0])]),
        ...[0, 8, 9, 25].map((index) => {
          const data = Buffer.from(original);
          data[index] ^= 2;
          return data;
        }),
      ];
      for (const data of malformed)
        await expect(
          validateOrderUpdate(
            mutate(factory(), (m) => {
              m.instructions[2] = { ...m.instructions[2], data };
            })
          )
        ).rejects.toThrow();
      for (const index of [0, 1])
        await expect(
          validateOrderUpdate(
            mutate(factory(), (m) => {
              m.instructions[index] = { ...m.instructions[index], data: Buffer.from([0]) };
            })
          )
        ).rejects.toThrow();
    }
  });

  it("rejects independent expectation mismatches and privilege changes and snapshots across PDA derivation", async () => {
    const requests = [input(), input(), input(), input(), input(), callbackInput(), callbackInput()];
    requests[0].order = requests[0].wallet;
    requests[1].marketToken = requests[1].wallet;
    requests[2].computeUnitLimit++;
    requests[3].computeUnitPrice++;
    requests[4].params.triggerPrice = 0n;
    requests[5].callback = undefined;
    requests[6].callback!.sharedData = requests[6].wallet;
    for (const request of requests) await expect(validateOrderUpdate(request)).rejects.toThrow();
    for (const key of ["sizeDeltaValue", "acceptablePrice", "triggerPrice", "minOutput", "validFromTs"] as const) {
      const request = input();
      request.params[key] = 1n;
      await expect(validateOrderUpdate(request)).rejects.toThrow();
    }
    for (const change of [
      (m: Message) => {
        return {
          ...m,
          header: { ...m.header, numReadonlyNonSignerAccounts: m.header.numReadonlyNonSignerAccounts - 1 },
        };
      },
      (m: Message) => {
        return {
          ...m,
          header: { ...m.header, numReadonlyNonSignerAccounts: m.header.numReadonlyNonSignerAccounts + 1 },
        };
      },
      (m: Message) => {
        return { ...m, header: { ...m.header, numSignerAccounts: m.header.numSignerAccounts + 1 } };
      },
    ])
      await expect(validateOrderUpdate(mutate(callbackInput(), change))).rejects.toThrow();
    for (let index = 1; index < 11; index++) {
      await expect(
        validateOrderUpdate(
          mutate(callbackInput(), (m) => {
            const firstReadonly = m.staticAccounts.length - m.header.numReadonlyNonSignerAccounts;
            const other = index < firstReadonly ? firstReadonly : 1;
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
    const expectedBytes = new Uint8Array(request.bytes);
    const validation = validateOrderUpdate(request);
    request.bytes.fill(0);
    request.params.sizeDeltaValue = 0n;
    request.callback!.program = request.wallet;
    request.order = request.wallet;
    request.computeUnitPrice = 0n;
    request.lookupTables = new Map();
    expect((await validation).bytes).toEqual(expectedBytes);
  });
});
