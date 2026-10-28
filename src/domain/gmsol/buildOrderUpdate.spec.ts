// @vitest-environment node
import {
  address,
  getBase58Encoder,
  getProgramDerivedAddress,
  getBase64Decoder,
  getStructDecoder,
  getU64Decoder,
  getNullableDecoder,
  getU128Decoder,
  getI64Decoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";
import { describe, expect, it } from "vitest";

import { GMSOL_STORE_ADDRESS, GMSOL_STORE_PROGRAM_ID } from "config/gmsol/program";

import { buildOrderCancel } from "./buildOrderCancel";
import type { OrderCancelInput } from "./buildOrderCancel";
import { buildOrderUpdate } from "./buildOrderUpdate";
import type { OrderUpdateInput } from "./buildOrderUpdate";
import { loadPinnedSdk } from "../../../scripts/solana-sdk-vectors.mjs";
import callbacks from "../../../tools/solana-builder-probe/capability-fixtures.json";
import fixtures from "../../../tools/solana-builder-probe/unsigned-fixtures.json";

const base = fixtures.cases.find((c) => c.name === "update-order")!;
const callbackCase = callbacks.cases.find((c) => c.name === "update-with-callback")!;
const loadSdk = async () => (await loadPinnedSdk()).sdk;
function input(): OrderUpdateInput {
  return {
    network: "solana-mainnet",
    owner: fixtures.input.payer,
    order: base.order!,
    market: fixtures.input.market.marketTokenAddress,
    kind: "LimitIncrease",
    recentBlockhash: fixtures.input.blockhash,
    lookupTables: new Map(fixtures.input.luts.map(([key, accounts]) => [key as string, accounts as string[]])),
    callback: undefined,
    changes: { sizeDeltaUsd: 100n * 10n ** 30n, acceptablePrice: 200n * 10n ** 21n },
  };
}
function params(bytes: Uint8Array) {
  const tx = getTransactionDecoder().decode(bytes);
  const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  const ix = message.instructions.find(
    (i) => message.staticAccounts[i.programAddressIndex] === GMSOL_STORE_PROGRAM_ID
  )!;
  const { discriminator: _, ...fields } = getStructDecoder([
    ["discriminator", getU64Decoder()],
    ["size_delta_value", getNullableDecoder(getU128Decoder())],
    ["acceptable_price", getNullableDecoder(getU128Decoder())],
    ["trigger_price", getNullableDecoder(getU128Decoder())],
    ["min_output", getNullableDecoder(getU128Decoder())],
    ["valid_from_ts", getNullableDecoder(getI64Decoder())],
  ]).decode(ix.data!);
  return fields;
}

function instructions(bytes: Uint8Array, request: Pick<OrderUpdateInput, "lookupTables">) {
  const tx = getTransactionDecoder().decode(bytes);
  const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  const writable: string[] = [],
    readonly: string[] = [];
  for (const lookup of message.version === 0 ? message.addressTableLookups ?? [] : []) {
    const accounts = request.lookupTables.get(lookup.lookupTableAddress)!;
    writable.push(...Array.from(lookup.writableIndexes, (i) => accounts[i]));
    readonly.push(...Array.from(lookup.readonlyIndexes, (i) => accounts[i]));
  }
  const accounts = [...message.staticAccounts, ...writable, ...readonly];
  return message.instructions.map((ix) => ({
    program: accounts[ix.programAddressIndex],
    accounts: Array.from(ix.accountIndices ?? [], (i) => accounts[i]),
    dataBase64: getBase64Decoder().decode(ix.data ?? new Uint8Array()),
  }));
}
const expectedInstructions = (sample: typeof base | typeof callbackCase) =>
  sample.transactions[0][0].instructions.map(({ program, accounts, dataBase64 }) => ({
    program,
    accounts,
    dataBase64,
  }));

describe("unsigned order update adapter", () => {
  it("matches pinned WASM fixture instructions, accounts and LUTs, including an existing callback", async () => {
    const request = input();
    const built = await buildOrderUpdate(request, loadSdk);
    expect(instructions(built.bytes, request)).toEqual(expectedInstructions(base));
    request.callback = callbackCase.callback!;
    request.order = callbackCase.transactions[0][0].instructions.find(
      (ix) => ix.name === "update_order_v2"
    )!.namedAccounts!.order!;
    request.changes = { sizeDeltaUsd: 100n * 10n ** 30n };
    expect(instructions((await buildOrderUpdate(request, loadSdk)).bytes, request)).toEqual(
      expectedInstructions(callbackCase)
    );
  });

  it("preserves zero versus absent and converts decrease min output without applying mint decimals twice", async () => {
    for (const kind of ["LimitIncrease", "LimitDecrease", "StopLossDecrease"] as const) {
      const request = input();
      request.kind = kind;
      request.changes = { triggerPrice: 0n, minOutput: 50n * 10n ** 30n, validFromTs: -37 };
      expect(params((await buildOrderUpdate(request, loadSdk)).bytes)).toEqual({
        size_delta_value: null,
        acceptable_price: null,
        trigger_price: 0n,
        min_output: 50n * 10n ** BigInt(kind === "LimitIncrease" ? 30 : 20),
        valid_from_ts: -37n,
      });
    }
  });

  it("rejects unrelated LUTs and snapshots mutable inputs across SDK loading", async () => {
    for (const mutate of [
      (r: OrderUpdateInput) => {
        r.lookupTables = new Map([[fixtures.input.blockhash, [r.owner]]]);
      },
    ]) {
      const request = input();
      mutate(request);
      await expect(buildOrderUpdate(request, loadSdk)).rejects.toThrow();
    }
    const request = input();
    const promise = buildOrderUpdate(request, loadSdk);
    request.owner = fixtures.input.blockhash;
    request.changes.sizeDeltaUsd = 0n;
    request.lookupTables = new Map();
    const result = await promise;
    expect(result.owner).toBe(fixtures.input.payer);
    expect(params(result.bytes).size_delta_value).toBe(100n * 10n ** 20n);
  });
});

const closeSample = fixtures.cases.find((c) => c.name === "close-order")!;
const closeCallbackSample = callbacks.cases.find((c) => c.name === "close-with-callback-referrer")!;
function cancelInput(): OrderCancelInput {
  const update = input();
  return {
    network: update.network,
    owner: update.owner,
    order: closeSample.order!,
    receiver: update.owner,
    rentReceiver: update.owner,
    recentBlockhash: update.recentBlockhash,
    lookupTables: update.lookupTables,
    callback: undefined,
    referrerWallet: undefined,
    initialCollateralToken: fixtures.input.market.longTokenAddress,
    finalOutputToken: fixtures.input.market.longTokenAddress,
    longToken: fixtures.input.market.longTokenAddress,
    shortToken: fixtures.input.market.shortTokenAddress,
    shouldUnwrapNativeToken: false,
  };
}

describe("unsigned single order cancellation", () => {
  it("matches real WASM fixtures and independently derives referrer user from the confirmed wallet", async () => {
    const request = cancelInput();
    expect(instructions((await buildOrderCancel(request, loadSdk)).bytes, request)).toEqual(
      expectedInstructions(closeSample)
    );
    const expected = closeCallbackSample.transactions[0][0].instructions.find((ix) => ix.name === "close_order_v2")!;
    request.order = expected.namedAccounts!.order!;
    request.callback = closeCallbackSample.callback!;
    request.referrerWallet = closeCallbackSample.referrer!;
    const actual = instructions((await buildOrderCancel(request, loadSdk)).bytes, request);
    expect(actual).toEqual(expectedInstructions(closeCallbackSample));
    const [user] = await getProgramDerivedAddress({
      programAddress: address(GMSOL_STORE_PROGRAM_ID),
      seeds: [
        new TextEncoder().encode("user"),
        getBase58Encoder().encode(GMSOL_STORE_ADDRESS),
        getBase58Encoder().encode(closeCallbackSample.referrer!),
      ],
    });
    const index = Object.keys(expected.namedAccounts!).indexOf("referrer_user");
    expect(actual.find((ix) => ix.program === GMSOL_STORE_PROGRAM_ID)!.accounts[index]).toBe(user);
  });

  it("enforces receivers and native output accounts and preserves the original context during loading", async () => {
    for (const key of ["receiver", "rentReceiver", "referrerWallet"] as const) {
      const request = cancelInput();
      request[key] = key === "referrerWallet" ? request.owner : request.recentBlockhash;
      await expect(buildOrderCancel(request, loadSdk)).rejects.toThrow();
    }
    const request = cancelInput();
    const wrappedSol = "So11111111111111111111111111111111111111112";
    request.initialCollateralToken = request.finalOutputToken = request.longToken = request.shortToken = wrappedSol;
    request.shouldUnwrapNativeToken = true;
    request.callback = structuredClone(closeCallbackSample.callback!);
    request.referrerWallet = closeCallbackSample.referrer!;
    const original = structuredClone(request);
    const pending = buildOrderCancel(request, loadSdk);
    request.owner = request.receiver = request.rentReceiver = request.recentBlockhash;
    request.shouldUnwrapNativeToken = false;
    request.callback.program = request.recentBlockhash;
    request.referrerWallet = undefined;
    request.initialCollateralToken = undefined;
    request.lookupTables = new Map();
    const result = await pending;
    expect(result.owner).toBe(original.owner);
    const actual = instructions(result.bytes, original).find((ix) => ix.program === GMSOL_STORE_PROGRAM_ID)!;
    const expected = closeSample.transactions[0][0].instructions.find((ix) => ix.name === "close_order_v2")!;
    expect(actual.accounts[Object.keys(expected.namedAccounts!).indexOf("callback_program")]).toBe(
      original.callback!.program
    );
    for (const name of [
      "initial_collateral_token_ata",
      "final_output_token_ata",
      "long_token_ata",
      "short_token_ata",
    ]) {
      expect(actual.accounts[Object.keys(expected.namedAccounts!).indexOf(name)]).toBe(original.owner);
    }
  });
});
