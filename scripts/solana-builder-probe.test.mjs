import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import test from "node:test";

import { decodeOrderData, runProbe } from "./solana-builder-probe.mjs";
import guard from "../tools/gmx-api-offline/network-guard.cjs";

const fixtures = JSON.parse(
  readFileSync(new URL("../tools/solana-builder-probe/unsigned-fixtures.json", import.meta.url))
);
const transactions = (item) => item.transactions.flat();
const creates = (tx) => tx.instructions.filter((ix) => ix.name === "create_order_v2");

test("actual pinned builders preserve unsigned ABI, setup order, LUT resolution and atomic order grouping", async () => {
  const assertOffline = guard.installNetworkGuard("solana-builder-probe");
  const previous = Object.getOwnPropertyDescriptor(globalThis, "module");
  try {
    const tableReport = {
      ...fixtures.input.lutObservation,
      tables: fixtures.input.luts.map(([address, addresses]) => ({ address, addresses })),
    };
    for (const luts of [undefined, tableReport]) {
      const result = await runProbe(luts);
      assert.equal(result.local.approvedWasmSha256, fixtures.sdk.approvedWasmSha256);
      assert.equal(result.idlSha256, fixtures.idlSha256);
      assert.equal(result.cases.length, 31);
      assert.deepEqual(
        result.rejectedInputs.map((item) => item.field),
        ["amount", "min_output"]
      );
      const single = result.cases.find((item) => item.name === "MarketIncrease-force-position-false");
      const [tx] = transactions(single);
      assert.equal(transactions(single).length, 1);
      const names = tx.instructions.map((ix) => ix.name);
      assert.ok(names.indexOf("prepare_position") < names.indexOf("create_order_v2"));
      assert.equal(creates(tx).length, 1);
      assert.ok(tx.size <= 1232);
      assert.equal(tx.lookupCount > 0, Boolean(luts));
      const combined = result.cases.find((item) => item.name === "increase-tp-sl-force-position-true");
      const containingOrders = transactions(combined).filter((item) => creates(item).length > 0);
      if (luts) {
        assert.equal(containingOrders.length, 1);
        assert.equal(creates(containingOrders[0]).length, 3);
        assert.ok(containingOrders[0].size <= 1232);
      } else {
        assert.ok(containingOrders.length > 1, "Without these LUTs the observed combination is not atomic");
      }
      for (const item of result.cases.filter((row) => row.input)) {
        for (const ix of transactions(item).flatMap((row) => row.instructions)) {
          if (ix.name === "create_order_v2") {
            const params = ix.decodedArgs.params;
            assert.equal(params.size_delta_value, item.input.size);
            assert.equal(params.initial_collateral_delta_amount, item.input.amount ?? 0n);
            assert.equal(params.is_long, item.input.is_long);
            assert.equal(params.min_output, item.input.min_output ?? 0n);
            assert.equal(params.acceptable_price, item.input.acceptable_price ?? null);
            assert.equal(params.trigger_price, item.input.trigger_price ?? null);
            assert.equal(
              params.valid_from_ts,
              item.input.valid_from_ts === undefined ? null : BigInt(item.input.valid_from_ts)
            );
            assert.equal(params.decrease_position_swap_type, item.input.decrease_position_swap_type ?? null);
            assert.equal(
              params.kind,
              item.name === "short-explicit-options"
                ? "LimitDecrease"
                : item.name === "zero-and-absent-options"
                  ? "MarketDecrease"
                  : item.name.startsWith("extra-nonce")
                    ? "MarketIncrease"
                    : item.name.split("-force")[0]
            );
            assert.equal(params.execution_lamports, 300_000n);
            assert.equal(params.swap_path_length, 0);
            assert.equal(params.is_collateral_long, true);
            assert.equal(params.should_unwrap_native_token, item.name !== "zero-and-absent-options");
            assert.equal(ix.decodedArgs.callback_version, null);
            assert.equal(Buffer.from(ix.decodedArgs.nonce).toString("hex"), ix.nonceHex);
          }
          if (ix.name === "update_order_v2") {
            const expected = Object.fromEntries(
              ["size_delta_value", "acceptable_price", "trigger_price", "min_output", "valid_from_ts"].map((key) => [
                key,
                item.input[key] === undefined ? null : BigInt(item.input[key]),
              ])
            );
            assert.deepEqual(ix.decodedArgs.params, expected);
          }
          if (ix.name === "close_order_v2") assert.deepEqual(ix.decodedArgs, item.input);
        }
      }
      for (const item of result.cases.filter((row) => row.name.startsWith("increase-tp-sl"))) {
        const args = transactions(item)
          .flatMap(creates)
          .map((ix) => ix.decodedArgs.params);
        assert.deepEqual(
          args.map((row) => row.kind),
          ["MarketIncrease", "LimitDecrease", "StopLossDecrease"]
        );
        assert.deepEqual(
          args.map((row) => row.initial_collateral_delta_amount),
          [10_000_000n, 0n, 0n]
        );
        assert.deepEqual(
          args.map((row) => row.trigger_price),
          [null, 250n * 10n ** 11n, 100n * 10n ** 11n]
        );
      }
      assert.deepEqual(result.orderCapabilities.exportedOrderFunctions, [
        "CreateOrdersBuilder",
        "OrderSimulationOutput",
        "close_orders",
        "create_orders",
        "create_orders_builder",
        "update_orders",
      ]);
      for (const item of result.cases.filter((row) => row.callback)) {
        const ix = transactions(item)
          .flatMap((row) => row.instructions)
          .find((row) => row.decodedArgs);
        assert.equal(ix.namedAccounts.callback_authority, result.orderCapabilities.callbackAuthority);
        assert.equal(ix.namedAccounts.callback_program, item.callback.program);
        assert.equal(ix.namedAccounts.callback_shared_data_account, item.callback.shared_data);
        assert.equal(ix.namedAccounts.callback_partitioned_data_account, item.callback.partitioned_data);
        if (ix.name === "create_order_v2") assert.equal(ix.decodedArgs.callback_version, item.callback.version);
        if (item.referrer) {
          assert.equal(ix.namedAccounts.referrer_user, result.orderCapabilities.referrerUser);
          assert.notEqual(ix.namedAccounts.referrer_user, item.referrer);
        }
      }
      for (const item of result.cases.filter(
        (row) => /-force-position-(false|true)$/.test(row.name) || row.name === "decrease-force-position-parallel"
      )) {
        if (item.name.startsWith("increase-tp-sl")) continue;
        const instructions = transactions(item).flatMap((row) => row.instructions);
        const setup = instructions.find((ix) => ix.name === "prepare_position");
        const create = instructions.find((ix) => ix.name === "create_order_v2");
        const expected =
          item.name.includes("Increase") || item.forceCreatePositions === true || item.name.endsWith("parallel");
        assert.equal(Boolean(setup), expected);
        if (setup) {
          assert.equal(setup.namedAccounts.position, create.namedAccounts.position);
          assert.ok(instructions.indexOf(setup) < instructions.indexOf(create));
        }
      }
      assert.deepEqual(
        result.rejectedBuilders.map((item) => item.name),
        ["missing-market-hint", "foreign-collateral", "amount-above-u64"]
      );
      for (const item of result.cases.filter((row) => row.nativeInput)) {
        const rows = transactions(item);
        assert.ok(rows.every((row) => row.size <= 1232));
        const instructions = rows.flatMap((row) => row.instructions);
        const create = instructions.find((ix) => ix.name === "create_order_v2");
        assert.equal(create.decodedArgs.params.initial_collateral_delta_amount, item.nativeInput.amount);
        assert.equal(create.decodedArgs.params.size_delta_value, item.nativeInput.size);
        const transfers = instructions.filter((ix) => ix.program === "11111111111111111111111111111111");
        const syncs = instructions.filter(
          (ix) => ix.program === result.nativeCapabilities.tokenProgram && ix.dataBase64 === "EQ=="
        );
        if (item.name === "native-pay-skip-wrap-false") {
          assert.equal(transfers.length, 1);
          const transfer = transfers[0];
          const bytes = Buffer.from(transfer.dataBase64, "base64");
          assert.equal(bytes.length, 12);
          assert.equal(bytes.readUInt32LE(), 2);
          assert.equal(bytes.readBigUInt64LE(4), item.nativeInput.amount);
          assert.deepEqual(transfer.accounts, [result.input.payer, result.nativeCapabilities.nativeAta]);
          assert.equal(syncs.length, 1);
          assert.deepEqual(syncs[0].accounts, [result.nativeCapabilities.nativeAta]);
          assert.ok(instructions.indexOf(transfer) < instructions.indexOf(syncs[0]));
          assert.ok(instructions.indexOf(syncs[0]) < instructions.indexOf(create));
          assert.equal(create.namedAccounts.initial_collateral_token_source, result.nativeCapabilities.nativeAta);
        } else {
          assert.equal(transfers.length, 0);
          assert.equal(syncs.length, 0);
        }
        if (item.skipUnwrap !== undefined)
          assert.equal(create.decodedArgs.params.should_unwrap_native_token, !item.skipUnwrap);
        if (item.name === "explicit-swap-path") {
          assert.equal(create.decodedArgs.params.swap_path_length, 1);
          assert.equal(create.accounts.at(-1), result.nativeCapabilities.swapMarket);
          assert.equal(
            create.namedAccounts.initial_collateral_token,
            result.nativeCapabilities.market.shortTokenAddress
          );
        }
        if (item.name === "pnl-token-to-collateral")
          assert.equal(create.decodedArgs.params.decrease_position_swap_type, "PnlTokenToCollateralToken");
      }
      for (const item of result.cases.filter((row) => row.name.startsWith("native-combo-callback"))) {
        const rows = transactions(item);
        assert.ok(rows.every((row) => row.size <= 1232));
        assert.equal(rows.flatMap(creates).length, 3);
        assert.ok(
          rows.filter((row) => creates(row).length > 0).length > 1,
          "These native combinations must not be treated as atomic orders"
        );
      }
      const nonceCases = result.cases.filter((item) => item.name.startsWith("extra-nonce-field"));
      const nonces = nonceCases.map((item) => transactions(item).flatMap(creates)[0].nonceHex);
      assert.ok(nonces.every((nonce) => nonce.length === 64 && nonce !== "2a".repeat(32)));
      assert.notEqual(nonces[0], nonces[1]);
      for (const [name, instruction] of [
        ["update-order", "update_order_v2"],
        ["close-order", "close_order_v2"],
      ]) {
        const item = result.cases.find((row) => row.name === name);
        assert.ok(transactions(item).some((row) => row.instructions.some((ix) => ix.name === instruction)));
      }
      for (const item of result.cases)
        for (const row of transactions(item)) {
          assert.ok(Object.values(row.signatures).every((signature) => signature === null));
          for (const ix of row.instructions) {
            if (ix.namedAccounts?.rent_receiver) assert.equal(ix.namedAccounts.rent_receiver, result.input.payer);
          }
        }
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "module"), previous);
  } finally {
    assertOffline();
  }
});

test("rejects truncated, trailing, unknown, malformed option and enum order data", () => {
  const instructions = fixtures.cases
    .flatMap(transactions)
    .flatMap((tx) => tx.instructions)
    .filter((ix) => ["create_order_v2", "update_order_v2", "close_order_v2"].includes(ix.name));
  for (const ix of instructions) {
    const bytes = Buffer.from(ix.dataBase64, "base64");
    for (let end = 0; end < bytes.length; end++) assert.throws(() => decodeOrderData(ix.name, bytes.subarray(0, end)));
    assert.throws(() => decodeOrderData(ix.name, Buffer.concat([bytes, Buffer.from([0])])));
  }
  const ix = instructions.find((item) => item.name === "create_order_v2");
  const bytes = Buffer.from(ix.dataBase64, "base64");
  for (const [index, value] of [
    [0, bytes[0] ^ 1],
    [40, 255],
    [41, 2],
    [75, 2],
  ]) {
    const changed = Buffer.from(bytes);
    changed[index] = value;
    assert.throws(() => decodeOrderData(ix.name, changed));
  }
  const close = Buffer.from(instructions.find((item) => item.name === "close_order_v2").dataBase64, "base64");
  close[close.length - 1] = 255;
  assert.throws(() => decodeOrderData("close_order_v2", close));
  assert.throws(() => decodeOrderData("prepare_user", bytes));
});
