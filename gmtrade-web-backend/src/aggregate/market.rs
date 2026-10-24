//! Market valuation glue via `gmsol-sdk`'s [`MarketModel`], delegating all market math to the SDK.

use std::sync::Arc;

use eyre::{eyre, Result};

use gmsol_sdk::market::status::MarketStatus;
use gmsol_sdk::market::MarketCalculations;
use gmsol_sdk::model::price::{Price, Prices};
use gmsol_sdk::model::{
    BaseMarket, LiquidityMarket, LiquidityMarketExt, MarketModel, PnlFactorKind,
};
use gmsol_sdk::programs::gmsol_store::accounts::Market;
use gmsol_sdk::utils::zero_copy::try_deserialize_zero_copy_from_base64_with_options;

/// The gmsol-sdk-computed valuation truths for a single market.
#[derive(Debug, Clone)]
pub struct MarketValuation {
    /// GM token price, from `market_token_price(.., MaxAfterDeposit, true)`.
    pub market_token_price: u128,
    pub max_pool_value_for_deposit_long: u128,
    pub max_pool_value_for_deposit_short: u128,
    pub max_pool_amount_long: u128,
    pub max_pool_amount_short: u128,
    pub status: MarketStatus,
}

/// Build a [`MarketModel`] from a fetched market's base64 `Market` bytes and supply.
pub fn model_from_fetched(data_base64: &str, supply: u64) -> Result<MarketModel> {
    let z = try_deserialize_zero_copy_from_base64_with_options::<Market>(data_base64, true)
        .map_err(|e| eyre!("failed to deserialize Market from base64: {e:?}"))?;
    Ok(MarketModel::from_parts(Arc::new(z.0), supply))
}

/// Build a [`MarketModel`] directly from an already-decoded `Market` account.
pub fn model_from_account(market: Arc<Market>, supply: u64) -> MarketModel {
    MarketModel::from_parts(market, supply)
}

/// Parse a keeper raw price string into a `u128`; `None` on any parse failure.
pub fn parse_raw_price(raw: &str) -> Option<u128> {
    raw.parse::<u128>().ok()
}

/// Assemble a [`Prices`] from `(min, max)` raw-price tuples.
pub fn prices_from_raw(
    index: (u128, u128),
    long: (u128, u128),
    short: (u128, u128),
) -> Prices<u128> {
    Prices {
        index_token_price: Price {
            min: index.0,
            max: index.1,
        },
        long_token_price: Price {
            min: long.0,
            max: long.1,
        },
        short_token_price: Price {
            min: short.0,
            max: short.1,
        },
    }
}

/// Compute the full [`MarketValuation`] via gmsol-sdk, propagating any error.
pub fn value_market(model: &MarketModel, prices: &Prices<u128>) -> Result<MarketValuation> {
    prices
        .validate()
        .map_err(|e| eyre!("prices validation failed: {e:?}"))?;

    let status = model
        .status(prices)
        .map_err(|e| eyre!("model.status failed: {e:?}"))?;

    // Degrade to 0 (not Err) when the net pool value is negative so we don't drop the whole market.
    let market_token_price = model
        .market_token_price(prices, PnlFactorKind::MaxAfterDeposit, true)
        .unwrap_or(0);

    let max_pool_value_for_deposit_long = model
        .max_pool_value_for_deposit(true)
        .map_err(|e| eyre!("model.max_pool_value_for_deposit(true) failed: {e:?}"))?;
    let max_pool_value_for_deposit_short = model
        .max_pool_value_for_deposit(false)
        .map_err(|e| eyre!("model.max_pool_value_for_deposit(false) failed: {e:?}"))?;

    let max_pool_amount_long = model
        .max_pool_amount(true)
        .map_err(|e| eyre!("model.max_pool_amount(true) failed: {e:?}"))?;
    let max_pool_amount_short = model
        .max_pool_amount(false)
        .map_err(|e| eyre!("model.max_pool_amount(false) failed: {e:?}"))?;

    Ok(MarketValuation {
        market_token_price,
        max_pool_value_for_deposit_long,
        max_pool_value_for_deposit_short,
        max_pool_amount_long,
        max_pool_amount_short,
        status,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use gmsol_sdk::constants::MARKET_USD_UNIT;
    use gmsol_sdk::programs::bytemuck::Zeroable;

    fn unit_prices() -> Prices<u128> {
        prices_from_raw(
            (MARKET_USD_UNIT, MARKET_USD_UNIT),
            (MARKET_USD_UNIT, MARKET_USD_UNIT),
            (MARKET_USD_UNIT, MARKET_USD_UNIT),
        )
    }

    fn zeroed_model() -> MarketModel {
        MarketModel::from_parts(Arc::new(Market::zeroed()), 0)
    }

    #[test]
    fn model_from_fetched_rejects_garbage() {
        let err = model_from_fetched("not-base64!!!", 0);
        assert!(err.is_err(), "garbage base64 must Err, not panic");
    }

    /// `value_market` must return exactly the same numbers as direct gmsol-sdk calls.
    #[test]
    fn value_market_matches_direct_sdk_calls() {
        let model = zeroed_model();
        let prices = unit_prices();
        prices.validate().expect("valid");

        let direct_status = model.status(&prices).expect("status");
        let direct_price = model
            .market_token_price(&prices, PnlFactorKind::MaxAfterDeposit, true)
            .expect("price");
        let direct_mpv_long = model.max_pool_value_for_deposit(true).expect("mpv long");
        let direct_mpv_short = model.max_pool_value_for_deposit(false).expect("mpv short");
        let direct_mpa_long = model.max_pool_amount(true).expect("mpa long");
        let direct_mpa_short = model.max_pool_amount(false).expect("mpa short");

        let v = value_market(&model, &prices).expect("valuation");

        assert_eq!(v.market_token_price, direct_price);
        assert_eq!(v.max_pool_value_for_deposit_long, direct_mpv_long);
        assert_eq!(v.max_pool_value_for_deposit_short, direct_mpv_short);
        assert_eq!(v.max_pool_amount_long, direct_mpa_long);
        assert_eq!(v.max_pool_amount_short, direct_mpa_short);

        // Spot-check that the threaded status is the same value.
        assert_eq!(
            v.status.pool_value_without_pnl_for_long.min,
            direct_status.pool_value_without_pnl_for_long.min
        );
        assert_eq!(
            v.status.open_interest_for_long,
            direct_status.open_interest_for_long
        );
        assert_eq!(
            v.status.min_collateral_factor_for_long,
            direct_status.min_collateral_factor_for_long
        );
    }
}
