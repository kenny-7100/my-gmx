import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Acceptance oracle only: never used to generate reference values or by production code.
const root = dirname(fileURLToPath(import.meta.url));
const [first, second] = process.argv.slice(2);
assert(first && second, "Usage: node verify.mjs FIRST.json SECOND.json");
assert.deepEqual(readFileSync(first), readFileSync(second), "Runs must be byte-identical");
const reference = JSON.parse(readFileSync(first, "utf8"));
const inputs = JSON.parse(readFileSync(join(root, "inputs.json"), "utf8"));
const hash = (path) =>
  createHash("sha256")
    .update(readFileSync(join(root, path)))
    .digest("hex");
for (const [key, path] of [
  ["source", "src/main.rs"],
  ["manifest", "Cargo.toml"],
  ["lock", "Cargo.lock"],
  ["input", "inputs.json"],
]) {
  assert.equal(reference.generator[`${key}_sha256`], hash(path));
}
assert.match(reference.generator.rustc, /^rustc 1\.90\.0 /);
assert.equal(reference.reference.commit, "7ce035b41a266cb5ddb0192e5d29deb0c7e67a72");
assert.equal(reference.cases.length, 71);
assert.equal(new Set(reference.cases.map((c) => c.id)).size, 71);
const unit = 10n ** 20n;
const min = (...values) => values.reduce((a, b) => (a < b ? a : b));
const ceil = (n, d) => (n + d - 1n) / d;
const operations = {};
let liquidationProbes = 0;

function verifyLiquidation(c) {
  const p = c.input.scenario;
  const size = BigInt(p.size_usd20);
  const entryIndex = BigInt(p.is_long ? p.entry_prices.index.max : p.entry_prices.index.min);
  const entryCollateral = BigInt((p.is_long_collateral ? p.entry_prices.long : p.entry_prices.short).min);
  const feeValue = (size * BigInt(p.order_fee_factor)) / unit;
  const openingCost = feeValue / entryCollateral;
  const collateralAmount = BigInt(p.collateral_amount) - openingCost;
  const tokens = p.is_long ? size / entryIndex : ceil(size, entryIndex);
  assert.deepEqual(
    c.output.opened,
    {
      collateral_amount: String(collateralAmount),
      execution_price: String(size / tokens),
      impact_usd20: "0",
      opening_cost_amount: String(openingCost),
      size_tokens: String(tokens),
      size_usd20: String(size),
    },
    c.id
  );
  const remaining = [];
  function reason(value, factor) {
    if (value < BigInt(p.min_collateral_usd20)) return "min collateral";
    if (value === 0n) return "<= 0";
    if (value < (size * BigInt(factor)) / unit) return "min collateral for leverage";
    return null;
  }
  const probes = p.probe_prices.map((prices) => {
    const index = BigInt(p.is_long ? prices.index.min : prices.index.max);
    const pnl = p.is_long ? tokens * index - size : size - tokens * index;
    // Every probe in this subset is loss-making; no side-profit cap is involved.
    assert(pnl < 0n, c.id);
    const collateralPrice = BigInt((p.is_long_collateral ? prices.long : prices.short).min);
    const collateralValue = collateralAmount * collateralPrice;
    const cost = feeValue / collateralPrice;
    const value = collateralValue + pnl - cost * collateralPrice;
    remaining.push(value);
    const liquidation = reason(value, p.liquidation_collateral_factor ?? p.min_collateral_factor);
    const margin = reason(value, p.min_collateral_factor);
    return {
      status: "ok",
      pnl_usd20: String(pnl),
      collateral_usd20: String(collateralValue),
      closing_cost_amount: String(cost),
      impact_usd20: "0",
      liquidatable: liquidation !== null,
      reason: liquidation,
      margin_insufficient: margin !== null,
      margin_reason: margin,
    };
  });
  assert.deepEqual(c.output, { status: "ok", opened: c.output.opened, probes }, c.id);
  // These are three adjacent raw price units around an analytically derived boundary,
  // not a coarse sample or a binary search that assumes a general liquidation curve.
  assert.equal(p.probe_prices.length, 3);
  for (let index = 1; index < 3; index++) {
    assert.equal(BigInt(p.probe_prices[index].index.min) - BigInt(p.probe_prices[index - 1].index.min), 1n);
  }
  assert(probes.some((v) => v.liquidatable) && probes.some((v) => !v.liquidatable), c.id);
  if (c.id.endsWith("-nonpositive")) {
    assert(remaining.some((v) => v <= 0n) && remaining.some((v) => v > 0n), c.id);
  }
  if (c.id.endsWith("-leverage")) {
    assert(
      probes.some((v) => !v.liquidatable && v.margin_insufficient),
      c.id
    );
  }
  if (c.id.endsWith("-fallback")) {
    assert(
      probes.every((v) => v.liquidatable === v.margin_insufficient && v.reason === v.margin_reason),
      c.id
    );
  }
  if (c.id.endsWith("-liquidation-fee-excluded")) {
    const peer = reference.cases.find((v) => v.id === c.id.replace("-liquidation-fee-excluded", "-closing-fee"));
    assert.deepEqual(c.output, peer.output, c.id);
  }
  liquidationProbes += probes.length;
}
for (let index = 0; index < reference.cases.length; index++) {
  const c = reference.cases[index];
  assert.equal(c.id, inputs.cases[index].id);
  assert.deepEqual(c.input, inputs.cases[index].input);
  const p = c.input;
  if (p.operation === "liquidation_check") {
    verifyLiquidation(c);
    operations[p.operation] = (operations[p.operation] ?? 0) + 1;
    continue;
  }
  const b = (key) => BigInt(p[key]);
  let expected;
  if (p.operation === "fee") {
    const fee = (b("amount") * b(p.balance_change === "improved" ? "positive_factor" : "negative_factor")) / unit;
    expected = { fee_amount: String(fee - (fee * b("combined_discount_factor")) / unit) };
  } else if (p.operation === "positive_impact_cap") {
    const impact = b("impact_usd20");
    const delta = b("size_delta_usd20");
    expected = {
      impact_usd20: String(
        impact < 0n
          ? impact
          : min(
              impact,
              b("pool_amount") * BigInt(p.index_price.min),
              ((delta < 0n ? -delta : delta) * b("max_positive_factor")) / unit
            )
      ),
    };
  } else {
    assert.equal(p.operation, "position_pnl");
    const size = b("position_size_usd20"),
      tokens = b("position_size_tokens"),
      delta = b("size_delta_usd20");
    const value = tokens * BigInt(p.is_long ? p.index_price.min : p.index_price.max);
    const raw = p.is_long ? value - size : size - value;
    const oi = b("side_oi_long_collateral_usd20") + b("side_oi_short_collateral_usd20");
    const oiValue =
      (b("side_oi_long_collateral_tokens") + b("side_oi_short_collateral_tokens")) *
      BigInt(p.is_long ? p.index_price.max : p.index_price.min);
    const poolPnl = p.is_long ? oiValue - oi : oi - oiValue;
    const poolValue = p.is_long
      ? b("long_pool_amount") * BigInt(p.long_price.min)
      : b("short_pool_amount") * BigInt(p.short_price.min);
    const cap = (poolValue * b("max_trader_pnl_factor")) / unit;
    const total = raw > 0n && poolPnl > cap && poolPnl > 0n ? (raw * cap) / poolPnl : raw;
    const deltaTokens = p.is_long ? ceil(tokens * delta, size) : (tokens * delta) / size;
    expected = {
      pnl_usd20: String((total * deltaTokens) / tokens),
      uncapped_pnl_usd20: String((raw * deltaTokens) / tokens),
      size_delta_tokens: String(deltaTokens),
      side_pool_pnl_usd20: String(poolPnl),
      side_pool_value_usd20: String(poolValue),
    };
    if (c.id.includes("-uncapped-")) assert.equal(total, raw, c.id);
    if (c.id.includes("-zero-cap-")) assert.equal(total, 0n, c.id);
  }
  for (const key of Object.keys(expected).filter((key) =>
    ["impact_usd20", "pnl_usd20", "uncapped_pnl_usd20"].includes(key)
  )) {
    expected[key.replace("20", "30")] = String(BigInt(expected[key]) * 10n ** 10n);
  }
  assert.deepEqual(c.output, { status: "ok", ...expected }, c.id);
  operations[p.operation] = (operations[p.operation] ?? 0) + 1;
}

const directory = mkdtempSync(join(tmpdir(), "gmsol-math-acceptance-"));
const binary = resolve(root, "target/debug/solana-trade-math-vectors");
let rejected = 0;
function run(suite) {
  const path = join(directory, "input.json");
  writeFileSync(path, JSON.stringify(suite));
  const result = spawnSync(binary, [path], { encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}
try {
  const invalid = [
    (s) => {
      s.schema_version = 2;
    },
    (s) => {
      s.cases = [];
    },
    (s) => {
      s.unknown = true;
    },
    (s) => {
      s.cases[0].id = "";
    },
    (s) => {
      s.cases[1].id = s.cases[0].id;
    },
    ...["01", "-1", "+1", "1.0", "340282366920938463463374607431768211456"].map((value) => (s) => {
      s.cases[1].input.amount = value;
    }),
    (s) => {
      s.cases[1].input.positive_factor = String(unit + 1n);
    },
    (s) => {
      s.cases[1].input.unknown = true;
    },
    (s) => {
      s.cases[15].input.index_decimals = 21;
    },
    (s) => {
      s.cases[15].input.index_price.min = "0";
    },
    (s) => {
      s.cases[15].input.index_price.min = s.cases[15].input.index_price.max + "0";
    },
    (s) => {
      s.cases[23].input.position_size_tokens = "0";
    },
    (s) => {
      s.cases[23].input.size_delta_usd20 = String(BigInt(s.cases[23].input.position_size_usd20) + 1n);
    },
    (s) => {
      s.cases[23].input.long_pool_amount = String(1n << 127n);
    },
    ...[
      (p) => {
        p.probe_prices = [];
      },
      (p) => {
        p.probe_prices[1].index.min = "0";
      },
      (p) => {
        p.long_decimals = 21;
      },
      (p) => {
        p.liquidation_collateral_factor = String(unit + 1n);
      },
      (p) => {
        delete p.liquidation_collateral_factor;
      },
      (p) => {
        p.size_usd20 = "0";
      },
      (p) => {
        p.unknown = true;
      },
      (p) => {
        p.collateral_amount = "1";
      },
      (p) => {
        p.deposit_long_amount = "0";
        p.deposit_short_amount = "0";
      },
    ].map((mutate) => (s) => {
      mutate(s.cases[43].input.scenario);
    }),
  ];

  for (const mutate of invalid) {
    const suite = structuredClone(inputs);
    mutate(suite);
    const result = run(suite);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "", "Failed runs must not emit partial vectors");
    assert(result.stderr.length > 0);
    rejected++;
  }
  const modelError = structuredClone(inputs.cases[15]);
  modelError.input.size_delta_usd20 = String(-(1n << 127n));
  modelError.input.max_positive_factor = String(unit);
  const result = run({ schema_version: 1, cases: [modelError] });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout).cases[0].output;
  assert.equal(output.status, "error");
  assert.equal(typeof output.message, "string");
  assert(output.message.length > 0);
  const liquidationError = structuredClone(inputs.cases[43]);
  liquidationError.input.scenario.probe_prices[1].index = {
    min: String((1n << 128n) - 1n),
    max: String((1n << 128n) - 1n),
  };
  const liquidationResult = run({ schema_version: 1, cases: [liquidationError] });
  assert.equal(liquidationResult.status, 0, liquidationResult.stderr);
  const liquidationOutput = JSON.parse(liquidationResult.stdout).cases[0].output;
  assert.equal(liquidationOutput.probes[0].status, "ok");
  assert.equal(liquidationOutput.probes[1].status, "error");
  assert(liquidationOutput.probes[1].message.length > 0);
  assert.equal(liquidationOutput.probes[2].status, "ok");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
process.stdout.write(
  JSON.stringify(
    {
      status: "passed",
      cases: reference.cases.length,
      operations,
      liquidationProbes,
      malformedRejected: rejected,
      modelErrorDistinctFromZero: true,
      liquidationProbeErrorDistinctFromResult: true,
      deterministic: true,
      provenance: "verified",
      temporaryDirectoryCleanup: "passed",
    },
    null,
    2
  ) + "\n"
);
