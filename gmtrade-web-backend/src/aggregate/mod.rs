//! Aggregation layer turning raw keeper market and price data into computed valuations via `gmsol-sdk`.

pub mod index_info;
pub mod market;
pub mod market_info;
pub mod price_source;
pub mod raw_market;
pub mod scale;
pub mod swap;
pub mod tickers;
