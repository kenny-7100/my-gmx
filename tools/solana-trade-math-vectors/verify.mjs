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
assert.equal(reference.cases.length, 223);
assert.equal(new Set(reference.cases.map((c) => c.id)).size, 223);
const unit = 10n ** 20n;
const min = (...values) => values.reduce((a, b) => (a < b ? a : b));
const ceil = (n, d) => (n + d - 1n) / d;
const operations = {};
let liquidationProbes = 0;
let increasePriceProbes = 0;
let impactLiquidationProbes = 0;
let borrowingCheckpoints = 0;
let borrowingSettlements = 0;
let fundingCheckpoints = 0;
let fundingSettlements = 0;
let dynamicFundingCheckpoints = 0;
let distributionCheckpoints = 0;
let distributionSettlements = 0;

function verifyDynamicFunding(c) {
  const p = c.input.scenario;
  const abs = (v) => (v < 0n ? -v : v);
  const sign = (v) => (v < 0n ? -1n : 1n);
  let long = 0n,
    short = 0n,
    stored = 0n;
  const checkpoints = p.steps.map((step) => {
    const additions = [BigInt(step.add_long_usd20), BigInt(step.add_short_usd20)];
    long += additions[0];
    short += additions[1];
    const actions = additions.map((size, i) =>
      size === 0n
        ? null
        : {
            cost_amount: "0",
            size_tokens: String(i === 0 ? size / BigInt(p.prices.index.max) : ceil(size, BigInt(p.prices.index.min))),
            claimable_funding_amounts: ["0", "0"],
          }
    );
    const previous = stored;
    const ratio = (abs(long - short) * unit) / (long + short);
    const same = (stored > 0n && long > short) || (stored < 0n && long < short);
    const seconds = BigInt(step.elapsed_seconds);
    if (!same || ratio > BigInt(p.stable_threshold)) {
      stored += sign(long - short) * ((ratio * BigInt(p.increase_factor_per_second)) / unit) * seconds;
    } else if (ratio < BigInt(p.decrease_threshold)) {
      const delta = BigInt(p.decrease_factor_per_second) * seconds;
      stored = sign(stored) * (abs(stored) <= delta ? 1n : abs(stored) - delta);
    }
    stored = sign(stored) * min(abs(stored), BigInt(p.max_factor_per_second));
    const magnitude = abs(stored) < BigInt(p.min_factor_per_second) ? BigInt(p.min_factor_per_second) : abs(stored);
    const longsPay = stored >= 0n && magnitude > 0n;
    const payer = longsPay ? long : short,
      receiver = longsPay ? short : long;
    const value = (payer * magnitude * seconds) / unit;
    const scale = 10n ** 30n,
      price = BigInt(p.prices.short.max);
    const deltas = [true, true, false, false].map((side, i) => ({
      funding_per_size: String(i % 2 === 1 && side === longsPay ? ceil(ceil(value * scale, payer), price) : 0n),
      claimable_per_size: String(i % 2 === 1 && side !== longsPay ? (value * scale) / receiver / price : 0n),
    }));
    return {
      long_oi_usd20: String(long),
      short_oi_usd20: String(short),
      previous_factor: String(previous),
      rate_magnitude: String(magnitude),
      longs_pay: longsPay,
      next_factor: String(stored),
      deltas,
      actions,
    };
  });
  assert.deepEqual(c.output, { status: "ok", checkpoints }, c.id);
  const first = checkpoints[0],
    last = checkpoints.at(-1);
  if (c.id.endsWith("-reverse")) {
    assert.equal(checkpoints[1].longs_pay, first.longs_pay, c.id);
    assert.notEqual(last.longs_pay, first.longs_pay, c.id);
  }
  if (["-stable", "-decrease-equality", "-stable-equality", "-balanced"].some((s) => c.id.endsWith(s)))
    assert.equal(last.next_factor, first.next_factor, c.id);
  if (c.id.endsWith("-growth")) assert(abs(BigInt(last.next_factor)) > abs(BigInt(first.next_factor)), c.id);
  if (c.id.endsWith("-decay")) assert(abs(BigInt(last.next_factor)) < abs(BigInt(first.next_factor)), c.id);
  if (c.id.endsWith("-signum")) assert.equal(abs(BigInt(last.next_factor)), 1n, c.id);
  if (c.id.endsWith("-max")) assert.equal(abs(BigInt(first.next_factor)), BigInt(p.max_factor_per_second), c.id);
  if (c.id.endsWith("-min") || c.id.endsWith("-zero-min"))
    assert(BigInt(first.rate_magnitude) > abs(BigInt(first.next_factor)), c.id);
  if (c.id.endsWith("-zero")) assert.equal(first.rate_magnitude, "0", c.id);
  dynamicFundingCheckpoints += checkpoints.length;
}

function verifyFunding(c) {
  const distribution = c.input.operation === "funding_distribution";
  const p = distribution
    ? {
        ...c.input.scenario,
        long_collateral_amount: "10000000000",
        short_collateral_amount: "1000000000",
        next_size_usd20: String(unit),
        next_long_collateral_amount: "1000000000",
        next_short_collateral_amount: "100000000",
      }
    : c.input.scenario;
  const sizes = distribution
    ? p.sizes_usd20.map(BigInt)
    : [p.long_size_usd20, p.long_size_usd20, p.short_size_usd20, p.short_size_usd20].map(BigInt);
  const matrix = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ];
  const long = sizes[0] + sizes[1],
    short = sizes[2] + sizes[3];
  const longsPay = long > short;
  const payer = longsPay ? long : short,
    receiver = longsPay ? short : long;
  const difference = long > short ? long - short : short - long;
  const rawRate = (((difference * unit) / (long + short)) * BigInt(p.funding_factor)) / unit;
  const rate = long === 0n || short === 0n ? 0n : min(rawRate, BigInt(p.max_factor_per_second));
  const adjustment = 10n ** 10n,
    scale = adjustment * unit;
  const fees = [0n, 0n, 0n, 0n],
    claims = [0n, 0n, 0n, 0n];
  const posSize = (side, col) => sizes[(side ? 0 : 2) + (col ? 0 : 1)];
  const pending = (side, col, index) =>
    posSize(side, col) === 0n
      ? null
      : {
          cost_amount: String(ceil(posSize(side, col) * fees[index], scale)),
          claimable_amounts: [
            String((posSize(side, col) * claims[side ? 0 : 2]) / scale),
            String((posSize(side, col) * claims[side ? 1 : 3]) / scale),
          ],
        };
  const opened = matrix.map(([side, col]) => {
    const size = posSize(side, col),
      price = BigInt(side ? p.prices.index.max : p.prices.index.min);
    if (size === 0n) return null;
    return {
      cost_amount: "0",
      size_tokens: String(side ? size / price : ceil(size, price)),
      claimable_funding_amounts: ["0", "0"],
    };
  });
  const checkpoints = p.elapsed_seconds.map((seconds) => {
    const value = (payer * rate * BigInt(seconds)) / unit;
    const deltas = matrix.map(([side, col], index) => {
      const payerCollateral = posSize(longsPay, col);
      const collateralValue = payer === 0n ? 0n : (value * payerCollateral) / payer;
      const price = BigInt((col ? p.prices.long : p.prices.short).max);
      const fee =
        side === longsPay && payerCollateral > 0n ? ceil(ceil(collateralValue * scale, payerCollateral), price) : 0n;
      const claim = side !== longsPay && receiver > 0n ? (collateralValue * scale) / receiver / price : 0n;
      fees[index] += fee;
      claims[index] += claim;
      return { funding_per_size: String(fee), claimable_per_size: String(claim) };
    });
    return {
      elapsed_seconds: seconds,
      next_factor_per_second: "0",
      deltas,
      pending: matrix.map(([side, col], index) => pending(side, col, index)),
    };
  });
  const settlements = matrix.map(([side, col], index) => {
    const due = pending(side, col, index);
    if (due === null) return null;
    const cost = BigInt(due.cost_amount);
    return [1n, 2n].map((attempt) => ({
      cost_amount: attempt === 1n ? due.cost_amount : "0",
      claimable_funding_amounts: attempt === 1n ? due.claimable_amounts : ["0", "0"],
      collateral_amount: String(
        BigInt(col ? p.long_collateral_amount : p.short_collateral_amount) +
          attempt * BigInt(col ? p.next_long_collateral_amount : p.next_short_collateral_amount) -
          cost
      ),
      size_usd20: String(posSize(side, col) + attempt * BigInt(p.next_size_usd20)),
      funding_snapshot: String(fees[index]),
      claimable_snapshots: [String(claims[side ? 0 : 2]), String(claims[side ? 1 : 3])],
      pending_cost_amount: "0",
      pending_claimable_amounts: ["0", "0"],
      market_funding_per_size: String(fees[index]),
    }));
  });
  assert.deepEqual(c.output, { status: "ok", adjustment: String(adjustment), opened, checkpoints, settlements }, c.id);
  for (const col of [true, false]) {
    const paid = matrix.reduce(
      (total, [, collateral], index) =>
        total + (collateral === col && settlements[index] ? BigInt(settlements[index][0].cost_amount) : 0n),
      0n
    );
    const claimed = settlements.reduce(
      (total, attempts) => total + (attempts ? BigInt(attempts[0].claimable_funding_amounts[col ? 0 : 1]) : 0n),
      0n
    );
    assert(paid >= claimed, c.id);
  }
  if (c.id.endsWith("-rate-capped")) assert(rate > 0n && rate < rawRate, c.id);
  if (c.id.endsWith("-tiny-rounding")) {
    assert(
      settlements.some((a) => BigInt(a[0].cost_amount) > 0n),
      c.id
    );
    assert(
      settlements.every((a) => a[0].claimable_funding_amounts.every((v) => v === "0")),
      c.id
    );
  }
  if (c.id.endsWith("-elapsed") && !c.id.endsWith("-no-elapsed")) {
    for (const [index, [side]] of matrix.entries())
      if (side !== longsPay)
        assert(
          settlements[index][0].claimable_funding_amounts.every((v) => BigInt(v) > 0n),
          c.id
        );
  }
  if (
    c.id.endsWith("-zero-cap") ||
    c.id.endsWith("-zero-factor") ||
    c.id.endsWith("-balanced") ||
    c.id.endsWith("-no-elapsed")
  )
    assert(
      settlements.every((a) => a[0].cost_amount === "0" && a[0].claimable_funding_amounts.every((v) => v === "0")),
      c.id
    );
  if (distribution) {
    distributionCheckpoints += checkpoints.length;
    distributionSettlements += settlements.filter(Boolean).length * 2;
    if (c.id.endsWith("-mixed-dust")) {
      assert(rate > 0n, c.id);
      assert(
        settlements.filter(Boolean).some((a) => BigInt(a[0].cost_amount) > 0n),
        c.id
      );
      assert(
        settlements.filter(Boolean).every((a) => a[0].claimable_funding_amounts.every((v) => v === "0")),
        c.id
      );
    }
    if (c.id.endsWith("-mixed-cap")) assert(rate > 0n && rate < rawRate, c.id);
    if (c.id.includes("-receiver-")) {
      for (const [index, [side]] of matrix.entries()) {
        if (side !== longsPay && settlements[index])
          assert(
            settlements[index][0].claimable_funding_amounts.every((v) => BigInt(v) > 0n),
            c.id
          );
      }
    }
    if (long === 0n || short === 0n) {
      assert(
        checkpoints.every((c) => c.deltas.every((d) => d.funding_per_size === "0" && d.claimable_per_size === "0")),
        c.id
      );
      assert(
        settlements
          .filter(Boolean)
          .every((a) => a.every((v) => v.cost_amount === "0" && v.claimable_funding_amounts.every((x) => x === "0"))),
        c.id
      );
    }
  } else {
    fundingCheckpoints += checkpoints.length;
    fundingSettlements += settlements.length * 2;
  }
}

function verifyBorrowing(c) {
  const p = c.input.scenario;
  const size = BigInt(p.size_usd20),
    nextSize = BigInt(p.next_size_usd20);
  const entry = BigInt(p.is_long ? p.prices.index.max : p.prices.index.min);
  const tokens = p.is_long ? size / entry : ceil(size, entry);
  const nextTokens = p.is_long ? nextSize / entry : ceil(nextSize, entry);
  const reserved = p.is_long ? tokens * BigInt(p.prices.index.max) : size;
  const pool = BigInt(p.is_long ? p.deposit_long_amount : p.deposit_short_amount);
  const poolPrice = BigInt((p.is_long ? p.prices.long : p.prices.short).min);
  const rate = (((reserved * unit) / (pool * poolPrice)) * BigInt(p.borrowing_factor)) / unit;
  let cumulative = 0n;
  const checkpoints = p.elapsed_seconds.map((seconds) => {
    const before = (size * cumulative) / unit;
    cumulative += rate * BigInt(seconds);
    const after = (size * cumulative) / unit;
    return {
      elapsed_seconds: seconds,
      pending_before_update_usd20: String(before),
      projected_pending_usd20: String(after),
      pending_after_update_usd20: String(after),
      long_cumulative_factor: String(p.is_long ? cumulative : 0n),
      short_cumulative_factor: String(p.is_long ? 0n : cumulative),
    };
  });
  const value = (size * cumulative) / unit;
  const collateralPrice = BigInt((p.is_long_collateral ? p.prices.long : p.prices.short).min);
  const amount = value / collateralPrice;
  const receiver = (amount * BigInt(p.receiver_factor)) / unit;
  const forPool = amount - receiver;
  const liquidity = BigInt(p.is_long_collateral ? p.deposit_long_amount : p.deposit_short_amount);
  const settlements = [1n, 2n].map((index) => ({
    cost_amount: String(index === 1n ? amount : 0n),
    paid_fee_usd20: String(index === 1n ? value : 0n),
    receiver_amount: String(index === 1n ? receiver : 0n),
    pool_amount: String(index === 1n ? forPool : 0n),
    claimable_funding_amounts: ["0", "0"],
    collateral_amount: String(BigInt(p.collateral_amount) + index * BigInt(p.next_collateral_amount) - amount),
    size_usd20: String(size + index * nextSize),
    size_tokens: String(tokens + index * nextTokens),
    position_borrowing_factor: String(cumulative),
    pending_borrowing_usd20: "0",
    total_borrowing_usd20: String(((size + index * nextSize) * cumulative) / unit),
    liquidity_collateral_amount: String(liquidity + forPool),
    claimable_fee_collateral_amount: String(receiver),
  }));
  assert.deepEqual(
    c.output,
    {
      status: "ok",
      opened: { cost_amount: "0", size_tokens: String(tokens), claimable_funding_amounts: ["0", "0"] },
      factor_per_second: String(rate),
      checkpoints,
      settlements,
    },
    c.id
  );
  if (c.id.endsWith("-no-elapsed") || c.id.endsWith("-zero-factor")) assert.equal(value, 0n, c.id);
  if (c.id.endsWith("-raw-dust")) {
    assert(value > 0n, c.id);
    if (!p.is_long_collateral) assert.equal(amount, 0n, c.id);
  }
  if (c.id.endsWith("-raw-first-unit")) assert(amount > 0n, c.id);
  if (c.id.endsWith("-receiver-split")) assert(receiver > 0n && forPool > 0n, c.id);
  if (c.id.endsWith("-full-receiver")) assert.equal(receiver, amount, c.id);
  borrowingCheckpoints += checkpoints.length;
  borrowingSettlements += settlements.length;
}

function verifyIncrease(c) {
  const p = c.input.scenario;
  const b = (key) => BigInt(p[key]);
  const size = b("size_usd20"),
    seed = b("seed_size_usd20"),
    pool = b("impact_pool_amount");
  const low = BigInt(p.prices.index.min),
    high = BigInt(p.prices.index.max);
  const positive = min(b("positive_impact_factor"), b("negative_impact_factor"));
  const negative = b("negative_impact_factor");
  const apply = (value, factor) => (value < unit ? 0n : (value * factor) / unit);
  const next = p.seed_is_long === p.is_long ? seed + size : seed > size ? seed - size : size - seed;
  let raw;
  if (p.seed_is_long !== p.is_long && size > seed) {
    raw = apply(seed, positive) - apply(next, negative);
  } else if (next < seed) {
    raw = apply(seed, positive) - apply(next, positive);
  } else {
    raw = apply(seed, negative) - apply(next, negative);
  }
  const impact = raw > 0n ? min(raw, pool * low, (size * b("max_positive_factor")) / unit) : raw;
  const amount = impact > 0n ? impact / high : -ceil(-impact, low);
  const base = p.is_long ? size / high : ceil(size, low);
  const tokens = p.is_long ? base + amount : base - amount;
  const execution = size / tokens;
  const seedImpact = -apply(seed, negative);
  const seedAmount = -ceil(-seedImpact, low);
  const seedBase = p.seed_is_long ? seed / high : ceil(seed, low);
  const seedTokens = p.seed_is_long ? seedBase + seedAmount : seedBase - seedAmount;
  const baseline = {
    status: "ok",
    impact_usd20: String(impact),
    impact_amount: String(amount),
    size_tokens: String(tokens),
    size_usd20: String(size),
    collateral_amount: p.collateral_amount,
    cost_amount: "0",
    execution_price: String(execution),
    claimable_funding_amounts: ["0", "0"],
    impact_pool_amount: String(pool - amount),
  };
  assert.deepEqual(
    p.acceptable_prices,
    [-1n, 0n, 1n].map((delta) => String(execution + delta)),
    c.id
  );
  const probes = p.acceptable_prices.map((price) =>
    (p.is_long ? execution <= BigInt(price) : execution >= BigInt(price))
      ? baseline
      : {
          status: "error",
          message: "invalid argument: order not fulfillable at acceptable price",
        }
  );
  assert.deepEqual(
    c.output,
    {
      status: "ok",
      uncapped_impact_usd20: String(raw),
      capped_impact_usd20: String(impact),
      initial: {
        long_oi_usd20: p.seed_is_long ? String(seed) : "0",
        short_oi_usd20: p.seed_is_long ? "0" : String(seed),
        impact_pool_amount: String(pool),
        seed_execution: {
          impact_usd20: String(seedImpact),
          size_tokens: String(seedTokens),
          execution_price: String(seed / seedTokens),
        },
      },
      baseline,
      acceptable_price_probes: probes,
    },
    c.id
  );
  if (c.id.endsWith("-positive-factor-capped")) {
    assert(impact > (size * b("max_negative_factor")) / unit && impact < raw, c.id);
  }
  if (c.id.endsWith("-positive-pool-capped")) assert(impact > 0n && impact === pool * low && impact < raw, c.id);
  if (c.id.endsWith("-positive-empty-pool")) assert(raw > 0n && impact === 0n, c.id);
  if (c.id.endsWith("-positive-exact-pool")) assert(pool === ceil(raw, low) && impact === raw, c.id);
  if (c.id.endsWith("-positive-uncapped")) assert(raw > 0n && impact === raw, c.id);
  if (c.id.endsWith("-negative") || c.id.endsWith("-crossover")) assert(raw < 0n && impact === raw, c.id);
  if (c.id.endsWith("-negative")) assert(-raw > (size * b("max_negative_factor")) / unit, c.id);
  if (c.id.endsWith("-zero")) assert.equal(impact, 0n, c.id);
  increasePriceProbes += probes.length;
}

function verifyLiquidation(c) {
  const p = c.input.scenario;
  const size = BigInt(p.size_usd20);
  const entryIndex = BigInt(p.is_long ? p.entry_prices.index.max : p.entry_prices.index.min);
  const entryCollateral = BigInt((p.is_long_collateral ? p.entry_prices.long : p.entry_prices.short).min);
  const feeValue = (size * BigInt(p.order_fee_factor)) / unit;
  const openingCost = feeValue / entryCollateral;
  const collateralAmount = BigInt(p.collateral_amount) - openingCost;
  const impact = c.input.impact;
  const openingImpact = impact ? -(size * BigInt(impact.negative_factor)) / unit : 0n;
  const openingAmount = -ceil(-openingImpact, BigInt(p.entry_prices.index.min));
  const baseTokens = p.is_long ? size / entryIndex : ceil(size, entryIndex);
  const tokens = p.is_long ? baseTokens + openingAmount : baseTokens - openingAmount;
  const oppositeSize = impact ? BigInt(impact.opposite_size_usd20) : 0n;
  const rawImpact = !impact
    ? 0n
    : oppositeSize === 0n
      ? (size * min(BigInt(impact.positive_factor), BigInt(impact.negative_factor))) / unit
      : -(size * BigInt(impact.negative_factor)) / unit;
  const effectiveImpact =
    rawImpact >= 0n ? 0n : -min(-rawImpact, (size * BigInt(impact.liquidation_cap_factor)) / unit);
  if (impact) {
    assert.equal(p.order_fee_factor, "0", c.id);
    assert(oppositeSize === 0n || oppositeSize === 3n * size, c.id);
    let oppositeReport = null;
    if (oppositeSize) {
      const seedImpact =
        (size * min(BigInt(impact.positive_factor), BigInt(impact.negative_factor))) / unit -
        ((oppositeSize - size) * BigInt(impact.negative_factor)) / unit;
      assert(seedImpact < 0n, c.id);
      const seedAmount = -ceil(-seedImpact, BigInt(p.entry_prices.index.min));
      const seedTokens = p.is_long
        ? ceil(oppositeSize, BigInt(p.entry_prices.index.min)) - seedAmount
        : oppositeSize / BigInt(p.entry_prices.index.max) + seedAmount;
      oppositeReport = {
        impact_usd20: String(seedImpact),
        size_tokens: String(seedTokens),
        execution_price: String(oppositeSize / seedTokens),
        claimable_funding_amounts: ["0", "0"],
      };
    }
    assert.deepEqual(
      c.output.state,
      {
        long_oi_usd20: String(p.is_long ? size : oppositeSize),
        short_oi_usd20: String(p.is_long ? oppositeSize : size),
        opposite_report: oppositeReport,
      },
      c.id
    );
    if (c.id.endsWith("-positive-ignored")) assert(rawImpact > 0n && effectiveImpact === 0n, c.id);
    if (c.id.endsWith("-negative-capped")) assert(effectiveImpact < 0n && effectiveImpact > rawImpact, c.id);
    if (c.id.endsWith("-negative-uncapped")) assert.equal(effectiveImpact, rawImpact, c.id);
    if (c.id.endsWith("-negative-zero-cap")) assert(rawImpact < 0n && effectiveImpact === 0n, c.id);
  }
  assert.deepEqual(
    c.output.opened,
    {
      collateral_amount: String(collateralAmount),
      execution_price: String(size / tokens),
      impact_usd20: String(openingImpact),
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
    const value = collateralValue + pnl + effectiveImpact - cost * collateralPrice;
    remaining.push(value);
    const liquidation = reason(value, p.liquidation_collateral_factor ?? p.min_collateral_factor);
    const margin = reason(value, p.min_collateral_factor);
    return {
      status: "ok",
      pnl_usd20: String(pnl),
      collateral_usd20: String(collateralValue),
      closing_cost_amount: String(cost),
      impact_usd20: String(rawImpact),
      ...(impact ? { effective_impact_usd20: String(effectiveImpact) } : {}),
      liquidatable: liquidation !== null,
      reason: liquidation,
      margin_insufficient: margin !== null,
      margin_reason: margin,
    };
  });
  assert.deepEqual(
    c.output,
    { status: "ok", opened: c.output.opened, probes, ...(impact ? { state: c.output.state } : {}) },
    c.id
  );
  // These are three adjacent raw price units around an analytically derived boundary,
  // not a coarse sample or a binary search that assumes a general liquidation curve.
  assert.equal(p.probe_prices.length, 3);
  for (let index = 1; index < 3; index++) {
    assert.equal(BigInt(p.probe_prices[index].index.min) - BigInt(p.probe_prices[index - 1].index.min), 1n);
  }
  if (c.id.endsWith("-margin")) {
    assert(probes.some((v) => v.margin_insufficient) && probes.some((v) => !v.margin_insufficient), c.id);
    assert(
      probes.every((v) => !v.liquidatable),
      c.id
    );
  } else {
    assert(probes.some((v) => v.liquidatable) && probes.some((v) => !v.liquidatable), c.id);
  }
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
  if (impact) impactLiquidationProbes += probes.length;
}
for (let index = 0; index < reference.cases.length; index++) {
  const c = reference.cases[index];
  assert.equal(c.id, inputs.cases[index].id);
  assert.deepEqual(c.input, inputs.cases[index].input);
  const p = c.input;
  if (p.operation === "dynamic_funding") {
    verifyDynamicFunding(c);
    operations[p.operation] = (operations[p.operation] ?? 0) + 1;
    continue;
  }
  if (p.operation === "funding_accrual" || p.operation === "funding_distribution") {
    verifyFunding(c);
    operations[p.operation] = (operations[p.operation] ?? 0) + 1;
    continue;
  }
  if (p.operation === "borrowing_accrual") {
    verifyBorrowing(c);
    operations[p.operation] = (operations[p.operation] ?? 0) + 1;
    continue;
  }
  if (p.operation === "increase_impact") {
    verifyIncrease(c);
    operations[p.operation] = (operations[p.operation] ?? 0) + 1;
    continue;
  }
  if (p.operation === "liquidation_check" || p.operation === "liquidation_impact") {
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
    ...[
      (p) => {
        p.acceptable_prices = [];
      },
      (p) => {
        p.acceptable_prices[0] = "0";
      },
      (p) => {
        p.prices.index.max = "1";
      },
      (p) => {
        p.index_decimals = 21;
      },
      (p) => {
        p.positive_impact_factor = String(unit + 1n);
      },
      (p) => {
        p.impact_pool_amount = String(1n << 127n);
      },
      (p) => {
        p.unknown = true;
      },
      (p) => {
        p.seed_collateral_amount = "1";
      },
      (p) => {
        p.size_usd20 = "0";
      },
    ].map((mutate) => (s) => {
      mutate(s.cases[71].input.scenario);
    }),
    ...[
      (p) => {
        delete p.liquidation_cap_factor;
      },
      (p) => {
        p.liquidation_cap_factor = String(unit + 1n);
      },
      (p) => {
        p.max_negative_factor = String(unit + 1n);
      },
      (p) => {
        p.opposite_size_usd20 = "01";
      },
      (p) => {
        p.opposite_collateral_amount = "1";
      },
      (p) => {
        p.opposite_size_usd20 = String(3000n * unit);
        p.opposite_collateral_amount = "1";
      },
      (p) => {
        p.unknown = true;
      },
    ].map((mutate) => (s) => {
      mutate(s.cases[103].input.impact);
    }),
    ...[
      (p) => {
        p.elapsed_seconds = [];
      },
      (p) => {
        p.elapsed_seconds = [31_536_001];
      },
      (p) => {
        delete p.elapsed_seconds;
      },
      (p) => {
        p.borrowing_factor = String(unit + 1n);
      },
      (p) => {
        p.receiver_factor = String(unit + 1n);
      },
      (p) => {
        p.next_size_usd20 = "0";
      },
      (p) => {
        p.collateral_amount = "1";
      },
      (p) => {
        p.unknown = true;
      },
    ].map((mutate) => (s) => {
      mutate(s.cases[131].input.scenario);
    }),
    ...[
      (p) => {
        p.elapsed_seconds = [];
      },
      (p) => {
        p.elapsed_seconds = [31_536_001];
      },
      (p) => {
        delete p.funding_factor;
      },
      (p) => {
        p.funding_factor = String(unit + 1n);
      },
      (p) => {
        p.max_factor_per_second = String(unit + 1n);
      },
      (p) => {
        p.long_size_usd20 = "0";
      },
      (p) => {
        p.next_size_usd20 = "0";
      },
      (p) => {
        p.short_collateral_amount = "1";
      },
      (p) => {
        p.unknown = true;
      },
    ].map((mutate) => (s) => {
      mutate(s.cases[159].input.scenario);
    }),
  ];

  invalid.push(
    ...[
      (p) => {
        p.increase_factor_per_second = "0";
      },
      (p) => {
        p.min_factor_per_second = String(unit);
      },
      (p) => {
        p.decrease_threshold = String(unit);
      },
      (p) => {
        p.steps = [];
      },
      (p) => {
        delete p.stable_threshold;
      },
      (p) => {
        p.steps[0].elapsed_seconds = 31_536_001;
      },
      (p) => {
        p.steps[0].add_long_usd20 = "01";
      },
      (p) => {
        p.steps[0].add_short_usd20 = "0";
      },
      (p) => {
        p.max_factor_per_second = String(unit + 1n);
      },
      (p) => {
        p.steps[0].unknown = true;
      },
    ].map((mutate) => (s) => {
      mutate(s.cases[175].input.scenario);
    })
  );
  invalid.push(
    ...[
      (p) => {
        p.sizes_usd20 = ["0", "0", "0", "0"];
      },
      (p) => {
        p.sizes_usd20.pop();
      },
      (p) => {
        p.sizes_usd20[0] = "01";
      },
      (p) => {
        delete p.sizes_usd20;
      },
      (p) => {
        p.elapsed_seconds = [];
      },
      (p) => {
        p.elapsed_seconds = [31_536_001];
      },
      (p) => {
        p.funding_factor = String(unit + 1n);
      },
      (p) => {
        p.prices.short.max = "0";
      },
      (p) => {
        p.unknown = true;
      },
    ].map((mutate) => (s) => {
      mutate(s.cases[199].input.scenario);
    })
  );
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
      increasePriceProbes,
      impactLiquidationProbes,
      borrowingCheckpoints,
      borrowingSettlements,
      fundingCheckpoints,
      fundingSettlements,
      dynamicFundingCheckpoints,
      distributionCheckpoints,
      distributionSettlements,
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
