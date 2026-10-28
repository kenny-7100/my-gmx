# Solana trade math reference generator

Status: **compiled and accepted with Rust 1.90.0** on 2026-10-28. Cargo.lock and vectors.json retain the locked dependency graph and 43 model-generated reference cases. Two runs were byte-identical; verify.mjs independently checked all results, source/input/lock provenance, 18 malformed-input failures and a model error distinct from zero. This tool is not a production dependency or a replacement for the shared GMX SDK.

The binary calls the real `gmsol-model` at the exact v0.10.0 commit. It accepts `inputs.json` and writes JSON to stdout only after all cases have been evaluated. The initial input set covers:

- `FeeParams::fee`: a supplied combined discount factor, fee balance direction, zero, full discount and rounding. It does not authenticate or compute GT rank/referral composition.
- `PerpMarketExt::cap_positive_position_price_impact`: configured positive cap and available impact pool, negative/zero passthrough. It does not calculate raw impact, distribute the pool, execute an order or calculate acceptable prices.
- `PositionExt::pnl_value`: long/short, both collateral types, side aggregate OI across both collaterals, profitable zero/finite/unreached caps, losses and partial-close rounding. The tool seeds explicit read-only mathematical state through model test builders; it does not validate or execute that position.

Amounts, USD20 values and factors are canonical integer strings. Prices are USD20 per smallest token unit. Each token's decimals are explicit. Fee output keeps the amount's input unit. Shared USD30 outputs append ten decimal places exactly, without i128 overflow. Model errors and `None` are distinct from real zero. Malformed inputs or setup failures abort the run; no partial reference set is accepted.

Only fields read by each function are populated. For positive impact, those are `position_params` and the impact pool. For PnL they are the position sizes, prices, liquidity pools, side OI pools and `max_pnl_factors.trader`. Other fixed-tag `TestMarketConfig` defaults are unused in these calls. No time-dependent action, borrowing/funding update or RPC is executed. The input values are mathematical fixtures, not captures of deployed markets.

The user authorized installing Rust 1.90.0 (Cargo/rustfmt), downloading dependencies and compiling/running this generator. Rust was installed with the minimal profile and without modifying shell startup files. This authorization does not cover other builds, deployment or transactions. Use the same explicit toolchain for compilation and execution. From the repository root:

```sh
export PATH="$HOME/.cargo/bin:$PATH"
cargo +1.90.0 fmt --manifest-path tools/solana-trade-math-vectors/Cargo.toml --check
cargo +1.90.0 run --locked --offline --manifest-path tools/solana-trade-math-vectors/Cargo.toml -- tools/solana-trade-math-vectors/inputs.json > /tmp/solana-trade-math-vectors.first.json
cargo +1.90.0 run --locked --offline --manifest-path tools/solana-trade-math-vectors/Cargo.toml -- tools/solana-trade-math-vectors/inputs.json > /tmp/solana-trade-math-vectors.second.json
node tools/solana-trade-math-vectors/verify.mjs /tmp/solana-trade-math-vectors.first.json /tmp/solana-trade-math-vectors.second.json
```

The locked dependencies are already downloaded locally. On another machine, download the same graph with `cargo +1.90.0 fetch --locked --manifest-path tools/solana-trade-math-vectors/Cargo.toml` before the offline commands; do not regenerate the accepted lockfile for routine runs. The verifier requires Node 22 and the built debug binary. It checks the independent arithmetic with BigInt only as an acceptance oracle; Rust model output remains the reference source. It never writes reference values. Publish a new vectors.json only after both runs and the verifier succeed; never redirect over an accepted file before successful exit.

The long uncapped inputs use a larger long pool so the cap actually remains above side PnL even with the price spread. Existing 43 reference cases all return ok. A separate adversarial run checks a real model conversion error; FeeParams::fee None is not reachable with canonical u128 inputs and factors constrained to [0, 10^20], so the defensive unavailable branch is not claimed as exercised. SDK/API consumption and the remaining operations are subsequent work.

Full coverage and handoff: [trade math reference](../../docs/solana-trade-math-reference.md). Liquidation predicate boundaries, execution/margin, minima, funding, program discounts and rent/keeper transfers remain outside this first subset.
