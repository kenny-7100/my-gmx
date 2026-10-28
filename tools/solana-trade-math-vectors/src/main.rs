use std::{
    collections::HashSet,
    error::Error,
    fs,
    io::{self, Write},
    process::Command,
    time::Duration,
};

use gmsol_model::{
    params::{
        fee::{
            BorrowingFeeKinkModelParamsForOneSide, BorrowingFeeParams, FundingFeeParams,
            LiquidationFeeParams,
        },
        FeeParams, PositionParams, PriceImpactParams,
    },
    pool::delta::BalanceChange,
    price::{Price, Prices},
    test::{TestMarket, TestMarketConfig, TestPosition},
    Balance, BalanceExt, BaseMarket, BaseMarketExt, BaseMarketMut, BorrowingFeeMarket,
    BorrowingFeeMarketExt, BorrowingFeeMarketMutExt, LiquidityMarketMutExt, MarketAction,
    PerpMarket, PerpMarketExt, PerpMarketMut, PerpMarketMutExt, Pool, Position, PositionExt,
    PositionImpactMarketExt, PositionImpactMarketMutExt, PositionMutExt, PositionState,
    PositionStateMut,
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
    LiquidationBorrowing {
        scenario: LiquidationInput,
        borrowing: LiquidationBorrowingInput,
    },
    BorrowingKink {
        scenario: BorrowingInput,
        params: BorrowingKinkInput,
    },
    DynamicFundingMixed {
        scenario: DynamicFundingInput,
        long_collateral_factors: [String; 2],
    },
    DynamicFundingSingleSide {
        scenario: DynamicFundingInput,
        is_long_collateral: bool,
        transition: SingleSideInput,
    },
    DynamicFundingSettlement {
        scenario: DynamicFundingInput,
        is_long_collateral: bool,
    },
    FundingDistribution {
        scenario: FundingDistributionInput,
    },
    DynamicFunding {
        scenario: DynamicFundingInput,
    },
    FundingAccrual {
        scenario: FundingInput,
    },
    BorrowingAccrual {
        scenario: BorrowingInput,
    },
    LiquidationImpact {
        scenario: LiquidationInput,
        impact: LiquidationImpactInput,
    },
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

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct PriceInput {
    min: String,
    max: String,
}

#[derive(Clone, Deserialize)]
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
struct DynamicFundingInput {
    prices: PricesInput,
    increase_factor_per_second: String,
    decrease_factor_per_second: String,
    min_factor_per_second: String,
    max_factor_per_second: String,
    stable_threshold: String,
    decrease_threshold: String,
    steps: Vec<DynamicFundingStep>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DynamicFundingStep {
    add_long_usd20: String,
    add_short_usd20: String,
    elapsed_seconds: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SingleSideInput {
    close_long: bool,
    elapsed_seconds: Vec<u64>,
}

fn dynamic_funding(
    input: &DynamicFundingInput,
    settle: bool,
    is_long_collateral: bool,
    transition: Option<&SingleSideInput>,
    mixed_factors: Option<[u128; 2]>,
) -> Result<Value> {
    if let Some(transition) = transition {
        if transition.elapsed_seconds.is_empty()
            || transition.elapsed_seconds.iter().any(|s| *s > 31_536_000)
        {
            return Err(
                "Expected nonempty single-sided funding intervals of at most one year".into(),
            );
        }
    }
    let increase = factor(&input.increase_factor_per_second)?;
    let decrease = factor(&input.decrease_factor_per_second)?;
    let minimum = factor(&input.min_factor_per_second)?;
    let maximum = factor(&input.max_factor_per_second)?;
    let stable = factor(&input.stable_threshold)?;
    let decrease_threshold = factor(&input.decrease_threshold)?;
    if increase == 0 || minimum > maximum || decrease_threshold > stable || input.steps.is_empty() {
        return Err(
            "Expected dynamic increase, ordered rate bounds/thresholds and nonempty steps".into(),
        );
    }
    let prices = input.prices.parse()?;
    let mut config = TestMarketConfig::<u128, 20>::default();
    let no_impact = PriceImpactParams::builder()
        .exponent(UNIT)
        .positive_factor(0)
        .negative_factor(0)
        .build();
    let no_fee = FeeParams::builder()
        .fee_receiver_factor(0)
        .positive_impact_fee_factor(0)
        .negative_impact_fee_factor(0)
        .build();
    config.position_impact_params = no_impact;
    config.swap_impact_params = no_impact;
    config.order_fee_params = no_fee;
    config.swap_fee_params = no_fee;
    config.funding_fee_params = FundingFeeParams::builder()
        .exponent(UNIT)
        .funding_factor(0)
        .increase_factor_per_second(increase)
        .decrease_factor_per_second(decrease)
        .min_factor_per_second(minimum)
        .max_factor_per_second(maximum)
        .threshold_for_stable_funding(stable)
        .threshold_for_decrease_funding(decrease_threshold)
        .build();
    let mut market = TestMarket::<u128, 20>::with_config(config);
    market
        .deposit(100_000_000_000_000, 10_000_000_000_000, prices)?
        .execute()?;
    let _ = market.update_funding(&prices)?.execute()?;
    let mut positions = Vec::new();
    let mut sides = Vec::new();
    let mut collaterals = Vec::new();
    let mut checkpoints = Vec::new();
    for step in &input.steps {
        if step.elapsed_seconds > 31_536_000 {
            return Err("Funding interval exceeds one year".into());
        }
        let mut additions = Vec::new();
        for (index, (is_long, text)) in
            [(true, &step.add_long_usd20), (false, &step.add_short_usd20)]
                .into_iter()
                .enumerate()
        {
            let size = uint(text)?;
            if let Some(factors) = mixed_factors {
                let long_size =
                    gmsol_model::utils::apply_factor::<u128, 20>(&size, &factors[index])
                        .ok_or("Mixed collateral split overflow")?;
                additions.push((is_long, true, long_size));
                additions.push((is_long, false, size - long_size));
            } else {
                additions.push((is_long, is_long_collateral, size));
            }
        }
        let mut actions = Vec::new();
        for (is_long, is_long_collateral, size) in additions {
            if size == 0 {
                actions.push(Value::Null);
                continue;
            }
            let mut position = if is_long {
                TestPosition::long(is_long_collateral)
            } else {
                TestPosition::short(is_long_collateral)
            };
            let report = position
                .ops(&mut market)
                .increase(
                    prices,
                    if is_long_collateral {
                        10_000_000_000
                    } else {
                        1_000_000_000
                    },
                    size,
                    None,
                )?
                .execute()?;
            actions.push(json!({
                "cost_amount": report.fees().total_cost_amount()?.to_string(),
                "size_tokens": report.execution().size_delta_in_tokens().to_string(),
                "claimable_funding_amounts": [
                    report.claimable_funding_amounts().0.to_string(),
                    report.claimable_funding_amounts().1.to_string()
                ]
            }));
            positions.push(position);
            sides.push(is_long);
            collaterals.push(is_long_collateral);
        }
        let long = market.open_interest()?.long_amount()?;
        let short = market.open_interest()?.short_amount()?;
        if long == 0 || short == 0 {
            return Err("Dynamic funding subset requires both OI sides".into());
        }
        let previous = *market.funding_factor_per_second();
        let (rate, longs_pay, _) = market
            .update_funding(&prices)?
            .next_funding_factor_per_second(step.elapsed_seconds, &long, &short)?;
        market.move_clock_forward(Duration::from_secs(step.elapsed_seconds));
        let report = market.update_funding(&prices)?.execute()?;
        if report.duration_in_seconds() != step.elapsed_seconds {
            return Err("Dynamic funding clock drift: rerun without wall-clock delay".into());
        }
        let deltas: Vec<_> = [(true, true), (true, false), (false, true), (false, false)]
            .into_iter()
            .map(|(side, col)| {
                json!({
                    "funding_per_size": report.delta_funding_amount_per_size(side, col).to_string(),
                    "claimable_per_size": report.delta_claimable_funding_amount_per_size(side, col).to_string()
                })
            })
            .collect();
        let mut checkpoint = json!({
            "long_oi_usd20": long.to_string(),
            "short_oi_usd20": short.to_string(),
            "previous_factor": previous.to_string(),
            "rate_magnitude": rate.to_string(),
            "longs_pay": longs_pay,
            "next_factor": report.next_funding_factor_per_second().to_string(),
            "deltas": deltas,
            "actions": actions
        });
        if settle {
            let mut pending = Vec::new();
            for position in &mut positions {
                let fees = position.ops(&mut market).pending_funding_fees()?;
                pending.push(json!({
                    "cost_amount": fees.amount().to_string(),
                    "claimable_amounts": [
                        fees.claimable_long_token_amount().to_string(),
                        fees.claimable_short_token_amount().to_string()
                    ]
                }));
            }
            checkpoint["pending"] = json!(pending);
        }
        checkpoints.push(checkpoint);
    }
    let mut output = json!({"status":"ok","checkpoints":checkpoints});
    let mut closed = vec![false; positions.len()];
    if let Some(transition) = transition {
        if *market.funding_factor_per_second() == 0 {
            return Err("Expected a nonzero stored funding rate before closing a side".into());
        }
        let mut closing = Vec::new();
        for (index, (position, side)) in positions.iter_mut().zip(&sides).enumerate() {
            if *side != transition.close_long {
                closing.push(Value::Null);
                continue;
            }
            let mut ops = position.ops(&mut market);
            let size = *ops.size_in_usd();
            let report = ops
                .decrease(prices, size, None, 0, Default::default())?
                .execute()?;
            closing.push(json!({
                "cost_amount": report.fees().total_cost_amount()?.to_string(),
                "claimable_funding_amounts": [report.claimable_funding_amounts().0.to_string(), report.claimable_funding_amounts().1.to_string()],
                "should_remove": report.should_remove(),
                "remaining_size_usd20": ops.size_in_usd().to_string()
            }));
            closed[index] = true;
        }
        let long = market.open_interest()?.long_amount()?;
        let short = market.open_interest()?.short_amount()?;
        if (transition.close_long && (long != 0 || short == 0))
            || (!transition.close_long && (short != 0 || long == 0))
        {
            return Err("Expected exactly one nonempty OI side after real full closes".into());
        }
        let mut single_updates = Vec::new();
        for seconds in &transition.elapsed_seconds {
            let previous = *market.funding_factor_per_second();
            market.move_clock_forward(Duration::from_secs(*seconds));
            let report = market.update_funding(&prices)?.execute()?;
            if report.duration_in_seconds() != *seconds {
                return Err("Single-sided funding clock drift".into());
            }
            let mut amounts = Vec::new();
            for (side, col) in [(true, true), (true, false), (false, true), (false, false)] {
                amounts.push(json!({
                    "funding_per_size": market.funding_fee_amount_per_size(side,col)?.to_string(),
                    "claimable_per_size": market.claimable_funding_fee_amount_per_size(side,col)?.to_string(),
                    "delta_funding_per_size": report.delta_funding_amount_per_size(side,col).to_string(),
                    "delta_claimable_per_size": report.delta_claimable_funding_amount_per_size(side,col).to_string()
                }));
            }
            let mut pending = Vec::new();
            for (index, position) in positions.iter_mut().enumerate() {
                if closed[index] {
                    pending.push(Value::Null);
                    continue;
                }
                let fees = position.ops(&mut market).pending_funding_fees()?;
                pending.push(json!({"cost_amount":fees.amount().to_string(), "claimable_amounts":[fees.claimable_long_token_amount().to_string(), fees.claimable_short_token_amount().to_string()]}));
            }
            single_updates.push(json!({"elapsed_seconds":seconds, "previous_factor":previous.to_string(), "next_factor":report.next_funding_factor_per_second().to_string(), "long_oi_usd20":long.to_string(), "short_oi_usd20":short.to_string(), "amounts":amounts, "pending":pending}));
        }
        output["single_side"] = json!({"closing":closing, "updates":single_updates});
    }
    if settle {
        let mut settlements = Vec::new();
        for (index, ((position, is_long), is_long_collateral)) in
            positions.iter_mut().zip(sides).zip(collaterals).enumerate()
        {
            if closed[index] {
                settlements.push(Value::Null);
                continue;
            }
            let mut attempts = Vec::new();
            for _ in 0..2 {
                let mut ops = position.ops(&mut market);
                let report = ops
                    .increase(
                        prices,
                        if is_long_collateral {
                            1_000_000_000
                        } else {
                            100_000_000
                        },
                        UNIT,
                        None,
                    )?
                    .execute()?;
                let pending = ops.pending_funding_fees()?;
                attempts.push(json!({
                    "cost_amount": report.fees().total_cost_amount()?.to_string(),
                    "claimable_funding_amounts": [
                        report.claimable_funding_amounts().0.to_string(),
                        report.claimable_funding_amounts().1.to_string()
                    ],
                    "collateral_amount": ops.collateral_amount().to_string(),
                    "size_usd20": ops.size_in_usd().to_string(),
                    "funding_snapshot": ops.funding_fee_amount_per_size().to_string(),
                    "claimable_snapshots": [
                        ops.claimable_funding_fee_amount_per_size(true).to_string(),
                        ops.claimable_funding_fee_amount_per_size(false).to_string()
                    ],
                    "market_funding_per_size": ops.market().funding_fee_amount_per_size(is_long, is_long_collateral)?.to_string(),
                    "pending_cost_amount": pending.amount().to_string(),
                    "pending_claimable_amounts": [
                        pending.claimable_long_token_amount().to_string(),
                        pending.claimable_short_token_amount().to_string()
                    ]
                }));
            }
            settlements.push(Value::Array(attempts));
        }
        output["settlements"] = json!(settlements);
    }
    Ok(output)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct FundingInput {
    prices: PricesInput,
    index_decimals: u8,
    long_decimals: u8,
    short_decimals: u8,
    deposit_long_amount: String,
    deposit_short_amount: String,
    long_size_usd20: String,
    short_size_usd20: String,
    long_collateral_amount: String,
    short_collateral_amount: String,
    funding_factor: String,
    max_factor_per_second: String,
    elapsed_seconds: Vec<u64>,
    next_size_usd20: String,
    next_long_collateral_amount: String,
    next_short_collateral_amount: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct FundingDistributionInput {
    prices: PricesInput,
    sizes_usd20: [String; 4],
    funding_factor: String,
    max_factor_per_second: String,
    elapsed_seconds: Vec<u64>,
}

fn funding_distribution(input: &FundingDistributionInput) -> Result<Value> {
    let sizes = [
        uint(&input.sizes_usd20[0])?,
        uint(&input.sizes_usd20[1])?,
        uint(&input.sizes_usd20[2])?,
        uint(&input.sizes_usd20[3])?,
    ];
    let common = FundingInput {
        prices: input.prices.clone(),
        index_decimals: 9,
        long_decimals: 9,
        short_decimals: 6,
        deposit_long_amount: "100000000000000".into(),
        deposit_short_amount: "10000000000000".into(),
        long_size_usd20: sizes[0].to_string(),
        short_size_usd20: sizes[2].to_string(),
        long_collateral_amount: "10000000000".into(),
        short_collateral_amount: "1000000000".into(),
        funding_factor: input.funding_factor.clone(),
        max_factor_per_second: input.max_factor_per_second.clone(),
        elapsed_seconds: input.elapsed_seconds.clone(),
        next_size_usd20: UNIT.to_string(),
        next_long_collateral_amount: "1000000000".into(),
        next_short_collateral_amount: "100000000".into(),
    };
    funding_positions(&common, sizes)
}

fn funding_accrual(input: &FundingInput) -> Result<Value> {
    let long = uint(&input.long_size_usd20)?;
    let short = uint(&input.short_size_usd20)?;
    if long == 0 || short == 0 {
        return Err("Expected nonzero funding position sizes".into());
    }
    funding_positions(input, [long, long, short, short])
}

fn funding_positions(input: &FundingInput, sizes: [u128; 4]) -> Result<Value> {
    for value in [
        input.index_decimals,
        input.long_decimals,
        input.short_decimals,
    ] {
        decimals(value)?;
    }
    if input.elapsed_seconds.is_empty() || input.elapsed_seconds.iter().any(|v| *v > 31_536_000) {
        return Err("Expected nonempty funding intervals of at most one year each".into());
    }
    let next_size = uint(&input.next_size_usd20)?;
    if sizes.iter().all(|size| *size == 0) || next_size == 0 {
        return Err("Expected nonzero funding position sizes".into());
    }
    let prices = input.prices.parse()?;
    let mut config = TestMarketConfig::<u128, 20>::default();
    let no_impact = PriceImpactParams::builder()
        .exponent(UNIT)
        .positive_factor(0)
        .negative_factor(0)
        .build();
    let no_fee = FeeParams::builder()
        .fee_receiver_factor(0)
        .positive_impact_fee_factor(0)
        .negative_impact_fee_factor(0)
        .build();
    config.position_impact_params = no_impact;
    config.swap_impact_params = no_impact;
    config.order_fee_params = no_fee;
    config.swap_fee_params = no_fee;
    config.funding_fee_params = FundingFeeParams::builder()
        .exponent(UNIT)
        .funding_factor(factor(&input.funding_factor)?)
        .max_factor_per_second(factor(&input.max_factor_per_second)?)
        .min_factor_per_second(0)
        .increase_factor_per_second(0)
        .decrease_factor_per_second(0)
        .threshold_for_stable_funding(0)
        .threshold_for_decrease_funding(0)
        .build();
    let mut market = TestMarket::<u128, 20>::with_config(config);
    market
        .deposit(
            uint(&input.deposit_long_amount)?,
            uint(&input.deposit_short_amount)?,
            prices,
        )?
        .execute()?;
    if market
        .update_funding(&prices)?
        .execute()?
        .duration_in_seconds()
        != 0
    {
        return Err("Expected funding clock initialization without elapsed time".into());
    }
    const MATRIX: [(bool, bool); 4] = [(true, true), (true, false), (false, true), (false, false)];
    let mut positions = [
        TestPosition::long(true),
        TestPosition::long(false),
        TestPosition::short(true),
        TestPosition::short(false),
    ];
    let mut opened = Vec::new();
    for ((position, (_, is_long_collateral)), size) in positions.iter_mut().zip(MATRIX).zip(sizes) {
        if size == 0 {
            opened.push(Value::Null);
            continue;
        }
        let mut ops = position.ops(&mut market);
        let report = ops
            .increase(
                prices,
                uint(if is_long_collateral {
                    &input.long_collateral_amount
                } else {
                    &input.short_collateral_amount
                })?,
                size,
                None,
            )?
            .execute()?;
        opened.push(json!({"cost_amount":report.fees().total_cost_amount()?.to_string(),"size_tokens":ops.size_in_tokens().to_string(),"claimable_funding_amounts":[report.claimable_funding_amounts().0.to_string(),report.claimable_funding_amounts().1.to_string()]}));
    }
    let mut checkpoints = Vec::new();
    for seconds in &input.elapsed_seconds {
        market.move_clock_forward(Duration::from_secs(*seconds));
        let report = market.update_funding(&prices)?.execute()?;
        if report.duration_in_seconds() != *seconds {
            return Err("Funding clock drift: rerun without wall-clock delay".into());
        }
        let mut deltas = Vec::new();
        let mut pending = Vec::new();
        for ((position, (is_long, is_long_collateral)), size) in
            positions.iter_mut().zip(MATRIX).zip(sizes)
        {
            deltas.push(json!({"funding_per_size":report.delta_funding_amount_per_size(is_long,is_long_collateral).to_string(),"claimable_per_size":report.delta_claimable_funding_amount_per_size(is_long,is_long_collateral).to_string()}));
            if size == 0 {
                pending.push(Value::Null);
                continue;
            }
            let fees = position.ops(&mut market).pending_funding_fees()?;
            pending.push(json!({"cost_amount":fees.amount().to_string(),"claimable_amounts":[fees.claimable_long_token_amount().to_string(),fees.claimable_short_token_amount().to_string()]}));
        }
        checkpoints.push(json!({"elapsed_seconds":seconds,"next_factor_per_second":report.next_funding_factor_per_second().to_string(),"deltas":deltas,"pending":pending}));
    }
    let mut settlements = Vec::new();
    for ((position, (is_long, is_long_collateral)), size) in
        positions.iter_mut().zip(MATRIX).zip(sizes)
    {
        if size == 0 {
            settlements.push(Value::Null);
            continue;
        }
        let mut attempts = Vec::new();
        for _ in 0..2 {
            let mut ops = position.ops(&mut market);
            let report = ops
                .increase(
                    prices,
                    uint(if is_long_collateral {
                        &input.next_long_collateral_amount
                    } else {
                        &input.next_short_collateral_amount
                    })?,
                    next_size,
                    None,
                )?
                .execute()?;
            let pending = ops.pending_funding_fees()?;
            attempts.push(json!({
                "cost_amount":report.fees().total_cost_amount()?.to_string(),
                "claimable_funding_amounts":[report.claimable_funding_amounts().0.to_string(),report.claimable_funding_amounts().1.to_string()],
                "collateral_amount":ops.collateral_amount().to_string(),"size_usd20":ops.size_in_usd().to_string(),
                "funding_snapshot":ops.funding_fee_amount_per_size().to_string(),
                "claimable_snapshots":[ops.claimable_funding_fee_amount_per_size(true).to_string(),ops.claimable_funding_fee_amount_per_size(false).to_string()],
                "pending_cost_amount":pending.amount().to_string(),"pending_claimable_amounts":[pending.claimable_long_token_amount().to_string(),pending.claimable_short_token_amount().to_string()],
                "market_funding_per_size":ops.market().funding_fee_amount_per_size(is_long,is_long_collateral)?.to_string()
            }));
        }
        settlements.push(Value::Array(attempts));
    }
    Ok(
        json!({"status":"ok","adjustment":market.funding_amount_per_size_adjustment().to_string(),"opened":opened,"checkpoints":checkpoints,"settlements":settlements}),
    )
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BorrowingInput {
    is_long: bool,
    is_long_collateral: bool,
    prices: PricesInput,
    index_decimals: u8,
    long_decimals: u8,
    short_decimals: u8,
    deposit_long_amount: String,
    deposit_short_amount: String,
    size_usd20: String,
    collateral_amount: String,
    borrowing_factor: String,
    receiver_factor: String,
    elapsed_seconds: Vec<u64>,
    next_size_usd20: String,
    next_collateral_amount: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BorrowingKinkInput {
    optimal_usage_factor: String,
    base_borrowing_factor: String,
    above_optimal_usage_borrowing_factor: String,
    skip_smaller_side: bool,
    opposite_size_usd20: String,
    opposite_collateral_amount: String,
    open_interest_reserve_factor: String,
    max_open_interest_usd20: String,
    ignore_open_interest_for_usage_factor: bool,
}

fn borrowing_accrual(input: &BorrowingInput, kink: Option<&BorrowingKinkInput>) -> Result<Value> {
    for value in [
        input.index_decimals,
        input.long_decimals,
        input.short_decimals,
    ] {
        decimals(value)?;
    }
    if input.elapsed_seconds.is_empty() || input.elapsed_seconds.iter().any(|v| *v > 31_536_000) {
        return Err("Expected nonempty intervals of at most one year each".into());
    }
    let size = uint(&input.size_usd20)?;
    let next_size = uint(&input.next_size_usd20)?;
    if size == 0 || next_size == 0 {
        return Err("Expected nonzero initial and next position size".into());
    }
    let prices = input.prices.parse()?;
    let mut config = TestMarketConfig::<u128, 20>::default();
    let no_impact = PriceImpactParams::builder()
        .exponent(UNIT)
        .positive_factor(0)
        .negative_factor(0)
        .build();
    let no_fee = FeeParams::builder()
        .fee_receiver_factor(0)
        .positive_impact_fee_factor(0)
        .negative_impact_fee_factor(0)
        .build();
    config.position_impact_params = no_impact;
    config.swap_impact_params = no_impact;
    config.order_fee_params = no_fee;
    config.swap_fee_params = no_fee;
    config.borrowing_fee_params = BorrowingFeeParams::builder()
        .receiver_factor(factor(&input.receiver_factor)?)
        .exponent_for_long(UNIT)
        .exponent_for_short(UNIT)
        .factor_for_long(factor(&input.borrowing_factor)?)
        .factor_for_short(factor(&input.borrowing_factor)?)
        .skip_borrowing_fee_for_smaller_side(kink.is_some_and(|p| p.skip_smaller_side))
        .build();
    config.borrowing_fee_kink_model_params = BorrowingFeeKinkModelParamsForOneSide::builder()
        .optimal_usage_factor(0)
        .base_borrowing_factor(0)
        .above_optimal_usage_borrowing_factor(0)
        .build();
    if let Some(p) = kink {
        config.borrowing_fee_kink_model_params = BorrowingFeeKinkModelParamsForOneSide::builder()
            .optimal_usage_factor(factor(&p.optimal_usage_factor)?)
            .base_borrowing_factor(factor(&p.base_borrowing_factor)?)
            .above_optimal_usage_borrowing_factor(factor(&p.above_optimal_usage_borrowing_factor)?)
            .build();
        config.open_interest_reserve_factor = factor(&p.open_interest_reserve_factor)?;
        config.max_open_interest = uint(&p.max_open_interest_usd20)?;
        config.ignore_open_interest_for_usage_factor = p.ignore_open_interest_for_usage_factor;
        if config.open_interest_reserve_factor == 0 || config.max_open_interest == 0 {
            return Err("Expected nonzero borrowing usage denominators".into());
        }
    }
    let mut market = TestMarket::<u128, 20>::with_config(config);
    market
        .deposit(
            uint(&input.deposit_long_amount)?,
            uint(&input.deposit_short_amount)?,
            prices,
        )?
        .execute()?;
    let initialized = market.update_borrowing(&prices)?.execute()?;
    if initialized.duration_in_seconds() != 0 {
        return Err("Expected borrowing clock initialization without elapsed time".into());
    }
    let mut position = if input.is_long {
        TestPosition::long(input.is_long_collateral)
    } else {
        TestPosition::short(input.is_long_collateral)
    };
    let opening = position
        .ops(&mut market)
        .increase(prices, uint(&input.collateral_amount)?, size, None)?
        .execute()?;
    let opened = json!({"cost_amount": opening.fees().total_cost_amount()?.to_string(), "size_tokens": opening.execution().size_delta_in_tokens().to_string(), "claimable_funding_amounts": [opening.claimable_funding_amounts().0.to_string(), opening.claimable_funding_amounts().1.to_string()]});
    let mut opposite = if input.is_long {
        TestPosition::short(input.is_long_collateral)
    } else {
        TestPosition::long(input.is_long_collateral)
    };
    if let Some(p) = kink {
        let opposite_size = uint(&p.opposite_size_usd20)?;
        if opposite_size == 0 {
            return Err("Expected nonzero opposite position size".into());
        }
        let opening = opposite
            .ops(&mut market)
            .increase(
                prices,
                uint(&p.opposite_collateral_amount)?,
                opposite_size,
                None,
            )?
            .execute()?;
        if opening.fees().total_cost_amount()? != 0
            || opening.claimable_funding_amounts() != (&0, &0)
        {
            return Err("Expected opposite opening without accrued fees or funding claims".into());
        }
    }
    let rate = market.borrowing_factor_per_second(input.is_long, &prices)?;
    let mut checkpoints = Vec::new();
    for seconds in &input.elapsed_seconds {
        market.move_clock_forward(Duration::from_secs(*seconds));
        let pending_before = position.ops(&mut market).pending_borrowing_fee_value()?;
        let projected = market.total_pending_borrowing_fees(&prices, input.is_long)?;
        let report = market.update_borrowing(&prices)?.execute()?;
        // The tagged test clock includes wall time. Reject a delayed run rather than normalize it.
        if report.duration_in_seconds() != *seconds {
            return Err("Borrowing clock drift: rerun without wall-clock delay".into());
        }
        let pending_after = position.ops(&mut market).pending_borrowing_fee_value()?;
        checkpoints.push(json!({
            "elapsed_seconds": seconds, "pending_before_update_usd20": pending_before.to_string(),
            "projected_pending_usd20": projected.to_string(), "pending_after_update_usd20": pending_after.to_string(),
            "long_cumulative_factor": report.next_cumulative_borrowing_factor(true).to_string(),
            "short_cumulative_factor": report.next_cumulative_borrowing_factor(false).to_string()
        }));
    }
    let mut settlements = Vec::new();
    for _ in 0..2 {
        let mut ops = position.ops(&mut market);
        let report = ops
            .increase(
                prices,
                uint(&input.next_collateral_amount)?,
                next_size,
                None,
            )?
            .execute()?;
        settlements.push(json!({
            "cost_amount": report.fees().total_cost_amount()?.to_string(),
            "paid_fee_usd20": report.fees().paid_order_and_borrowing_fee_value().to_string(),
            "receiver_amount": report.fees().for_receiver()?.to_string(), "pool_amount": report.fees().for_pool::<20>()?.to_string(),
            "claimable_funding_amounts": [report.claimable_funding_amounts().0.to_string(), report.claimable_funding_amounts().1.to_string()],
            "collateral_amount": ops.collateral_amount().to_string(), "size_usd20": ops.size_in_usd().to_string(),
            "size_tokens": ops.size_in_tokens().to_string(), "position_borrowing_factor": ops.borrowing_factor().to_string(),
            "pending_borrowing_usd20": ops.pending_borrowing_fee_value()?.to_string(),
            "total_borrowing_usd20": ops.market().total_borrowing_pool()?.amount(input.is_long)?.to_string(),
            "liquidity_collateral_amount": ops.market().liquidity_pool()?.amount(input.is_long_collateral)?.to_string(),
            "claimable_fee_collateral_amount": ops.market().claimable_fee_pool()?.amount(input.is_long_collateral)?.to_string()
        }));
    }
    Ok(
        json!({"status": "ok", "opened": opened, "factor_per_second": rate.to_string(), "checkpoints": checkpoints, "settlements": settlements}),
    )
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
struct LiquidationImpactInput {
    positive_factor: String,
    negative_factor: String,
    max_negative_factor: String,
    liquidation_cap_factor: String,
    opposite_size_usd20: String,
    opposite_collateral_amount: String,
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

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LiquidationBorrowingInput {
    factor: String,
    elapsed_seconds: Vec<u64>,
}

fn liquidation_check(
    input: &LiquidationInput,
    impact: Option<&LiquidationImpactInput>,
    borrowing: Option<&LiquidationBorrowingInput>,
) -> Result<Value> {
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
        .max_negative_position_impact_factor(
            impact
                .map(|v| factor(&v.max_negative_factor))
                .transpose()?
                .unwrap_or(0),
        )
        .max_position_impact_factor_for_liquidations(
            impact
                .map(|v| factor(&v.liquidation_cap_factor))
                .transpose()?
                .unwrap_or(0),
        )
        .build();
    // Existing operations retain their original clock behavior.
    let no_impact = PriceImpactParams::builder()
        .exponent(UNIT)
        .positive_factor(0)
        .negative_factor(0)
        .build();
    config.position_impact_params = no_impact;
    if let Some(impact) = impact {
        config.position_impact_params = PriceImpactParams::builder()
            .exponent(UNIT)
            .positive_factor(factor(&impact.positive_factor)?)
            .negative_factor(factor(&impact.negative_factor)?)
            .build();
    }
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
    if let Some(borrowing) = borrowing {
        if borrowing.elapsed_seconds.is_empty()
            || borrowing.elapsed_seconds.iter().any(|v| *v > 31_536_000)
        {
            return Err(
                "Expected nonempty borrowing liquidation intervals of at most one year".into(),
            );
        }
        let rate = factor(&borrowing.factor)?;
        config.borrowing_fee_params = BorrowingFeeParams::builder()
            .receiver_factor(0)
            .exponent_for_long(UNIT)
            .exponent_for_short(UNIT)
            .factor_for_long(rate)
            .factor_for_short(rate)
            .skip_borrowing_fee_for_smaller_side(false)
            .build();
        config.borrowing_fee_kink_model_params = BorrowingFeeKinkModelParamsForOneSide::builder()
            .optimal_usage_factor(0)
            .base_borrowing_factor(0)
            .above_optimal_usage_borrowing_factor(0)
            .build();
    }
    let mut market = TestMarket::<u128, 20>::with_config(config);
    market
        .deposit(
            uint(&input.deposit_long_amount)?,
            uint(&input.deposit_short_amount)?,
            entry,
        )?
        .execute()?;
    if borrowing.is_some() {
        let report = market.update_borrowing(&entry)?.execute()?;
        if report.duration_in_seconds() != 0 {
            return Err(
                "Expected borrowing liquidation clock initialization without elapsed time".into(),
            );
        }
    }
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
    // Add opposite OI through a separate real action after the target position opens.
    let mut opposite_report = Value::Null;
    if let Some(impact) = impact {
        let opposite_size = uint(&impact.opposite_size_usd20)?;
        let opposite_collateral = uint(&impact.opposite_collateral_amount)?;
        if opposite_size == 0 && opposite_collateral != 0 {
            return Err("Zero opposite size requires zero collateral".into());
        }
        if opposite_size != 0 {
            let mut opposite = if input.is_long {
                TestPosition::short(false)
            } else {
                TestPosition::long(false)
            };
            let report = opposite
                .ops(&mut market)
                .increase(entry, opposite_collateral, opposite_size, None)?
                .execute()?;
            opposite_report = json!({
                "impact_usd20": report.execution().price_impact_value().to_string(),
                "size_tokens": report.execution().size_delta_in_tokens().to_string(),
                "execution_price": report.execution().execution_price().to_string(),
                "claimable_funding_amounts": [report.claimable_funding_amounts().0.to_string(), report.claimable_funding_amounts().1.to_string()]
            });
        }
    }
    let state = json!({
        "long_oi_usd20": market.open_interest()?.long_amount()?.to_string(),
        "short_oi_usd20": market.open_interest()?.short_amount()?.to_string(),
        "opposite_report": opposite_report
    });
    let mut borrowing_output = Value::Null;
    if let Some(borrowing) = borrowing {
        let mut before_probes = Vec::new();
        for prices in &probes {
            let ops = position.ops(&mut market);
            before_probes.push(json!({
                "reason": ops.check_liquidatable(prices, true, true)?.map(|v| v.to_string()),
                "margin_reason": ops.check_liquidatable(prices, true, false)?.map(|v| v.to_string())
            }));
        }
        let rate = market.borrowing_factor_per_second(input.is_long, &entry)?;
        let mut checkpoints = Vec::new();
        for seconds in &borrowing.elapsed_seconds {
            market.move_clock_forward(Duration::from_secs(*seconds));
            let pending_before = position.ops(&mut market).pending_borrowing_fee_value()?;
            let report = market.update_borrowing(&entry)?.execute()?;
            if report.duration_in_seconds() != *seconds {
                return Err(
                    "Borrowing liquidation clock drift: rerun without wall-clock delay".into(),
                );
            }
            checkpoints.push(json!({
                "elapsed_seconds": seconds,
                "pending_before_update_usd20": pending_before.to_string(),
                "pending_after_update_usd20": position.ops(&mut market).pending_borrowing_fee_value()?.to_string(),
                "long_cumulative_factor": report.next_cumulative_borrowing_factor(true).to_string(),
                "short_cumulative_factor": report.next_cumulative_borrowing_factor(false).to_string()
            }));
        }
        borrowing_output = json!({"factor_per_second": rate.to_string(), "before_probes": before_probes, "checkpoints": checkpoints});
    }
    let ops = position.ops(&mut market);
    let include_impact = impact.is_some();
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
            let mut output = json!({
                "status": "ok", "pnl_usd20": pnl.to_string(),
                "collateral_usd20": collateral.to_string(), "closing_cost_amount": cost.to_string(),
                "impact_usd20": impact.value.to_string(),
                "liquidatable": reason.is_some(), "reason": reason,
                "margin_insufficient": margin_reason.is_some(), "margin_reason": margin_reason
            });
            if include_impact {
                let mut effective = impact.value;
                if effective < 0 {
                    ops.market().cap_negative_position_price_impact(
                        &-i128::try_from(size).map_err(|_| {
                            gmsol_model::Error::Computation("size exceeds signed range")
                        })?,
                        true,
                        &mut effective,
                    )?;
                } else {
                    effective = 0;
                }
                output["effective_impact_usd20"] = json!(effective.to_string());
            }
            Ok(output)
        })();
        results.push(match result {
            Ok(value) => value,
            Err(error) => model_error(error),
        });
    }
    let mut output = json!({"status": "ok", "opened": opened, "probes": results});
    if include_impact {
        output["state"] = state;
    }
    if borrowing.is_some() {
        output["borrowing"] = borrowing_output;
    }
    Ok(output)
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
        Input::FundingDistribution { scenario } => funding_distribution(scenario),
        Input::DynamicFunding { scenario } => dynamic_funding(scenario, false, false, None, None),
        Input::DynamicFundingSettlement {
            scenario,
            is_long_collateral,
        } => dynamic_funding(scenario, true, *is_long_collateral, None, None),
        Input::DynamicFundingSingleSide {
            scenario,
            is_long_collateral,
            transition,
        } => dynamic_funding(scenario, true, *is_long_collateral, Some(transition), None),
        Input::DynamicFundingMixed {
            scenario,
            long_collateral_factors,
        } => {
            let factors = [
                factor(&long_collateral_factors[0])?,
                factor(&long_collateral_factors[1])?,
            ];
            if factors.iter().any(|value| *value == 0 || *value == UNIT) {
                return Err(
                    "Mixed funding requires both collateral shares strictly between zero and one"
                        .into(),
                );
            }
            dynamic_funding(scenario, true, false, None, Some(factors))
        }
        Input::FundingAccrual { scenario } => funding_accrual(scenario),
        Input::BorrowingAccrual { scenario } => borrowing_accrual(scenario, None),
        Input::BorrowingKink { scenario, params } => borrowing_accrual(scenario, Some(params)),
        Input::IncreaseImpact { scenario } => increase_impact(scenario),
        Input::LiquidationBorrowing {
            scenario,
            borrowing,
        } => liquidation_check(scenario, None, Some(borrowing)),
        Input::LiquidationCheck { scenario } => liquidation_check(scenario, None, None),
        Input::LiquidationImpact { scenario, impact } => {
            liquidation_check(scenario, Some(impact), None)
        }
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
        "units": {"usd_decimals": "20", "factor_decimals": "20", "shared_usd_decimals": "30", "prices": "USD20 per raw token unit", "token_amounts": "raw units; decimals specified per case or documented per-operation fixtures", "fee_amount": "same unit as input amount; not implicitly USD", "tolerance": "0"},
        "scope": ["FeeParams::fee", "PerpMarketExt::cap_positive_position_price_impact", "PositionExt::pnl_value", "PositionExt::check_liquidatable (zero-impact, no elapsed funding/borrowing; deposit/increase initialized)", "IncreasePosition::execute (linear impact; explicit pool snapshot; acceptable-price boundaries)", "PositionExt::check_liquidatable (nonzero linear impact; real opposite OI; liquidation impact cap and margin boundaries)", "UpdateBorrowingState and IncreasePosition::execute (linear borrowing; explicit intervals; settlement and no double charge)", "UpdateFundingState and IncreasePosition::execute (linear fallback funding; payer ceil and receiver floor; claimable report reset)", "UpdateFundingState (dynamic funding; signed rate transitions, thresholds and bounds; real OI actions)", "UpdateFundingState and IncreasePosition::execute (asymmetric collateral OI and single-sided fallback funding)", "Dynamic funding reversal pending fees and IncreasePosition::execute settlement snapshots", "Real full closes followed by single-sided dynamic funding updates and survivor settlement", "Mixed-collateral dynamic reversal funding and two-token claimable settlement", "Borrowing kink usage boundaries and strict smaller-side skipping", "Liquidation predicates after real borrowing accrual"],
        "cases": cases
    });
    // Buffer all cases before writing stdout; callers must still publish output atomically.
    let mut output = serde_json::to_vec_pretty(&result)?;
    output.push(b'\n');
    io::stdout().lock().write_all(&output)?;
    Ok(())
}
