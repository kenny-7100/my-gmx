//! Raw on-chain `Market` field extraction for fields not covered by gmsol-sdk valuation.

use gmsol_sdk::core::market::MarketFlag;
use gmsol_sdk::model::MarketModel;

/// Raw on-chain `Market` fields not covered by `MarketStatus` / `MarketValuation`.
#[derive(Debug, Clone)]
pub struct RawMarketFields {
    pub reserve_factor: u128,
    pub max_open_interest_for_long: u128,
    pub max_open_interest_for_short: u128,
    pub min_collateral_value: u128,
    pub max_pool_amount_for_long_token: u128,
    pub max_pool_amount_for_short_token: u128,
    pub max_pnl_factor_for_long_withdrawal: u128,
    pub max_pnl_factor_for_short_withdrawal: u128,
    pub order_fee_factor_for_positive_impact: u128,
    pub order_fee_factor_for_negative_impact: u128,
    pub market_closed_min_collateral_factor_for_liquidation: u128,

    pub long_token_amount: u128,
    pub short_token_amount: u128,
    /// `is_pure` (`u8 != 0`).
    pub is_pure: bool,

    /// `u64` on-chain, widened to `u128` (for TVL).
    pub long_token_balance: u128,
    pub short_token_balance: u128,

    pub closed: bool,
    /// drives `gtEnabled`.
    pub enabled: bool,
    // NOTE: virtual-inventory not carried here; it's threaded from marin via `FetchedMarket`.
}

/// Extract the raw on-chain fields from a [`MarketModel`]. Never panics; pure projection.
pub fn extract_raw_fields(model: &MarketModel) -> RawMarketFields {
    let market = &**model;
    let config = &market.config;
    let primary = &market.state.pools.primary.pool;
    let other = &market.state.other;

    RawMarketFields {
        reserve_factor: config.reserve_factor,
        max_open_interest_for_long: config.max_open_interest_for_long,
        max_open_interest_for_short: config.max_open_interest_for_short,
        min_collateral_value: config.min_collateral_value,
        max_pool_amount_for_long_token: config.max_pool_amount_for_long_token,
        max_pool_amount_for_short_token: config.max_pool_amount_for_short_token,
        max_pnl_factor_for_long_withdrawal: config.max_pnl_factor_for_long_withdrawal,
        max_pnl_factor_for_short_withdrawal: config.max_pnl_factor_for_short_withdrawal,
        order_fee_factor_for_positive_impact: config.order_fee_factor_for_positive_impact,
        order_fee_factor_for_negative_impact: config.order_fee_factor_for_negative_impact,
        market_closed_min_collateral_factor_for_liquidation: config
            .market_closed_min_collateral_factor_for_liquidation,

        long_token_amount: primary.long_token_amount,
        short_token_amount: primary.short_token_amount,
        is_pure: primary.is_pure != 0,

        // `u64` on this SDK rev, widened losslessly to `u128`.
        long_token_balance: u128::from(other.long_token_balance),
        short_token_balance: u128::from(other.short_token_balance),

        closed: market.flags.get_flag(MarketFlag::Closed),
        enabled: market.flags.get_flag(MarketFlag::Enabled),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    use gmsol_sdk::programs::bytemuck::Zeroable;
    use gmsol_sdk::programs::gmsol_store::accounts::Market;

    fn zeroed_model() -> MarketModel {
        MarketModel::from_parts(Arc::new(Market::zeroed()), 0)
    }

    /// Proves we read the RIGHT fields: mutate config/pool/other-state, assert they surface.
    #[test]
    fn extract_surfaces_mutated_fields() {
        let mut market = Market::zeroed();
        market.config.reserve_factor = 12_345;
        market.config.max_open_interest_for_long = 67_890;
        market.config.min_collateral_value = 999;
        market.state.pools.primary.pool.long_token_amount = 1_000;
        market.state.pools.primary.pool.short_token_amount = 2_000;
        market.state.pools.primary.pool.is_pure = 1;
        market.state.other.long_token_balance = 3_000;
        market.state.other.short_token_balance = 4_000;

        let model = MarketModel::from_parts(Arc::new(market), 0);
        let raw = extract_raw_fields(&model);

        assert_eq!(raw.reserve_factor, 12_345);
        assert_eq!(raw.max_open_interest_for_long, 67_890);
        assert_eq!(raw.min_collateral_value, 999);
        assert_eq!(raw.long_token_amount, 1_000);
        assert_eq!(raw.short_token_amount, 2_000);
        assert!(raw.is_pure);
        assert_eq!(raw.long_token_balance, 3_000);
        assert_eq!(raw.short_token_balance, 4_000);
    }

    /// Flag extraction: setting `Enabled`/`Closed` flips the right bits.
    #[test]
    fn extract_surfaces_flags() {
        let zeroed = extract_raw_fields(&zeroed_model());
        assert!(!zeroed.closed);
        assert!(!zeroed.enabled);

        let mut market = Market::zeroed();
        market.flags.set_flag(MarketFlag::Enabled, true);
        market.flags.set_flag(MarketFlag::Closed, true);

        let model = MarketModel::from_parts(Arc::new(market), 0);
        let raw = extract_raw_fields(&model);
        assert!(raw.enabled);
        assert!(raw.closed);
    }
}
