/* eslint-disable local-rules/solana-import-boundaries -- Offline diagnostic CLI; never imported by the application. */
import {
  getAddressEncoder,
  getCompiledTransactionMessageDecoder,
  getProgramDerivedAddress,
  getTransactionDecoder,
} from "@solana/kit";
import { encodeBase58 } from "ethers";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, TextDecoder } from "node:util";

import { loadPinnedSdk } from "./solana-sdk-vectors.mjs";
import { GMSOL_MARKETS } from "../src/config/gmsol/markets.ts";
import { GMSOL_STORE_ADDRESS, GMSOL_STORE_PROGRAM_ID } from "../src/config/gmsol/program.ts";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2);
const IDL_COMMIT = "c6778dc9bf6444f9037c3b0d2dc219c857e1b45d";
const idlBytes = execFileSync("git", [
  "-C",
  fileURLToPath(new URL("../gmx-solana", import.meta.url)),
  "show",
  `${IDL_COMMIT}:crates/programs/idls/gmsol_store.json`,
]);
const idl = JSON.parse(idlBytes);
export const storeIdlEvidence = { commit: IDL_COMMIT, sha256: hash(idlBytes), idl };
const payer = encodeBase58(new Uint8Array(32).fill(7));
const blockhash = encodeBase58(new Uint8Array(32).fill(9));
const market = GMSOL_MARKETS.find((item) => item.marketTokenAddress === "6UU9sF5fryafHDYPcmVcV7ucfnYs6iMVcvb8p7SBQgTc");
assert.ok(market, "Expected the configured SOL/USDC market");

// Diagnostic decoder for the three pinned order instructions, not a signing allowlist.
export function decodeOrderData(name, bytes) {
  assert.ok(["create_order_v2", "update_order_v2", "close_order_v2"].includes(name), "Unsupported order instruction");
  const definition = idl.instructions.find((item) => item.name === name);
  const data = Buffer.from(bytes);
  assert.ok(
    data.length <= 16_384 && data.subarray(0, 8).equals(Buffer.from(definition.discriminator)),
    "Invalid order discriminator"
  );
  let offset = 8;
  function take(length) {
    assert.ok(Number.isSafeInteger(length) && length >= 0 && offset + length <= data.length, "Truncated order data");
    const value = data.subarray(offset, offset + length);
    offset += length;
    return value;
  }
  function decode(type) {
    if (type === "u8") return take(1)[0];
    if (type === "bool") {
      const tag = take(1)[0];
      assert.ok(tag <= 1, "Invalid boolean tag");
      return tag === 1;
    }
    if (type === "u64") return take(8).readBigUInt64LE();
    if (type === "i64") return take(8).readBigInt64LE();
    if (type === "u128") {
      const value = take(16);
      return value.readBigUInt64LE() + (value.readBigUInt64LE(8) << 64n);
    }
    if (type === "string") return new TextDecoder("utf-8", { fatal: true }).decode(take(take(4).readUInt32LE()));
    if (type.option) {
      const tag = take(1)[0];
      assert.ok(tag <= 1, "Invalid option tag");
      return tag === 0 ? null : decode(type.option);
    }
    if (type.array) {
      assert.deepEqual(type.array, ["u8", 32], "Unsupported array layout");
      return Array.from(take(32));
    }
    const layout = idl.types.find((item) => item.name === type.defined?.name)?.type;
    assert.ok(layout, "Unsupported order layout");
    if (layout.kind === "struct")
      return Object.fromEntries(layout.fields.map((field) => [field.name, decode(field.type)]));
    assert.equal(layout.kind, "enum");
    const variant = layout.variants[take(1)[0]];
    assert.ok(variant && !variant.fields, "Invalid order enum");
    return variant.name;
  }
  const args = Object.fromEntries(definition.args.map((arg) => [arg.name, decode(arg.type)]));
  assert.equal(offset, data.length, "Trailing order data");
  return args;
}

function inspect(group, luts) {
  try {
    return group.serialize().map((batch) =>
      batch.map((serialized) => {
        const bytes = new Uint8Array(serialized);
        const tx = getTransactionDecoder().decode(bytes);
        assert.ok(
          Object.values(tx.signatures).every((signature) => signature === null),
          "Expected unsigned bytes"
        );
        const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
        assert.equal(message.staticAccounts[0], payer);
        assert.equal(message.lifetimeToken, blockhash);
        const lookups = message.addressTableLookups ?? [];
        const writable = [];
        const readonly = [];
        for (const lookup of lookups) {
          const table = luts.get(lookup.lookupTableAddress);
          assert.ok(table, "Unresolved LUT");
          for (const index of lookup.writableIndexes) {
            assert.ok(table[index]);
            writable.push(table[index]);
          }
          for (const index of lookup.readonlyIndexes) {
            assert.ok(table[index]);
            readonly.push(table[index]);
          }
        }
        const accounts = [...message.staticAccounts, ...writable, ...readonly];
        const instructions = message.instructions.map((ix) => {
          const program = accounts[ix.programAddressIndex];
          assert.ok(program);
          const data = Buffer.from(ix.data ?? []);
          const definition =
            program === GMSOL_STORE_PROGRAM_ID
              ? idl.instructions.find((item) => Buffer.from(item.discriminator).equals(data.subarray(0, 8)))
              : undefined;
          if (program === GMSOL_STORE_PROGRAM_ID)
            assert.ok(definition, `Unknown gmsol discriminator ${data.subarray(0, 8).toString("hex")}`);
          const resolved = Array.from(ix.accountIndices ?? [], (index) => {
            assert.ok(accounts[index]);
            return accounts[index];
          });
          if (definition) assert.ok(resolved.length >= definition.accounts.length, "Truncated gmsol account list");
          const named = definition
            ? Object.fromEntries(definition.accounts.map((item, index) => [item.name, resolved[index]]))
            : undefined;
          if (named?.owner) assert.equal(named.owner, payer);
          if (named?.receiver) assert.equal(named.receiver, payer);
          return {
            program,
            name: definition?.name,
            accounts: resolved,
            namedAccounts: named,
            dataBase64: data.toString("base64"),
            decodedArgs: ["create_order_v2", "update_order_v2", "close_order_v2"].includes(definition?.name)
              ? decodeOrderData(definition.name, data)
              : undefined,
            nonceHex: definition?.name.startsWith("create_order") ? data.subarray(8, 40).toString("hex") : undefined,
          };
        });
        return {
          size: bytes.length,
          sha256: hash(bytes),
          bytesBase64: Buffer.from(bytes).toString("base64"),
          signatures: tx.signatures,
          version: message.version,
          blockhash: message.lifetimeToken,
          lookupCount: lookups.length,
          instructions,
        };
      })
    );
  } finally {
    group.free();
  }
}

export async function runProbe(lutReport) {
  // The pinned getrandom Node binding expects CommonJS module.require. Use real Node crypto, never a fake RNG.
  const previous = Object.getOwnPropertyDescriptor(globalThis, "module");
  Object.defineProperty(globalThis, "module", {
    configurable: true,
    value: { require: createRequire(import.meta.url) },
  });
  try {
    const { sdk, local } = await loadPinnedSdk();
    const luts = new Map(lutReport?.tables.map((table) => [table.address, table.addresses]) ?? []);
    const params = {
      market_token: market.marketTokenAddress,
      is_long: true,
      size: 100n * 10n ** 20n,
      amount: 10_000_000n,
      min_output: 0n,
      acceptable_price: 200n * 10n ** 11n,
    };
    const options = {
      recent_blockhash: blockhash,
      payer,
      program: { id: GMSOL_STORE_PROGRAM_ID, store: GMSOL_STORE_ADDRESS },
      collateral_or_swap_out_token: market.longTokenAddress,
      hints: new Map([
        [market.marketTokenAddress, { long_token: market.longTokenAddress, short_token: market.shortTokenAddress }],
      ]),
      transaction_group: { luts },
    };
    const cases = [];
    for (const force of [false, true]) {
      for (const kind of ["MarketIncrease", "LimitIncrease", "MarketDecrease", "LimitDecrease", "StopLossDecrease"]) {
        const input = { ...params, trigger_price: kind.startsWith("Market") ? undefined : 150n * 10n ** 11n };
        const builder = sdk.create_orders_builder(kind, [input], { ...options, force_create_positions: force });
        const transactions = inspect(builder.build_with_options(), luts);
        cases.push({ name: `${kind}-force-position-${force}`, input, forceCreatePositions: force, transactions });
      }
      const increase = sdk.create_orders_builder("MarketIncrease", [params], {
        ...options,
        force_create_positions: force,
      });
      for (const [kind, trigger] of [
        ["LimitDecrease", 250n],
        ["StopLossDecrease", 100n],
      ]) {
        const child = sdk.create_orders_builder(
          kind,
          [{ ...params, amount: 0n, trigger_price: trigger * 10n ** 11n }],
          options
        );
        try {
          increase.merge(child);
        } finally {
          child.free();
        }
      }
      cases.push({
        name: `increase-tp-sl-force-position-${force}`,
        transactions: inspect(increase.build_with_options(), luts),
      });
    }
    // The installed high-level type has no nonce input. Probe extra JS fields explicitly rather than assuming they work.
    for (let repeat = 0; repeat < 2; repeat++) {
      const builder = sdk.create_orders_builder("MarketIncrease", [{ ...params, nonce: Array(32).fill(42) }], options);
      cases.push({
        name: `extra-nonce-field-${repeat}`,
        input: params,
        requestedNonceHex: "2a".repeat(32),
        transactions: inspect(builder.build_with_options(), luts),
      });
    }
    const explicit = {
      ...params,
      is_long: false,
      size: (1n << 100n) + 17n,
      amount: (1n << 53n) + 19n,
      min_output: 23n,
      trigger_price: 29n,
      acceptable_price: 31n,
      valid_from_ts: -37,
      decrease_position_swap_type: "CollateralToPnlToken",
    };
    cases.push({
      name: "short-explicit-options",
      input: explicit,
      transactions: inspect(sdk.create_orders_builder("LimitDecrease", [explicit], options).build_with_options(), luts),
    });
    const zeroAndAbsent = {
      ...params,
      size: 0n,

      acceptable_price: 0n,
      valid_from_ts: 0,
      decrease_position_swap_type: "NoSwap",
    };
    delete zeroAndAbsent.amount;
    delete zeroAndAbsent.min_output;
    const rejectedInputs = [];
    for (const field of ["amount", "min_output"]) {
      assert.throws(
        () => sdk.create_orders_builder("MarketDecrease", [{ ...params, [field]: undefined }], options).free(),
        /invalid type: unit value, expected u128/
      );
      rejectedInputs.push({
        field,
        value: "explicit undefined",
        status: "rejected",
        expectedError: "invalid type: unit value, expected u128",
      });
    }
    cases.push({
      name: "zero-and-absent-options",
      input: zeroAndAbsent,
      transactions: inspect(
        sdk
          .create_orders_builder("MarketDecrease", [zeroAndAbsent], { ...options, skip_unwrap_native_on_receive: true })
          .build_with_options(),
        luts
      ),
    });
    const order = cases[0].transactions
      .flat()
      .flatMap((tx) => tx.instructions)
      .find((ix) => ix.name === "create_order_v2").namedAccounts.order;
    for (const [name, update] of [
      ["update-order", { size_delta_value: params.size, acceptable_price: params.acceptable_price }],
      [
        "update-explicit-options",
        {
          size_delta_value: (1n << 100n) + 17n,
          acceptable_price: 0n,
          trigger_price: 29n,
          min_output: 0n,
          valid_from_ts: -37,
        },
      ],
    ]) {
      cases.push({
        name,
        input: update,
        order,
        transactions: inspect(
          sdk.update_orders({
            recent_blockhash: blockhash,
            payer,
            program: options.program,
            transaction_group: { luts },
            orders: new Map([
              [
                order,
                {
                  params: update,
                  hint: { market_token: market.marketTokenAddress, callback: undefined },
                },
              ],
            ]),
          }),
          luts
        ),
      });
    }
    cases.push({
      name: "close-order",
      input: { reason: "cancel" },
      order,
      transactions: inspect(
        sdk.close_orders({
          recent_blockhash: blockhash,
          payer,
          program: options.program,
          transaction_group: { luts },
          orders: new Map([
            [
              order,
              {
                owner: payer,
                receiver: payer,
                rent_receiver: payer,
                referrer: undefined,
                initial_collateral_token: market.longTokenAddress,
                final_output_token: market.longTokenAddress,
                long_token: market.longTokenAddress,
                short_token: market.shortTokenAddress,
                should_unwrap_native_token: false,
                callback: undefined,
              },
            ],
          ]),
        }),
        luts
      ),
    });
    const callback = {
      version: 7,
      program: encodeBase58(new Uint8Array(32).fill(18)),
      shared_data: encodeBase58(new Uint8Array(32).fill(19)),
      partitioned_data: encodeBase58(new Uint8Array(32).fill(20)),
    };
    const referrer = encodeBase58(new Uint8Array(32).fill(21));
    const encoder = getAddressEncoder();
    const [referrerUser] = await getProgramDerivedAddress({
      programAddress: GMSOL_STORE_PROGRAM_ID,
      seeds: [Buffer.from("user"), encoder.encode(GMSOL_STORE_ADDRESS), encoder.encode(referrer)],
    });
    const [callbackAuthority] = await getProgramDerivedAddress({
      programAddress: GMSOL_STORE_PROGRAM_ID,
      seeds: [Buffer.from("callback")],
    });
    cases.push({
      name: "create-with-callback",
      callback,
      transactions: inspect(
        sdk.create_orders_builder("MarketIncrease", [params], { ...options, callback }).build_with_options(),
        luts
      ),
    });
    cases.push({
      name: "decrease-force-position-parallel",
      transactions: inspect(
        sdk
          .create_orders_builder("MarketDecrease", [params], { ...options, force_create_positions_in_parallel: true })
          .build_with_options(),
        luts
      ),
    });
    cases.push({
      name: "update-with-callback",
      callback,
      transactions: inspect(
        sdk.update_orders({
          recent_blockhash: blockhash,
          payer,
          program: options.program,
          transaction_group: { luts },
          orders: new Map([
            [
              order,
              {
                params: { size_delta_value: params.size },
                hint: { market_token: market.marketTokenAddress, callback },
              },
            ],
          ]),
        }),
        luts
      ),
    });
    cases.push({
      name: "close-with-callback-referrer",
      callback,
      referrer,
      transactions: inspect(
        sdk.close_orders({
          recent_blockhash: blockhash,
          payer,
          program: options.program,
          transaction_group: { luts },
          orders: new Map([
            [
              order,
              {
                owner: payer,
                receiver: payer,
                rent_receiver: payer,
                referrer,
                initial_collateral_token: market.longTokenAddress,
                final_output_token: market.longTokenAddress,
                long_token: market.longTokenAddress,
                short_token: market.shortTokenAddress,
                should_unwrap_native_token: false,
                callback,
              },
            ],
          ]),
        }),
        luts
      ),
    });
    const nativeMarket = GMSOL_MARKETS.find(
      (item) => item.marketTokenAddress === "BwN2FWixP5JyKjJNyD1YcRKN1XhgvFtnzrPrkfyb4DkW"
    );
    assert.ok(nativeMarket, "Expected the configured WSOL/USDC market");
    const nativeParams = { ...params, market_token: nativeMarket.marketTokenAddress, amount: 123_456_789n };
    const nativeOptions = {
      ...options,
      collateral_or_swap_out_token: nativeMarket.longTokenAddress,
      hints: new Map([
        [
          nativeMarket.marketTokenAddress,
          { long_token: nativeMarket.longTokenAddress, short_token: nativeMarket.shortTokenAddress },
        ],
      ]),
    };
    for (const skip of [false, true]) {
      cases.push({
        name: `native-pay-skip-wrap-${skip}`,
        skipWrap: skip,
        nativeInput: nativeParams,
        transactions: inspect(
          sdk
            .create_orders_builder("MarketIncrease", [nativeParams], {
              ...nativeOptions,
              skip_wrap_native_on_pay: skip,
            })
            .build_with_options(),
          luts
        ),
      });
      cases.push({
        name: `native-receive-skip-unwrap-${skip}`,
        skipUnwrap: skip,
        nativeInput: nativeParams,
        transactions: inspect(
          sdk
            .create_orders_builder("MarketDecrease", [nativeParams], {
              ...nativeOptions,
              skip_unwrap_native_on_receive: skip,
            })
            .build_with_options(),
          luts
        ),
      });
    }
    cases.push({
      name: "explicit-swap-path",
      nativeInput: nativeParams,
      transactions: inspect(
        sdk
          .create_orders_builder("MarketIncrease", [nativeParams], {
            ...nativeOptions,
            pay_token: nativeMarket.shortTokenAddress,
            swap_path: [nativeMarket.marketTokenAddress],
          })
          .build_with_options(),
        luts
      ),
    });
    cases.push({
      name: "pnl-token-to-collateral",
      nativeInput: nativeParams,
      transactions: inspect(
        sdk
          .create_orders_builder(
            "MarketDecrease",
            [{ ...nativeParams, decrease_position_swap_type: "PnlTokenToCollateralToken" }],
            nativeOptions
          )
          .build_with_options(),
        luts
      ),
    });
    for (const withCallback of [false, true]) {
      const comboOptions = { ...nativeOptions, ...(withCallback ? { callback } : {}) };
      const builder = sdk.create_orders_builder("MarketIncrease", [nativeParams], {
        ...comboOptions,
        force_create_positions: true,
      });
      for (const [kind, trigger] of [
        ["LimitDecrease", 250n],
        ["StopLossDecrease", 100n],
      ]) {
        const child = sdk.create_orders_builder(
          kind,
          [{ ...nativeParams, amount: 0n, trigger_price: trigger * 10n ** 11n }],
          comboOptions
        );
        try {
          builder.merge(child);
        } finally {
          child.free();
        }
      }
      cases.push({
        name: `native-combo-callback-${withCallback}`,
        transactions: inspect(builder.build_with_options(), luts),
      });
    }
    const rejectedBuilders = [];
    for (const [name, input, override, pattern] of [
      ["missing-market-hint", params, { hints: new Map() }, /hint.*not provided/],
      ["foreign-collateral", params, { collateral_or_swap_out_token: callback.program }, /invalid hint:.*collateral/],
      ["amount-above-u64", { ...params, amount: 1n << 64n }, {}, /out of range integral type conversion/],
    ]) {
      let observed;
      assert.throws(() => {
        try {
          const group = sdk
            .create_orders_builder("MarketIncrease", [input], { ...options, ...override })
            .build_with_options();
          group.free();
        } catch (error) {
          observed = String(error);
          throw error;
        }
      }, pattern);
      rejectedBuilders.push({ name, status: "rejected", error: observed });
    }
    const tokenProgram = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
    const [nativeAta] = await getProgramDerivedAddress({
      programAddress: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      seeds: [encoder.encode(payer), encoder.encode(tokenProgram), encoder.encode(nativeMarket.longTokenAddress)],
    });
    const [swapMarket] = await getProgramDerivedAddress({
      programAddress: GMSOL_STORE_PROGRAM_ID,
      seeds: [
        Buffer.from("market"),
        encoder.encode(GMSOL_STORE_ADDRESS),
        encoder.encode(nativeMarket.marketTokenAddress),
      ],
    });
    const exportedOrderFunctions = Object.keys(sdk).filter(
      (key) => /order/i.test(key) && typeof sdk[key] === "function"
    );
    return {
      scope: "pinned-wasm-unsigned-builder-probe",
      status: "observed",
      checkedAt: new Date().toISOString(),
      local,
      probeSha256: hash(await readFile(new URL(import.meta.url))),
      idlSha256: hash(idlBytes),
      idlCommit: IDL_COMMIT,
      input: {
        payer,
        payerProvenance: "offline public-key fixture; no private key or wallet",
        blockhash,
        blockhashProvenance: "offline structural fixture; not a live blockhash",
        market,
        luts: Array.from(luts),
        lutObservation: lutReport ? { checkedAt: lutReport.checkedAt, slot: lutReport.slot } : "none",
        callback: null,
        referrer: "not exposed by this create ABI",
        options: { forceCreatePositions: "case-specific" },
      },
      excluded: [
        "simulation",
        "signing",
        "broadcast",
        "live LUT authority/current contents",
        "program compatibility",
        "full ABI allowlist",
        "business execution",
      ],
      orderCapabilities: {
        exportedOrderFunctions,
        callbackAuthority,
        referrerUser,
        nonce:
          "No public low-level CreateOrder constructor or create_order instruction export in the pinned wrapper; high-level nonce extra field ignored",
        positionExistence:
          "No RPC or account-state input; default increase prepares position, default decrease assumes it exists",
      },
      nativeCapabilities: { market: nativeMarket, nativeAta, swapMarket, tokenProgram },
      rejectedBuilders,
      rejectedInputs,
      cases,
    };
  } finally {
    if (previous) Object.defineProperty(globalThis, "module", previous);
    else delete globalThis.module;
  }
}

async function main() {
  const { values } = parseArgs({ options: { "lut-report": { type: "string" } } });
  const capture = values["lut-report"] ? await readFile(values["lut-report"]) : undefined;
  const report = await runProbe(capture ? JSON.parse(capture.toString("utf8")) : undefined);
  if (capture) report.lutReportSha256 = hash(capture);
  process.stdout.write(`${json(report)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
  });
}
