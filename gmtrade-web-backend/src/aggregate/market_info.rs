//! Assemble the per-market [`MarketInfo`] DTO from the legacy `indexData` contract.

use gmsol_keeper_client::FetchedMarket;

use crate::aggregate::market::MarketValuation;
use crate::aggregate::raw_market::RawMarketFields;
use crate::dto::MarketInfo;
use crate::tokens::{get_unit, TokenRow, USD_DECIMALS};

/// `MulDiv(a, b, c) = a * b / c` via a U256 intermediate, truncating, returning `0` when `c == 0`.
pub(crate) fn mul_div(a: u128, b: u128, c: u128) -> u128 {
    use gmsol_sdk::model::num::MulDiv;
    if c == 0 {
        return 0;
    }
    // None only if the final quotient itself exceeds u128 (USD values fit) -> saturate.
    a.checked_mul_div(&b, &c).unwrap_or(u128::MAX)
}

/// `getRatePerHour = ratePerSecond * -3600`. Signed (funding can be negative).
pub(crate) fn rate_per_hour(rate_per_second: i128) -> i128 {
    rate_per_second.saturating_mul(-3600)
}

pub(crate) fn safe_pool_value(min: u128, max: u128) -> u128 {
    (min.saturating_add(max)) / 2
}

/// Sign-preserving variant for `pending_pnl_for_*`; truncates toward zero.
pub(crate) fn safe_signed_pool_value(min: i128, max: i128) -> i128 {
    (min.saturating_add(max)) / 2
}

/// `getPoolTokenAmount`: when `is_pure`, the long slot halved regardless of side.
pub(crate) fn pool_token_amount(
    long_token_amount: u128,
    short_token_amount: u128,
    is_pure: bool,
    is_long: bool,
) -> u128 {
    if is_pure {
        return long_token_amount / 2;
    }
    if is_long {
        long_token_amount
    } else {
        short_token_amount
    }
}

/// `getGmMaxPoolAmount`: `cap = max_pool_value_for_deposit / mid_price`; return `max_pool_amount` if cap `<= 0` or `mid_price == 0`, else `min`.
pub(crate) fn gm_max_pool_amount(
    max_pool_value_for_deposit: u128,
    max_pool_amount: u128,
    mid_price: u128,
) -> u128 {
    if mid_price == 0 {
        return max_pool_amount;
    }
    let max_pool_amount_for_deposit = max_pool_value_for_deposit / mid_price;
    if max_pool_amount_for_deposit == 0 {
        return max_pool_amount;
    }
    max_pool_amount.min(max_pool_amount_for_deposit)
}

/// Deposit capacity: `max(gm_max_pool_amount - pool_token_amount, 0)`.
pub(crate) fn deposit_capacity(gm_max_pool_amount: u128, pool_token_amount: u128) -> u128 {
    gm_max_pool_amount.saturating_sub(pool_token_amount)
}

/// `GetMarketAvailableLiquidityUsdForCollateral`: `nonneg(pool_token_amount*mid_price - reserved_usd*10^USD_DECIMALS/reserve_factor)`; pnl term always 0.
pub(crate) fn market_available_liquidity_usd(
    pool_token_amount: u128,
    mid_price: u128,
    reserved_usd: u128,
    reserve_factor: u128,
) -> u128 {
    let pool_usd = pool_token_amount.saturating_mul(mid_price);
    let min_pool_usd_reserve = mul_div(reserved_usd, get_unit(USD_DECIMALS), reserve_factor);
    // minPoolUsdPnl is always 0 in the Go (pnl branch commented out).
    let min_pool_usd = min_pool_usd_reserve;
    pool_usd.saturating_sub(min_pool_usd)
}

/// `getGmSellableMarketToken`: returns `(max_long_sellable_usd, max_short_sellable_usd)`; any zero input -> `(0,0)`; else scales against `ratio = long_pool_usd * 10^20 / short_pool_usd`.
pub(crate) fn gm_sellable(
    long_pool_usd: u128,
    short_pool_usd: u128,
    long_liquidity_usd: u128,
    short_liquidity_usd: u128,
) -> (u128, u128) {
    let one = get_unit(USD_DECIMALS);
    if long_pool_usd == 0
        || short_pool_usd == 0
        || long_liquidity_usd == 0
        || short_liquidity_usd == 0
    {
        return (0, 0);
    }
    let ratio = mul_div(long_pool_usd, one, short_pool_usd);
    let scaled_short = mul_div(short_liquidity_usd, ratio, one);
    if scaled_short <= long_liquidity_usd {
        (scaled_short, short_liquidity_usd)
    } else {
        (long_liquidity_usd, mul_div(long_liquidity_usd, one, ratio))
    }
}

/// `computeSwapDirection`: 4-constraint swap-available-liquidity, `min(d1..d4)` clamped `>= 0`; returns `0` if `reserve_factor` or `max_pnl_factor` is `0`. i128 preserves negative `pending_pnl`.
#[allow(clippy::too_many_arguments)]
pub(crate) fn swap_available_liquidity(
    pool_value_out: i128,
    pool_value_in: i128,
    pending_pnl_out: i128,
    reserved_value_out: i128,
    reserve_factor: i128,
    max_pool_amount_in: i128,
    max_pnl_factor: i128,
    price_in_min: i128,
) -> i128 {
    if reserve_factor == 0 || max_pnl_factor == 0 {
        return 0;
    }

    let d1 = pool_value_out;

    let temp = max_pool_amount_in.saturating_mul(price_in_min);
    let d2 = temp.saturating_sub(pool_value_in).max(0);

    let reserved_div = reserved_value_out / reserve_factor;
    let d3 = pool_value_out.saturating_sub(reserved_div).max(0);

    let pnl_div = pending_pnl_out / max_pnl_factor;
    let d4 = pool_value_out.saturating_sub(pnl_div).max(0);

    let delta_max = d1.min(d2).min(d3).min(d4);
    delta_max.max(0)
}

/// `getMaxLeverage`: larger of per-side `floor(10^40 / f)` (zero `f` skips that side), exact via [`MulDiv::checked_mul_div`].
pub(crate) fn max_leverage(
    min_collateral_factor_for_long: u128,
    min_collateral_factor_for_short: u128,
) -> u128 {
    use gmsol_sdk::model::num::MulDiv;
    let scale = get_unit(USD_DECIMALS); // 10^20
    let lev = |f: u128| -> u128 { scale.checked_mul_div(&scale, &f).unwrap_or(0) };
    let long_lev = lev(min_collateral_factor_for_long);
    let short_lev = lev(min_collateral_factor_for_short);
    long_lev.max(short_lev)
}

/// Build the per-market [`MarketInfo`] DTO from already-converted GMX unit `*_px` prices and injected `volume24h`.
#[allow(clippy::too_many_arguments)]
pub fn build_market_info(
    fetched: &FetchedMarket,
    valuation: &MarketValuation,
    raw: &RawMarketFields,
    index_token: &TokenRow,
    long_token: &TokenRow,
    short_token: &TokenRow,
    index_px: (u128, u128),
    long_px: (u128, u128),
    short_px: (u128, u128),
    volume24h: &str,
) -> MarketInfo {
    let status = &valuation.status;

    // `*_px` are already GMX unit prices; pass them through as-is without re-converting.
    let idx_min_unit = index_px.0;
    let idx_max_unit = index_px.1;
    let long_min_unit = long_px.0;
    let long_max_unit = long_px.1;
    let short_min_unit = short_px.0;
    let short_max_unit = short_px.1;

    let prices = vec![
        idx_min_unit.to_string(),
        idx_max_unit.to_string(),
        long_min_unit.to_string(),
        long_max_unit.to_string(),
        short_min_unit.to_string(),
        short_max_unit.to_string(),
    ];

    let unit_price = safe_pool_value(idx_min_unit, idx_max_unit);

    let long_mid_unit = safe_pool_value(long_min_unit, long_max_unit);
    let short_mid_unit = safe_pool_value(short_min_unit, short_max_unit);

    let long_funding = rate_per_hour(status.funding_rate_per_second_for_long);
    let short_funding = rate_per_hour(status.funding_rate_per_second_for_short);
    // borrowing is u128 on-chain; widen to i128 before the signed -3600 multiply.
    let long_borrowing = rate_per_hour(status.borrowing_rate_per_second_for_long as i128);
    let short_borrowing = rate_per_hour(status.borrowing_rate_per_second_for_short as i128);
    let long_net = long_funding.saturating_add(long_borrowing);
    let short_net = short_funding.saturating_add(short_borrowing);

    let pool_value_long = safe_pool_value(
        status.pool_value_without_pnl_for_long.min,
        status.pool_value_without_pnl_for_long.max,
    );
    let pool_value_short = safe_pool_value(
        status.pool_value_without_pnl_for_short.min,
        status.pool_value_without_pnl_for_short.max,
    );

    let long_token_amount = pool_token_amount(
        raw.long_token_amount,
        raw.short_token_amount,
        raw.is_pure,
        true,
    );
    let short_token_amount = pool_token_amount(
        raw.long_token_amount,
        raw.short_token_amount,
        raw.is_pure,
        false,
    );

    let gm_max_long = gm_max_pool_amount(
        valuation.max_pool_value_for_deposit_long,
        valuation.max_pool_amount_long,
        long_mid_unit,
    );
    let gm_max_short = gm_max_pool_amount(
        valuation.max_pool_value_for_deposit_short,
        valuation.max_pool_amount_short,
        short_mid_unit,
    );
    let long_deposit_capacity = deposit_capacity(gm_max_long, long_token_amount);
    let short_deposit_capacity = deposit_capacity(gm_max_short, short_token_amount);

    let long_liq_usd = market_available_liquidity_usd(
        long_token_amount,
        long_mid_unit,
        status.reserved_value_for_long,
        raw.reserve_factor,
    );
    let short_liq_usd = market_available_liquidity_usd(
        short_token_amount,
        short_mid_unit,
        status.reserved_value_for_short,
        raw.reserve_factor,
    );
    let (max_long_sellable_usd, max_short_sellable_usd) = gm_sellable(
        pool_value_long,
        pool_value_short,
        long_liq_usd,
        short_liq_usd,
    );

    // priceInMin is the IN token's RAW min price; long->short uses long raw min.
    let long_to_short = swap_available_liquidity(
        pool_value_short as i128,
        pool_value_long as i128,
        safe_signed_pool_value(
            status.pending_pnl_for_short.min,
            status.pending_pnl_for_short.max,
        ),
        status.reserved_value_for_short as i128,
        raw.reserve_factor as i128,
        raw.max_pool_amount_for_long_token as i128,
        raw.max_pnl_factor_for_short_withdrawal as i128,
        long_px.0 as i128,
    );
    let short_to_long = swap_available_liquidity(
        pool_value_long as i128,
        pool_value_short as i128,
        safe_signed_pool_value(
            status.pending_pnl_for_long.min,
            status.pending_pnl_for_long.max,
        ),
        status.reserved_value_for_long as i128,
        raw.reserve_factor as i128,
        raw.max_pool_amount_for_short_token as i128,
        raw.max_pnl_factor_for_long_withdrawal as i128,
        short_px.0 as i128,
    );

    // tvl = long_balance * longMinUnit + short_balance * shortMinUnit.
    let tvl = raw
        .long_token_balance
        .saturating_mul(long_min_unit)
        .saturating_add(raw.short_token_balance.saturating_mul(short_min_unit));

    // Token rows are kept only for call-site symmetry; prices arrive pre-scaled.
    let _ = (index_token, long_token, short_token);

    MarketInfo {
        index_token: fetched.index_token_mint.clone(),
        market_token: fetched.market_token.clone(),
        long_token: fetched.long_token_mint.clone(),
        short_token: fetched.short_token_mint.clone(),
        unit_price: unit_price.to_string(),
        volume24h: volume24h.to_string(),
        long_open_interest: status.open_interest_for_long.to_string(),
        short_open_interest: status.open_interest_for_short.to_string(),
        lp_long: status.liquidity_for_long.to_string(),
        lp_short: status.liquidity_for_short.to_string(),
        max_leverage: max_leverage(
            status.min_collateral_factor_for_long,
            status.min_collateral_factor_for_short,
        )
        .to_string(),
        long_funding_fee_rate_hour: long_funding.to_string(),
        long_borrowing_fee_rate_hour: long_borrowing.to_string(),
        long_net_rate_per_hour: long_net.to_string(),
        short_funding_fee_rate_hour: short_funding.to_string(),
        short_borrowing_fee_rate_hour: short_borrowing.to_string(),
        short_net_rate_per_hour: short_net.to_string(),
        reserved_value_for_long: status.reserved_value_for_long.to_string(),
        max_reserve_value_for_long: status.max_reserve_value_for_long.to_string(),
        open_interest_for_long: status.open_interest_for_long.to_string(),
        max_open_interest_for_long: raw.max_open_interest_for_long.to_string(),
        reserved_value_for_short: status.reserved_value_for_short.to_string(),
        max_reserve_value_for_short: status.max_reserve_value_for_short.to_string(),
        open_interest_for_short: status.open_interest_for_short.to_string(),
        max_open_interest_for_short: raw.max_open_interest_for_short.to_string(),
        prices,
        supply: fetched.supply.to_string(),
        market_decimals: fetched.market_token_decimals.to_string(),
        min_collateral_factor_for_long: status.min_collateral_factor_for_long.to_string(),
        min_collateral_factor_for_short: status.min_collateral_factor_for_short.to_string(),
        min_collateral_value: raw.min_collateral_value.to_string(),
        long_to_short_available_liquidity: long_to_short.to_string(),
        short_to_long_available_liquidity: short_to_long.to_string(),
        market_price: valuation.market_token_price.to_string(),
        long_token_amount: long_token_amount.to_string(),
        short_token_amount: short_token_amount.to_string(),
        pool_value_long: pool_value_long.to_string(),
        pool_value_short: pool_value_short.to_string(),
        long_deposit_capacity_amount: long_deposit_capacity.to_string(),
        short_deposit_capacity_amount: short_deposit_capacity.to_string(),
        max_long_sellable_usd: max_long_sellable_usd.to_string(),
        max_short_sellable_usd: max_short_sellable_usd.to_string(),
        // vi* are VI account address strings from marin, empty when None.
        vi_for_swaps: fetched.virtual_inventory_for_swaps.clone(),
        vi_for_positions: fetched.virtual_inventory_for_positions.clone(),
        // ml* come from MarketStatus.max_liquidity, NOT max_pnl_factor_*_withdrawal (Go :719-720).
        ml_for_long: status.max_liquidity_for_long.to_string(),
        ml_for_short: status.max_liquidity_for_short.to_string(),
        off_for_positive: raw.order_fee_factor_for_positive_impact.to_string(),
        off_for_negative: raw.order_fee_factor_for_negative_impact.to_string(),
        mcmcf_for_liquidation: raw
            .market_closed_min_collateral_factor_for_liquidation
            .to_string(),
        closed: raw.closed,
        tvl: tvl.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    use gmsol_sdk::model::MarketModel;
    use gmsol_sdk::programs::bytemuck::Zeroable;
    use gmsol_sdk::programs::gmsol_store::accounts::Market;

    use crate::aggregate::market::{prices_from_raw, value_market};
    use crate::aggregate::raw_market::extract_raw_fields;
    use crate::tokens::token_by_symbol;
    use gmsol_sdk::constants::MARKET_USD_UNIT;

    #[test]
    fn mul_div_basic() {
        assert_eq!(mul_div(6, 7, 3), 14);
        // truncation: 7 * 3 / 2 = 21/2 = 10
        assert_eq!(mul_div(7, 3, 2), 10);
        // zero divisor -> 0 (defensive, no panic)
        assert_eq!(mul_div(5, 5, 0), 0);
        let one = get_unit(USD_DECIMALS);
        assert_eq!(mul_div(123, one, one), 123);
    }

    #[test]
    fn safe_signed_pool_value_can_be_negative() {
        // truncates toward zero (not floor).
        assert_eq!(safe_signed_pool_value(-10, 4), -3);
        assert_eq!(safe_signed_pool_value(-3, 3), 0);
        assert_eq!(safe_signed_pool_value(-7, -1), -4);
    }

    #[test]
    fn pool_token_amount_is_pure_halves_long_slot() {
        // is_pure: long slot (100) halved, regardless of side.
        assert_eq!(pool_token_amount(100, 999, true, true), 50);
        assert_eq!(pool_token_amount(100, 999, true, false), 50);
    }

    #[test]
    fn gm_max_pool_amount_picks_min() {
        // deposit cap = 1000 / 10 = 100; max_pool_amount = 80 -> min = 80
        assert_eq!(gm_max_pool_amount(1000, 80, 10), 80);
        assert_eq!(gm_max_pool_amount(1000, 150, 10), 100);
    }

    #[test]
    fn market_available_liquidity_usd_hand_computed() {
        // poolUsd=4*5=20; reserved=2, factor=10^20 -> minReserve=2; liquidity=18.
        let one = get_unit(USD_DECIMALS);
        assert_eq!(market_available_liquidity_usd(4, 5, 2, one), 18);
    }

    #[test]
    fn gm_sellable_ratio_scaling() {
        // ratio=2*10^20; scaled_short=30*2=60 <= long_liq(100) -> (60, 30).
        assert_eq!(gm_sellable(200, 100, 100, 30), (60, 30));
    }

    #[test]
    fn mul_div_no_u128_overflow_on_1e20_scaled_usd() {
        // U256 intermediate keeps the 1e20-scaled product exact (no u128 saturation).
        let one = get_unit(USD_DECIMALS); // 1e20
        let short_liq = 4_900_000_000_000_000_000_000_000u128; // 4.9e24
        assert_eq!(mul_div(short_liq, one, one), short_liq);
        assert_ne!(mul_div(short_liq, one, one), 3_402_823_053_506_720_402);
    }

    #[test]
    fn gm_sellable_no_overflow_on_real_magnitudes() {
        // Balanced 1e20-scaled USD pool yields (short_liq, short_liq) with no saturation.
        let pool = 2_000_000_000_000_000_000_000_000u128; // 2e24
        let liq = 1_800_000_000_000_000_000_000_000u128; // 1.8e24
        assert_eq!(gm_sellable(pool, pool, liq, liq), (liq, liq));
    }

    #[test]
    fn swap_negative_pnl_increases_d4() {
        // pendingPnlOut negative -> pnlDiv negative -> d4 = pvOut - (neg) > pvOut.
        let v = swap_available_liquidity(100, 0, -100, 0, 10, 1_000_000_000, 10, 1);
        assert_eq!(v, 100);
    }

    #[test]
    fn max_leverage_is_exact_for_non_dividing_factor() {
        // checked_mul_div computes exact floor(10^40 / f) even when f doesn't divide evenly.
        let f = get_unit(18) + 1;
        let exact: u128 = 9_999_999_999_999_999_990_000;
        assert_eq!(max_leverage(f, f), exact);
        // It is NOT the old floor-then-multiply truncation (10^20/f)*10^20.
        let truncated = (get_unit(USD_DECIMALS) / f) * get_unit(USD_DECIMALS);
        assert_eq!(truncated, 9_900_000_000_000_000_000_000);
        assert_ne!(max_leverage(f, f), truncated);
    }

    fn unit_prices_tuple() -> (u128, u128) {
        (MARKET_USD_UNIT, MARKET_USD_UNIT)
    }

    #[test]
    fn golden_shape_key_set_matches_dto() {
        // Build from a zeroed model + synthetic raw + real SOL TokenRow.
        let model = MarketModel::from_parts(Arc::new(Market::zeroed()), 0);
        let prices = prices_from_raw(
            unit_prices_tuple(),
            unit_prices_tuple(),
            unit_prices_tuple(),
        );
        let valuation = value_market(&model, &prices).expect("valuation");
        let raw = extract_raw_fields(&model);
        let sol = token_by_symbol("SOL").unwrap();

        let fetched = FetchedMarket {
            market_token: "MARKET_TOKEN".to_string(),
            index_token_mint: "INDEX".to_string(),
            long_token_mint: "LONG".to_string(),
            short_token_mint: "SHORT".to_string(),
            supply: 1_000_000,
            // Non-9 value proves real per-market decimals flow through (not hardcoded 9).
            market_token_decimals: 6,
            // Real VI account ADDRESSES from marin (not the old "0" placeholder).
            virtual_inventory_for_swaps: "ViSwaps111".to_string(),
            virtual_inventory_for_positions: "ViPositions222".to_string(),
            ..Default::default()
        };

        let info = build_market_info(
            &fetched,
            &valuation,
            &raw,
            sol,
            sol,
            sol,
            unit_prices_tuple(),
            unit_prices_tuple(),
            unit_prices_tuple(),
            "12345",
        );

        let value = serde_json::to_value(&info).expect("serialize");
        let obj = value.as_object().expect("object");

        assert!(obj.get("closed").unwrap().is_boolean());

        // Every expected camelCase key (incl. anomalous ones) must be present.
        let expected_keys = [
            "indexToken",
            "marketToken",
            "longToken",
            "shortToken",
            "unitPrice",
            "volume24h",
            "longOpenInterest",
            "shortOpenInterest",
            "lpLong",
            "lpShort",
            "maxLeverage",
            "longFundingFeeRateHour",
            "longBorrowingFeeRateHour",
            "longNetRatePerHour",
            "shortFundingFeeRateHour",
            "shortBorrowingFeeRateHour",
            "shortNetRatePerHour",
            "reservedValueForLong",
            "maxReserveValueForLong",
            "openInterestForLong",
            "maxOpenInterestForLong",
            "reservedValueForShort",
            "maxReserveValueForShort",
            "openInterestForShort",
            "maxOpenInterestForShort",
            "prices",
            "supply",
            "marketDecimals",
            "minCollateralFactorForLong",
            "minCollateralFactorForShort",
            "minCollateralValue",
            "longToShortAvailableLiquidity",
            "shortToLongAvailableLiquidity",
            "marketPrice",
            "longTokenAmount",
            "shortTokenAmount",
            "poolValueLong",
            "poolValueShort",
            "longDepositCapacityAmount",
            "shortDepositCapacityAmount",
            "maxLongSellableUsd",
            "maxShortSellableUsd",
            "viForSwaps",
            "viForPositions",
            "mlForLong",
            "mlForShort",
            "oFFForPositive",
            "oFFForNegative",
            "mCMCFForLiquidation",
            "closed",
            "tvl",
        ];
        for k in expected_keys {
            assert!(obj.contains_key(k), "missing key {k}");
        }
        assert_eq!(
            obj.len(),
            expected_keys.len(),
            "unexpected key count; keys = {:?}",
            obj.keys().collect::<Vec<_>>()
        );

        let prices = obj.get("prices").unwrap().as_array().unwrap();
        assert_eq!(prices.len(), 6);
        // `*_px` unit prices pass through unchanged, so every displayed price equals MARKET_USD_UNIT.
        let unit = MARKET_USD_UNIT.to_string();
        for p in prices {
            assert_eq!(
                p.as_str().unwrap(),
                unit,
                "display price must not be re-scaled"
            );
        }
        assert_eq!(
            obj.get("unitPrice").unwrap(),
            &unit,
            "unitPrice must not be re-scaled"
        );
        // marketDecimals is the real per-market mint decimals (here 6), NOT hardcoded 9.
        assert_eq!(obj.get("marketDecimals").unwrap(), "6");
        // vi* are real VI account ADDRESS strings from marin, NOT the old "0" placeholder.
        assert_eq!(obj.get("viForSwaps").unwrap(), "ViSwaps111");
        assert_eq!(obj.get("viForPositions").unwrap(), "ViPositions222");
        assert_eq!(obj.get("volume24h").unwrap(), "12345");
        assert_eq!(obj.get("supply").unwrap(), "1000000");
        assert_eq!(obj.get("marketToken").unwrap(), "MARKET_TOKEN");
    }
}
