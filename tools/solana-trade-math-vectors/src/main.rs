use std::{
    collections::HashSet,
    error::Error,
    fs,
    io::{self, Write},
    process::Command,
};

use gmsol_model::{
    params::{fee::LiquidationFeeParams, FeeParams, PositionParams, PriceImpactParams},
    pool::delta::BalanceChange,
    price::{Price, Prices},
    test::{TestMarket, TestMarketConfig, TestPosition},
    Balance, BaseMarketExt, BaseMarketMut, LiquidityMarketMutExt, MarketAction, PerpMarketExt,
    PerpMarketMut, Pool, PositionExt, PositionImpactMarketExt, PositionImpactMarketMutExt,
    PositionMutExt, PositionState, PositionStateMut,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

type Result<T> = std::result::Result<T, Box<dyn Error>>;
const COMMIT: &str = "7ce035b41a266cb5ddb0192e5d29deb0c7e67a72";
const UNIT: u128 = 100_000_000_000_000_000_000;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Suite {
    schema_version: u32,
    cases: Vec<Case>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Case {
    id: String,
    input: Input,
}

#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
enum Input {
    IncreaseImpact {
        scenario: IncreaseInput,
    },
    LiquidationCheck {
        scenario: LiquidationInput,
    },
    Fee {
        amount: String,
        positive_factor: String,
        negative_factor: String,
        combined_discount_factor: String,
        balance_change: Change,
    },
    PositiveImpactCap {
        impact_usd20: String,
        size_delta_usd20: String,
        pool_amount: String,
        index_price: PriceInput,
        max_positive_factor: String,
        max_negative_factor: String,
        index_decimals: u8,
    },
    PositionPnl {
        is_long: bool,
        is_long_collateral: bool,
        index_decimals: u8,
        long_decimals: u8,
        short_decimals: u8,
        index_price: PriceInput,
        long_price: PriceInput,
        short_price: PriceInput,
        long_pool_amount: String,
        short_pool_amount: String,
        side_oi_long_collateral_usd20: String,
        side_oi_short_collateral_usd20: String,
        side_oi_long_collateral_tokens: String,
        side_oi_short_collateral_tokens: String,
        max_trader_pnl_factor: String,
        position_size_usd20: String,
        position_size_tokens: String,
        size_delta_usd20: String,
    },
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum Change {
    Improved,
    Unchanged,
    Worsened,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PriceInput {
    min: String,
    max: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PricesInput {
    index: PriceInput,
    long: PriceInput,
    short: PriceInput,
}

impl PricesInput {
    fn parse(&self) -> Result<Prices<u128>> {
        Ok(Prices {
            index_token_price: price(&self.index)?,
            long_token_price: price(&self.long)?,
            short_token_price: price(&self.short)?,
        })
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LiquidationInput {
    is_long: bool,
    is_long_collateral: bool,
    index_decimals: u8,
    long_decimals: u8,
    short_decimals: u8,
    entry_prices: PricesInput,
    probe_prices: Vec<PricesInput>,
    deposit_long_amount: String,
    deposit_short_amount: String,
    collateral_amount: String,
    size_usd20: String,
    min_position_size_usd20: String,
    min_collateral_usd20: String,
    min_collateral_factor: String,
    #[serde(deserialize_with = "Option::deserialize")]
    liquidation_collateral_factor: Option<String>,
    order_fee_factor: String,
    liquidation_fee_factor: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct IncreaseInput {
    is_long: bool,
    is_long_collateral: bool,
    index_decimals: u8,
    long_decimals: u8,
    short_decimals: u8,
    prices: PricesInput,
    deposit_long_amount: String,
    deposit_short_amount: String,
    seed_is_long: bool,
    seed_size_usd20: String,
    seed_collateral_amount: String,
    impact_pool_amount: String,
    positive_impact_factor: String,
    negative_impact_factor: String,
    max_positive_factor: String,
    max_negative_factor: String,
    collateral_amount: String,
    size_usd20: String,
    acceptable_prices: Vec<String>,
}

fn increase_impact(input: &IncreaseInput) -> Result<Value> {
    for value in [
        input.index_decimals,
        input.long_decimals,
        input.short_decimals,
    ] {
        decimals(value)?;
    }
    let prices = input.prices.parse()?;
    let size = uint(&input.size_usd20)?;
    let signed_size = i128::try_from(size)?;
    if size == 0 || input.acceptable_prices.is_empty() {
        return Err("Expected nonzero size and nonempty acceptable prices".into());
    }
    let acceptable_prices = input
        .acceptable_prices
        .iter()
        .map(|v| {
            let value = uint(v)?;
            if value == 0 {
                return Err("Expected nonzero acceptable price".into());
            }
            Ok(value)
        })
        .collect::<Result<Vec<_>>>()?;
    let mut config = TestMarketConfig::<u128, 20>::default();
    config.position_params = PositionParams::new(
        UNIT,
        UNIT,
        UNIT / 10,
        factor(&input.max_positive_factor)?,
        factor(&input.max_negative_factor)?,
        UNIT / 100,
    );
    config.position_impact_params = PriceImpactParams::builder()
        .exponent(UNIT)
        .positive_factor(factor(&input.positive_impact_factor)?)
        .negative_factor(factor(&input.negative_impact_factor)?)
        .build();
    config.swap_impact_params = PriceImpactParams::builder()
        .exponent(UNIT)
        .positive_factor(0)
        .negative_factor(0)
        .build();
    let no_fee = FeeParams::builder()
        .fee_receiver_factor(0)
        .positive_impact_fee_factor(0)
        .negative_impact_fee_factor(0)
        .build();
    config.order_fee_params = no_fee;
    config.swap_fee_params = no_fee;
    let mut market = TestMarket::<u128, 20>::with_config(config);
    market
        .deposit(
            uint(&input.deposit_long_amount)?,
            uint(&input.deposit_short_amount)?,
            prices,
        )?
        .execute()?;
    // Seed OI through a real model action. The seed is a separate position using short collateral.
    let mut seed = if input.seed_is_long {
        TestPosition::long(false)
    } else {
        TestPosition::short(false)
    };
    let seed_report = seed
        .ops(&mut market)
        .increase(
            prices,
            uint(&input.seed_collateral_amount)?,
            uint(&input.seed_size_usd20)?,
            None,
        )?
        .execute()?;
    let seed_execution = json!({
        "impact_usd20": seed_report.execution().price_impact_value().to_string(),
        "size_tokens": seed_report.execution().size_delta_in_tokens().to_string(),
        "execution_price": seed_report.execution().execution_price().to_string()
    });
    // Explicit mathematical pool snapshot, not a simulated funding transfer or distribution.
    let pool = uint(&input.impact_pool_amount)?;
    let previous_pool = market.position_impact_pool_amount()?;
    market.apply_delta_to_position_impact_pool(
        &(i128::try_from(pool)? - i128::try_from(previous_pool)?),
    )?;
    let initial = json!({
        "long_oi_usd20": market.open_interest()?.long_amount()?.to_string(),
        "short_oi_usd20": market.open_interest()?.short_amount()?.to_string(),
        "impact_pool_amount": pool.to_string(), "seed_execution": seed_execution
    });
    let fresh_position = || {
        if input.is_long {
            TestPosition::long(input.is_long_collateral)
        } else {
            TestPosition::short(input.is_long_collateral)
        }
    };
    let mut position = fresh_position();
    let ops = position.ops(&mut market);
    let raw = ops.position_price_impact(&signed_size, true)?.value;
    let capped = ops
        .capped_positive_position_price_impact(&prices.index_token_price, &signed_size, true)?
        .value;
    let collateral = uint(&input.collateral_amount)?;
    let mut outcomes = Vec::new();
    // Every attempt gets the same fresh state; model actions are not transactional on failure.
    for acceptable in std::iter::once(None).chain(acceptable_prices.into_iter().map(Some)) {
        let mut trial_market = market.clone();
        let mut trial_position = fresh_position();
        let mut trial_ops = trial_position.ops(&mut trial_market);
        let result = trial_ops
            .increase(prices, collateral, size, acceptable)?
            .execute();
        outcomes.push(match result {
            Ok(report) => {
                let execution = report.execution();
                json!({
                    "status": "ok", "impact_usd20": execution.price_impact_value().to_string(),
                    "impact_amount": execution.price_impact_amount().to_string(),
                    "size_tokens": trial_ops.size_in_tokens().to_string(),
                    "size_usd20": trial_ops.size_in_usd().to_string(),
                    "collateral_amount": trial_ops.collateral_amount().to_string(),
                    "cost_amount": report.fees().total_cost_amount()?.to_string(),
                    "execution_price": execution.execution_price().to_string(),
                    "claimable_funding_amounts": [report.claimable_funding_amounts().0.to_string(), report.claimable_funding_amounts().1.to_string()],
                    "impact_pool_amount": trial_market.position_impact_pool_amount()?.to_string()
                })
            },
            Err(error) => model_error(error)
        });
    }
    let baseline = outcomes.remove(0);
    Ok(
        json!({"status": "ok", "initial": initial, "uncapped_impact_usd20": raw.to_string(), "capped_impact_usd20": capped.to_string(), "baseline": baseline, "acceptable_price_probes": outcomes}),
    )
}

fn liquidation_check(input: &LiquidationInput) -> Result<Value> {
    for value in [
        input.index_decimals,
        input.long_decimals,
        input.short_decimals,
    ] {
        decimals(value)?;
    }
    if input.probe_prices.is_empty() {
        return Err("Expected nonempty liquidation probes".into());
    }
    let entry = input.entry_prices.parse()?;
    let probes = input
        .probe_prices
        .iter()
        .map(PricesInput::parse)
        .collect::<Result<Vec<_>>>()?;
    let size = uint(&input.size_usd20)?;
    if size == 0 {
        return Err("Expected nonzero position size".into());
    }
    let mut config = TestMarketConfig::<u128, 20>::default();
    config.position_params = PositionParams::builder()
        .min_position_size_usd(uint(&input.min_position_size_usd20)?)
        .min_collateral_value(uint(&input.min_collateral_usd20)?)
        .min_collateral_factor(factor(&input.min_collateral_factor)?)
        .min_collateral_factor_for_liquidation(
            input
                .liquidation_collateral_factor
                .as_deref()
                .map(factor)
                .transpose()?,
        )
        .max_positive_position_impact_factor(0)
        .max_negative_position_impact_factor(0)
        .max_position_impact_factor_for_liquidations(0)
        .build();
    // This subset isolates minima, collateral/PnL prices and closing fees. No clock advances.
    let no_impact = PriceImpactParams::builder()
        .exponent(UNIT)
        .positive_factor(0)
        .negative_factor(0)
        .build();
    config.position_impact_params = no_impact;
    config.swap_impact_params = no_impact;
    let fee = factor(&input.order_fee_factor)?;
    config.order_fee_params = FeeParams::builder()
        .fee_receiver_factor(0)
        .positive_impact_fee_factor(fee)
        .negative_impact_fee_factor(fee)
        .build();
    config.swap_fee_params = FeeParams::builder()
        .fee_receiver_factor(0)
        .positive_impact_fee_factor(0)
        .negative_impact_fee_factor(0)
        .build();
    config.liquidation_fee_params = LiquidationFeeParams::builder()
        .factor(factor(&input.liquidation_fee_factor)?)
        .receiver_factor(0)
        .build();
    let mut market = TestMarket::<u128, 20>::with_config(config);
    market
        .deposit(
            uint(&input.deposit_long_amount)?,
            uint(&input.deposit_short_amount)?,
            entry,
        )?
        .execute()?;
    let mut position = if input.is_long {
        TestPosition::long(input.is_long_collateral)
    } else {
        TestPosition::short(input.is_long_collateral)
    };
    let mut ops = position.ops(&mut market);
    let report = ops
        .increase(entry, uint(&input.collateral_amount)?, size, None)?
        .execute()?;
    let opened = json!({
        "size_usd20": ops.size_in_usd().to_string(),
        "size_tokens": ops.size_in_tokens().to_string(),
        "collateral_amount": ops.collateral_amount().to_string(),
        "opening_cost_amount": report.fees().total_cost_amount()?.to_string(),
        "execution_price": report.execution().execution_price().to_string(),
        "impact_usd20": report.execution().price_impact_value().to_string()
    });
    let mut results = Vec::new();
    for prices in probes {
        let result = (|| -> gmsol_model::Result<Value> {
            let (pnl, _, _) = ops.pnl_value(&prices, ops.size_in_usd())?;
            let collateral = ops.collateral_value(&prices)?;
            let impact = ops.position_price_impact(
                &-i128::try_from(size)
                    .map_err(|_| gmsol_model::Error::Computation("size exceeds signed range"))?,
                true,
            )?;
            let fees = ops.position_fees(
                ops.collateral_price(&prices),
                &size,
                impact.balance_change,
                false,
            )?;
            let cost = fees.total_cost_amount()?;
            let reason = ops
                .check_liquidatable(&prices, true, true)?
                .map(|v| v.to_string());
            let margin_reason = ops
                .check_liquidatable(&prices, true, false)?
                .map(|v| v.to_string());
            Ok(json!({
                "status": "ok", "pnl_usd20": pnl.to_string(),
                "collateral_usd20": collateral.to_string(), "closing_cost_amount": cost.to_string(),
                "impact_usd20": impact.value.to_string(),
                "liquidatable": reason.is_some(), "reason": reason,
                "margin_insufficient": margin_reason.is_some(), "margin_reason": margin_reason
            }))
        })();
        results.push(match result {
            Ok(value) => value,
            Err(error) => model_error(error),
        });
    }
    Ok(json!({"status": "ok", "opened": opened, "probes": results}))
}

fn uint(text: &str) -> Result<u128> {
    let value: u128 = text.parse()?;
    if value.to_string() != text {
        return Err("Expected canonical u128 decimal string".into());
    }
    Ok(value)
}

fn signed(text: &str) -> Result<i128> {
    let value: i128 = text.parse()?;
    if value.to_string() != text {
        return Err("Expected canonical i128 decimal string".into());
    }
    Ok(value)
}

fn factor(text: &str) -> Result<u128> {
    let value = uint(text)?;
    if value > UNIT {
        return Err("Factor must be between zero and 10^20".into());
    }
    Ok(value)
}

fn decimals(value: u8) -> Result<()> {
    if value > 20 {
        return Err("Token decimals must not exceed 20".into());
    }
    Ok(())
}

fn price(input: &PriceInput) -> Result<Price<u128>> {
    let min = uint(&input.min)?;
    let max = uint(&input.max)?;
    if min == 0 || min > max {
        return Err("Expected nonzero ordered price bounds".into());
    }
    Ok(Price { min, max })
}

fn usd30(value: impl ToString) -> String {
    let text = value.to_string();
    if text == "0" {
        text
    } else {
        format!("{text}0000000000")
    }
}

fn model_error(error: gmsol_model::Error) -> Value {
    json!({"status": "error", "message": error.to_string()})
}

fn evaluate(input: &Input) -> Result<Value> {
    match input {
        Input::IncreaseImpact { scenario } => increase_impact(scenario),
        Input::LiquidationCheck { scenario } => liquidation_check(scenario),
        Input::Fee {
            amount,
            positive_factor,
            negative_factor,
            combined_discount_factor,
            balance_change,
        } => {
            let params = FeeParams::<u128>::builder()
                .positive_impact_fee_factor(factor(positive_factor)?)
                .negative_impact_fee_factor(factor(negative_factor)?)
                .fee_receiver_factor(0)
                .build()
                .with_discount_factor(factor(combined_discount_factor)?);
            let change = match balance_change {
                Change::Improved => BalanceChange::Improved,
                Change::Unchanged => BalanceChange::Unchanged,
                Change::Worsened => BalanceChange::Worsened,
            };
            Ok(match params.fee::<20>(change, &uint(amount)?) {
                Some(fee) => json!({"status": "ok", "fee_amount": fee.to_string()}),
                None => json!({"status": "unavailable", "reason": "FeeParams::fee returned None"}),
            })
        }
        Input::PositiveImpactCap {
            impact_usd20,
            size_delta_usd20,
            pool_amount,
            index_price,
            max_positive_factor,
            max_negative_factor,
            index_decimals,
        } => {
            decimals(*index_decimals)?;
            // Only position_params and position_impact_pool are read by this model entry.
            let mut config = TestMarketConfig::<u128, 20>::default();
            config.position_params = PositionParams::new(
                0,
                0,
                0,
                factor(max_positive_factor)?,
                factor(max_negative_factor)?,
                0,
            );
            let mut market = TestMarket::<u128, 20>::with_config(config);
            market.apply_delta_to_position_impact_pool(&i128::try_from(uint(pool_amount)?)?)?;
            let mut impact = signed(impact_usd20)?;
            let result = market.cap_positive_position_price_impact(
                &price(index_price)?,
                &signed(size_delta_usd20)?,
                &mut impact,
            );
            Ok(match result {
                Ok(()) => {
                    json!({"status": "ok", "impact_usd20": impact.to_string(), "impact_usd30": usd30(impact)})
                }
                Err(error) => model_error(error),
            })
        }
        Input::PositionPnl {
            is_long,
            is_long_collateral,
            index_decimals,
            long_decimals,
            short_decimals,
            index_price,
            long_price,
            short_price,
            long_pool_amount,
            short_pool_amount,
            side_oi_long_collateral_usd20,
            side_oi_short_collateral_usd20,
            side_oi_long_collateral_tokens,
            side_oi_short_collateral_tokens,
            max_trader_pnl_factor,
            position_size_usd20,
            position_size_tokens,
            size_delta_usd20,
        } => {
            for value in [index_decimals, long_decimals, short_decimals] {
                decimals(*value)?;
            }
            let prices = Prices {
                index_token_price: price(index_price)?,
                long_token_price: price(long_price)?,
                short_token_price: price(short_price)?,
            };
            // pnl_value reads only these pools, the position sizes, prices and trader factor.
            // Other TestMarket defaults do not enter this read-only calculation; no clock runs.
            let mut config = TestMarketConfig::<u128, 20>::default();
            config.max_pnl_factors.trader = factor(max_trader_pnl_factor)?;
            let mut market = TestMarket::<u128, 20>::with_config(config);
            let pool = market.liquidity_pool_mut()?;
            pool.apply_delta_to_long_amount(&i128::try_from(uint(long_pool_amount)?)?)?;
            pool.apply_delta_to_short_amount(&i128::try_from(uint(short_pool_amount)?)?)?;
            let oi = market.open_interest_pool_mut(*is_long)?;
            oi.apply_delta_to_long_amount(&i128::try_from(uint(side_oi_long_collateral_usd20)?)?)?;
            oi.apply_delta_to_short_amount(&i128::try_from(uint(
                side_oi_short_collateral_usd20,
            )?)?)?;
            let tokens = market.open_interest_in_tokens_pool_mut(*is_long)?;
            tokens.apply_delta_to_long_amount(&i128::try_from(uint(
                side_oi_long_collateral_tokens,
            )?)?)?;
            tokens.apply_delta_to_short_amount(&i128::try_from(uint(
                side_oi_short_collateral_tokens,
            )?)?)?;
            let size = uint(position_size_usd20)?;
            let size_tokens = uint(position_size_tokens)?;
            let delta = uint(size_delta_usd20)?;
            if size == 0 || size_tokens == 0 || delta > size {
                return Err("Expected nonempty position and delta at most size".into());
            }
            let pool_pnl = market.pnl(&prices.index_token_price, *is_long, true)?;
            let pool_value =
                market.pool_value_without_pnl_for_one_side(&prices, *is_long, false)?;
            let mut position = if *is_long {
                TestPosition::long(*is_long_collateral)
            } else {
                TestPosition::short(*is_long_collateral)
            };
            let mut ops = position.ops(&mut market);
            *ops.size_in_usd_mut() = size;
            *ops.size_in_tokens_mut() = size_tokens;
            Ok(match ops.pnl_value(&prices, &delta) {
                Ok((pnl, uncapped, delta_tokens)) => json!({
                    "status": "ok", "pnl_usd20": pnl.to_string(), "pnl_usd30": usd30(pnl),
                    "uncapped_pnl_usd20": uncapped.to_string(), "uncapped_pnl_usd30": usd30(uncapped),
                    "size_delta_tokens": delta_tokens.to_string(),
                    "side_pool_pnl_usd20": pool_pnl.to_string(), "side_pool_value_usd20": pool_value.to_string()
                }),
                Err(error) => model_error(error),
            })
        }
    }
}

fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn main() -> Result<()> {
    let mut args = std::env::args().skip(1);
    let input_path = args
        .next()
        .ok_or("Usage: solana-trade-math-vectors INPUT.json")?;
    if args.next().is_some() {
        return Err("Expected exactly one input path".into());
    }
    let bytes = fs::read(input_path)?;
    let suite: Suite = serde_json::from_slice(&bytes)?;
    if suite.schema_version != 1 || suite.cases.is_empty() {
        return Err("Expected schema version 1 and nonempty cases".into());
    }
    let raw: Value = serde_json::from_slice(&bytes)?;
    let mut ids = HashSet::new();
    let mut cases = Vec::new();
    for (index, case) in suite.cases.iter().enumerate() {
        if case.id.is_empty() || !ids.insert(&case.id) {
            return Err("Expected unique nonempty case IDs".into());
        }
        let output = evaluate(&case.input).map_err(|error| format!("Case {}: {error}", case.id))?;
        cases.push(json!({"id": case.id, "input": raw["cases"][index]["input"], "output": output}));
    }
    let rustc = Command::new("rustc").arg("--version").output()?;
    if !rustc.status.success() {
        return Err("Cannot identify rustc version".into());
    }
    let result = json!({
        "schema_version": 1,
        "reference": {"repository": "https://github.com/gmsol-labs/gmx-solana", "tag": "v0.10.0", "commit": COMMIT},
        "generator": {
            "source_sha256": sha256(include_bytes!("main.rs")),
            "manifest_sha256": sha256(include_bytes!("../Cargo.toml")),
            "lock_sha256": sha256(include_bytes!("../Cargo.lock")),
            "input_sha256": sha256(&bytes),
            "rustc": String::from_utf8(rustc.stdout)?.trim()
        },
        "units": {"usd_decimals": "20", "factor_decimals": "20", "shared_usd_decimals": "30", "prices": "USD20 per raw token unit", "token_amounts": "raw units; decimals specified per case", "fee_amount": "same unit as input amount; not implicitly USD", "tolerance": "0"},
        "scope": ["FeeParams::fee", "PerpMarketExt::cap_positive_position_price_impact", "PositionExt::pnl_value", "PositionExt::check_liquidatable (zero-impact, no elapsed funding/borrowing; deposit/increase initialized)", "IncreasePosition::execute (linear impact; explicit pool snapshot; acceptable-price boundaries)"],
        "cases": cases
    });
    // Buffer all cases before writing stdout; callers must still publish output atomically.
    let mut output = serde_json::to_vec_pretty(&result)?;
    output.push(b'\n');
    io::stdout().lock().write_all(&output)?;
    Ok(())
}
