//! DTOs for the legacy Go web backend HTTP/WS contract, default camelCase with per-field overrides.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// HTTP /cache/prices/tickers + /v2/cache/prices/tickers — Go: TickersRes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ticker {
    pub token_address: String,
    pub token_symbol: String,
    pub min_price: String,
    pub max_price: String,
    pub updated_at: i64,
    pub timestamp: i64,
}

// WS topic "tickers" — Go: SolTickersRes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SolTicker {
    pub symbol: String,
    pub min_unit_price: String,
    pub max_unit_price: String,
    pub price: String,
    pub unit_price: String,
    pub timestamp: i64,
}

/// Used by `annPerformance`/`feeApy` — `ydata` is `f64` (vs `PriceLineData`'s `String`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineChartData {
    #[serde(rename = "timeStamp")]
    pub time_stamp: i64,
    pub ydata: f64,
}

/// Used by `gmPrices`/`glvPrices` — `ydata` is `String`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceLineData {
    #[serde(rename = "timeStamp")]
    pub time_stamp: i64,
    pub ydata: String,
}

// HTTP /v2/cache/daily/annPerformance + /v2/cache/daily/feeApy — Go: PoolLineData
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoolLineData {
    pub token_address: String,
    pub annualized: f64,
    pub line_charts: Vec<LineChartData>,
}

// HTTP /v2/cache/daily/gtUpdates — Go: GtUpdateds (timestamp is a STRING in Go)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GtUpdate {
    pub total_minted: String,
    pub timestamp: String,
    pub day_timestamp: i64,
}

// HTTP /v2/cache/prices/candles + WS "candles" — Go CandlesRes; inner array [i64,f64×5] as Vec<Value>
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandlesResp {
    pub candles: Vec<Vec<Value>>,
    pub period: String,
    pub token_symbol: String,
}

// HTTP /v2/cache/prices/indexData + WS "indexTokens" — Go IndexInfoResp (LongOpenInterest has capital-L tag)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexInfo {
    pub symbol: String,
    pub index_token: String,
    pub unit_price: String,
    pub price: String,
    pub percent_change24h: String,
    pub volume24h: String,
    /// Anomalous capital-L tag: Go `json:"LongOpenInterest"` (types.go line 156)
    #[serde(rename = "LongOpenInterest")]
    pub long_open_interest: String,
    pub short_open_interest: String,
    pub lp_long: String,
    pub lp_short: String,
    pub gt_enabled: bool,
    pub max_leverage: String,
    pub market_infos: Vec<MarketInfo>,
}

// Nested in IndexInfo — Go MarketInfoResp (LongOpenInterest here is LOWERCASE "longOpenInterest")
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketInfo {
    pub index_token: String,
    pub market_token: String,
    pub long_token: String,
    pub short_token: String,
    pub unit_price: String,
    pub volume24h: String,
    pub long_open_interest: String,
    pub short_open_interest: String,
    pub lp_long: String,
    pub lp_short: String,
    pub max_leverage: String,
    pub long_funding_fee_rate_hour: String,
    pub long_borrowing_fee_rate_hour: String,
    pub long_net_rate_per_hour: String,
    pub short_funding_fee_rate_hour: String,
    pub short_borrowing_fee_rate_hour: String,
    pub short_net_rate_per_hour: String,
    pub reserved_value_for_long: String,
    pub max_reserve_value_for_long: String,
    pub open_interest_for_long: String,
    pub max_open_interest_for_long: String,
    pub reserved_value_for_short: String,
    pub max_reserve_value_for_short: String,
    pub open_interest_for_short: String,
    pub max_open_interest_for_short: String,
    pub prices: Vec<String>,
    pub supply: String,
    pub market_decimals: String,
    pub min_collateral_factor_for_long: String,
    pub min_collateral_factor_for_short: String,
    pub min_collateral_value: String,
    pub long_to_short_available_liquidity: String,
    pub short_to_long_available_liquidity: String,
    pub market_price: String,
    pub long_token_amount: String,
    pub short_token_amount: String,
    pub pool_value_long: String,
    pub pool_value_short: String,
    pub long_deposit_capacity_amount: String,
    pub short_deposit_capacity_amount: String,
    pub max_long_sellable_usd: String,
    pub max_short_sellable_usd: String,
    // These Go acronym fields need explicit renames; default camelCase would mangle them.
    #[serde(rename = "viForSwaps")]
    pub vi_for_swaps: String,
    #[serde(rename = "viForPositions")]
    pub vi_for_positions: String,
    #[serde(rename = "mlForLong")]
    pub ml_for_long: String,
    #[serde(rename = "mlForShort")]
    pub ml_for_short: String,
    #[serde(rename = "oFFForPositive")]
    pub off_for_positive: String,
    #[serde(rename = "oFFForNegative")]
    pub off_for_negative: String,
    #[serde(rename = "mCMCFForLiquidation")]
    pub mcmcf_for_liquidation: String,
    pub closed: bool,
    pub tvl: String,
}

// WS topic "swapList" — Go: SwapTokenResp
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapTokenResp {
    pub token_address: String,
    pub lp_amount: String,
    pub max_price: String,
    pub min_price: String,
    pub max_unit_price24h: String,
    pub min_unit_price24h: String,
    pub percent_change24h: String,
}
