//! Aggregate the price `tickers` contract (HTTP `TickersRes` v1/v2 and WS `SolTickersRes`).

use crate::dto::{SolTicker, Ticker};
use gmsol_keeper_client::FetchedPrice;

use crate::aggregate::market::parse_raw_price;
use crate::aggregate::scale::{u_to_ticker, u_to_unit_price};
use crate::tokens::{get_one_token_price, token_by_mint};

/// Build the HTTP v1 `TickersRes` list: one [`Ticker`] per priced mint. PURE.
pub fn build_tickers(prices: &[FetchedPrice]) -> Vec<Ticker> {
    prices.iter().filter_map(ticker_from_price).collect()
}

/// Build the HTTP v2 `TickersRes` list from the keeper feed, merging `chainlink_source` when present.
pub fn build_tickers_v2(
    prices: &[FetchedPrice],
    chainlink_source: Option<&[Ticker]>,
) -> Vec<Ticker> {
    let mut out: Vec<Ticker> = build_tickers(prices);
    if let Some(src) = chainlink_source {
        out.extend(src.iter().cloned());
    }
    out
}

/// Build the WS `SolTickersRes` list, computing per-mint unit prices and skipping bad / `max < min` rows.
///
/// De-duplicates by `symbol`, keeping the first row: the token overlay can map
/// several mints to one symbol (PUMP's two mints, WSOL via alias), which would
/// otherwise emit redundant identical rows. The frontend keys tickers by symbol,
/// so one row per symbol is the contract.
pub fn build_sol_tickers(prices: &[FetchedPrice]) -> Vec<SolTicker> {
    let mut seen = std::collections::HashSet::new();
    prices
        .iter()
        .filter_map(sol_ticker_from_price)
        .filter(|t| seen.insert(t.symbol.clone()))
        .collect()
}

fn ticker_from_price(p: &FetchedPrice) -> Option<Ticker> {
    let row = token_by_mint(&p.pubkey)?;
    let min_u = parse_raw_price(p.min_raw.as_deref()?)?;
    let max_u = parse_raw_price(p.max_raw.as_deref()?)?;
    let ts = p.ts?;

    // U -> legacy ticker format B = `P*10^(30-gmx)` (the frontend `adjustPrice` representation).
    let gmx = row.decimals_gmx as i32;
    let min_price = u_to_ticker(min_u, gmx);
    let max_price = u_to_ticker(max_u, gmx);

    Some(Ticker {
        token_address: p.pubkey.clone(),
        token_symbol: row.symbol.to_string(),
        min_price: min_price.to_string(),
        max_price: max_price.to_string(),
        updated_at: ts.saturating_mul(1000),
        timestamp: ts,
    })
}

fn sol_ticker_from_price(p: &FetchedPrice) -> Option<SolTicker> {
    let row = token_by_mint(&p.pubkey)?;
    let min_u = parse_raw_price(p.min_raw.as_deref()?)?;
    let max_u = parse_raw_price(p.max_raw.as_deref()?)?;
    let ts = p.ts?;

    let dec = row.decimals.max(0) as u32;

    // U -> unit price A = `P*10^(20-dec)` (USD per smallest token unit).
    let min_unit = u_to_unit_price(min_u, dec);
    let max_unit = u_to_unit_price(max_u, dec);
    // CalculateLatestPrice: errors (and the Go skips) when max < min.
    if max_unit < min_unit {
        return None;
    }
    let unit_price = (min_unit.saturating_add(max_unit)) / 2;

    Some(SolTicker {
        symbol: row.symbol.to_string(),
        min_unit_price: min_unit.to_string(),
        max_unit_price: max_unit.to_string(),
        // price = unitPrice * 10^decimals (back to whole-token U scale) as a plain integer string.
        price: get_one_token_price(unit_price, dec).to_string(),
        unit_price: unit_price.to_string(),
        timestamp: ts,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // wrapped-SOL mint resolves to the Gmx "SOL" row (decimals 9, gmx 9).
    const SOL_MINT: &str = "So11111111111111111111111111111111111111112";

    fn price(mint: &str, min_raw: &str, max_raw: &str, ts: i64) -> FetchedPrice {
        FetchedPrice {
            pubkey: mint.to_string(),
            min: 0.0,
            max: 0.0,
            mid: 0.0,
            min_raw: Some(min_raw.to_string()),
            max_raw: Some(max_raw.to_string()),
            ts: Some(ts),
        }
    }

    #[test]
    fn build_tickers_skips_unknown_mint_and_partial_prices() {
        let mut no_symbol = price("not-a-mint", "1", "2", 1);
        no_symbol.pubkey = "totally-unknown".to_string();
        let mut no_min = price(SOL_MINT, "1", "2", 1);
        no_min.min_raw = None;
        let mut no_ts = price(SOL_MINT, "1", "2", 1);
        no_ts.ts = None;
        let out = build_tickers(&[no_symbol, no_min, no_ts]);
        assert!(out.is_empty(), "all three must be skipped");
    }

    #[test]
    fn build_sol_tickers_unit_mid_and_price() {
        // SOL dec=9: U -> A divides by 10^9. U min=1.5e12 -> A=1500, max=1.51e12 -> A=1510.
        let out = build_sol_tickers(&[price(SOL_MINT, "1500000000000", "1510000000000", 1_700)]);
        assert_eq!(out.len(), 1);
        let s = &out[0];
        assert_eq!(s.symbol, "SOL");
        assert_eq!(s.min_unit_price, "1500");
        assert_eq!(s.max_unit_price, "1510");
        // mid = (1500 + 1510)/2 = 1505.
        assert_eq!(s.unit_price, "1505");
        assert_eq!(s.timestamp, 1_700);
        // price = GetOneTokenPrice(unitPrice, 9) = 1505 * 1e9 (back to whole-token U scale).
        assert_eq!(s.price, "1505000000000");
    }

    #[test]
    fn build_sol_tickers_dedups_repeated_symbol() {
        // Three priced rows that all resolve to the SOL symbol (the overlay maps
        // several mints/aliases to one symbol) -> exactly one ticker, first kept.
        let out = build_sol_tickers(&[
            price(SOL_MINT, "1500000000000", "1510000000000", 1_700),
            price(SOL_MINT, "1500000000000", "1510000000000", 1_700),
            price(SOL_MINT, "1500000000000", "1510000000000", 1_700),
        ]);
        assert_eq!(out.len(), 1, "repeated symbol collapses to one row");
        assert_eq!(out[0].symbol, "SOL");
    }

    #[test]
    fn build_tickers_v2_partitions_by_datasource() {
        // Gmx tokens from the keeper feed, Chainlink from the injected source.
        let prices = [price(SOL_MINT, "1000000000000", "1000500000000", 1)];
        let chainlink = vec![Ticker {
            token_address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263".to_string(),
            token_symbol: "BONK".to_string(),
            min_price: "1".to_string(),
            max_price: "2".to_string(),
            updated_at: 1000,
            timestamp: 1,
        }];
        let v2 = build_tickers_v2(&prices, Some(&chainlink));
        let syms: Vec<&str> = v2.iter().map(|t| t.token_symbol.as_str()).collect();
        assert!(syms.contains(&"SOL"), "Gmx SOL kept from keeper feed");
        assert!(
            syms.contains(&"BONK"),
            "Chainlink BONK kept from chainlink source"
        );
        assert_eq!(v2.len(), 2);
    }
}
