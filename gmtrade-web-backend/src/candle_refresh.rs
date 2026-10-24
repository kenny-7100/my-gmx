//! Low-frequency ticker pulling 24 1h candles per symbol into [`CandleData`] for the 24h fields.

use std::collections::HashMap;

use serde_json::Value;

use crate::aggregate::index_info::percent_change_24h;
use crate::aggregate::swap::Candle24h;
use crate::state::{AppState, CandleData};
use crate::tokens::{get_unit, token_by_index_token, USD_DECIMALS};

use crate::metrics;

/// 1h period string passed to the candle source (Go cache key `...:1h`).
const PERIOD_1H: &str = "1h";
/// Newest N 1h candles to request (Go `ZRevRange(..., 0, 23)` -> 24 rows).
const CANDLE_LIMIT: u32 = 24;

/// The compute-relevant summary of one symbol's 24h candle window.
#[derive(Debug, Clone, PartialEq)]
pub struct Symbol24h {
    pub count: usize,
    pub newest_close: f64,
    pub oldest_close: f64,
    pub max_high: f64,
    pub min_low: f64,
}

/// Summarize a symbol's candle rows (each `[ts, open, high, low, close]`). `None` on no rows or missing OHLC. PURE.
pub fn compute_symbol_24h(rows: &[Vec<Value>]) -> Option<Symbol24h> {
    if rows.is_empty() {
        return None;
    }
    // Row layout: [ts, open, high(2), low(3), close(4)].
    let f = |row: &Vec<Value>, i: usize| -> Option<f64> { row.get(i).and_then(Value::as_f64) };

    let mut max_high = f64::NEG_INFINITY;
    let mut min_low = f64::INFINITY;
    for row in rows {
        let high = f(row, 2)?;
        let low = f(row, 3)?;
        if high > max_high {
            max_high = high;
        }
        if low < min_low {
            min_low = low;
        }
    }
    let newest_close = f(&rows[0], 4)?;
    let oldest_close = f(&rows[rows.len() - 1], 4)?;

    Some(Symbol24h {
        count: rows.len(),
        newest_close,
        oldest_close,
        max_high,
        min_low,
    })
}

/// Scale a raw candle price to a unit-price integer string via `raw * 10^USD_DECIMALS / 10^decimals`, truncated.
pub fn scale_unit_price_f64(raw_price: f64, decimals: i8) -> String {
    if !raw_price.is_finite() || raw_price <= 0.0 {
        return "0".to_string();
    }
    let usd_unit = get_unit(USD_DECIMALS) as f64;
    let token_unit = get_unit(decimals.max(0) as u32) as f64;
    if token_unit == 0.0 {
        return "0".to_string();
    }
    // Go: bf.Mul(usdUnit); bf.Quo(tokenUnit); bf.Int(bi) (truncate toward zero).
    let scaled = raw_price * usd_unit / token_unit;
    if !scaled.is_finite() || scaled < 0.0 {
        return "0".to_string();
    }
    format!("{}", scaled.trunc() as u128)
}

/// Normalize a token symbol for fetching candles: drop the leading "W" for the wrapped set, else keep the part before the first ".".
pub fn normalize_symbol_for_candles(sym: &str) -> String {
    match sym {
        "WSOL" | "WETH" | "WBTC" | "WPUMP" | "WGMX" => sym[1..].to_string(),
        _ => match sym.split_once('.') {
            Some((head, _)) => head.to_string(),
            None => sym.to_string(),
        },
    }
}

/// One swap token's candle-fetch plan: the `fetch_symbol` (Go-normalized) to fetch under, plus the token's `decimals`.
#[derive(Debug, Clone, PartialEq)]
pub struct SwapCandlePlan {
    /// Go-normalized symbol to FETCH candles under (e.g. WSOL -> "SOL").
    pub fetch_symbol: String,
    /// Token decimals for unit-price scaling.
    pub decimals: i8,
}

/// Discovered symbols needed for a candle tick: the index-token side and the swap side (keyed by RAW `symbol`).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct WantedSymbols {
    /// Raw `index_token_address -> symbol` driving [`CandleData::percent_change_24h`].
    pub index: HashMap<String, String>,
    /// `raw_symbol -> SwapCandlePlan` for the swap side (drives [`CandleData::swap_24h`]).
    pub swap: HashMap<String, SwapCandlePlan>,
}

/// All distinct candle symbols to fetch this tick (dedup across index + swap; swap fetches the normalized `fetch_symbol`).
pub fn distinct_symbols(wanted: &WantedSymbols) -> Vec<String> {
    let mut set: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    for sym in wanted.index.values() {
        set.insert(sym.clone());
    }
    for plan in wanted.swap.values() {
        set.insert(plan.fetch_symbol.clone());
    }
    set.into_iter().collect()
}

/// Resolve symbols to fetch from the current [`Snapshot`] via [`token_by_index_token`] (unknown addresses skipped).
pub fn wanted_from_snapshot(snapshot: &crate::state::Snapshot) -> WantedSymbols {
    let mut wanted = WantedSymbols::default();
    for info in snapshot.index_infos.iter() {
        if let Some(row) = token_by_index_token(&info.index_token) {
            wanted
                .index
                .insert(info.index_token.clone(), row.symbol.to_string());
        }
    }
    for swap in snapshot.swap_list.iter() {
        if let Some(row) = token_by_index_token(&swap.token_address) {
            // Key by raw symbol but fetch under the normalized symbol (WSOL -> SOL).
            wanted.swap.insert(
                row.symbol.to_string(),
                SwapCandlePlan {
                    fetch_symbol: normalize_symbol_for_candles(row.symbol),
                    decimals: row.decimals,
                },
            );
        }
    }
    wanted
}

/// Pure map-builder: produce [`CandleData`] from wanted symbols + a per-symbol candle cache. NO network.
pub fn build_candle_data(
    wanted: &WantedSymbols,
    symbol_candles: &HashMap<String, Vec<Vec<Value>>>,
) -> CandleData {
    let mut percent = HashMap::new();
    for (index_token, symbol) in &wanted.index {
        let Some(rows) = symbol_candles.get(symbol) else {
            continue;
        };
        let Some(s) = compute_symbol_24h(rows) else {
            continue;
        };
        // Index path requires EXACTLY 24 candles (Go `if len != 24 { continue }`).
        if s.count != CANDLE_LIMIT as usize {
            continue;
        }
        percent.insert(
            index_token.clone(),
            percent_change_24h(s.oldest_close, s.newest_close),
        );
    }

    let mut swap = HashMap::new();
    for (raw_symbol, plan) in &wanted.swap {
        let Some(rows) = symbol_candles.get(&plan.fetch_symbol) else {
            continue;
        };
        let Some(s) = compute_symbol_24h(rows) else {
            continue;
        };
        swap.insert(
            raw_symbol.clone(),
            Candle24h {
                max_unit_price_24h: scale_unit_price_f64(s.max_high, plan.decimals),
                min_unit_price_24h: scale_unit_price_f64(s.min_low, plan.decimals),
                percent_change_24h: percent_change_24h(s.oldest_close, s.newest_close),
            },
        );
    }

    CandleData {
        percent_change_24h: percent,
        swap_24h: swap,
    }
}

/// Run one candle-refresh tick: discover symbols, fetch each DISTINCT 24x1h window ONCE, build+store the [`CandleData`]. Never errors.
pub async fn candle_tick_once(state: &AppState) {
    let refresh = metrics::RefreshGuard::start(metrics::Worker::CandleRefresh);
    let snapshot = state.snapshot();
    let wanted = wanted_from_snapshot(&snapshot);

    let mut symbol_candles: HashMap<String, Vec<Vec<Value>>> = HashMap::new();
    for symbol in distinct_symbols(&wanted) {
        // Redis-first (same path as the HTTP candle endpoint) for the full accumulated history.
        let rows =
            crate::http::candles::read_candle_rows(state, &symbol, PERIOD_1H, CANDLE_LIMIT).await;
        symbol_candles.insert(symbol, rows);
    }

    let data = build_candle_data(&wanted, &symbol_candles);

    tracing::debug!(
        wanted_index = wanted.index.len(),
        percent_entries = data.percent_change_24h.len(),
        swap_entries = data.swap_24h.len(),
        "candle refresh tick"
    );

    state.candle_data.store(std::sync::Arc::new(data));
    refresh.finish(metrics::RefreshResult::Completed);
}

/// The candle-refresh loop ticking every `config.candle_refresh_secs` seconds forever.
pub async fn run_candle_refresh(state: AppState) {
    let mut interval = crate::ticker::interval(state.config.candle_refresh_secs);
    tracing::info!(
        candle_refresh_secs = state.config.candle_refresh_secs,
        "candle refresh loop started"
    );
    loop {
        interval.tick().await;
        candle_tick_once(&state).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SOL_INDEX: &str = "So1Zu7vPQQxrguzUehKAyVLpjcc769zxgBuDAsxTUMH";
    const BTC_INDEX: &str = "BtcTQYRj7HRRk7MwnWiTFj8rWqN2ALt2QYig4cSWqTbv";

    /// A candle row `[ts, open, high, low, close]`.
    fn row(ts: i64, open: f64, high: f64, low: f64, close: f64) -> Vec<Value> {
        vec![
            Value::from(ts),
            Value::from(open),
            Value::from(high),
            Value::from(low),
            Value::from(close),
        ]
    }

    /// `n` rows newest-first with `newest_close`/`oldest_close` at the ends and `max_high`/`min_low` on one row.
    fn series(
        n: usize,
        newest_close: f64,
        oldest_close: f64,
        max_high: f64,
        min_low: f64,
    ) -> Vec<Vec<Value>> {
        let mut rows = Vec::new();
        for i in 0..n {
            let close = if i == 0 {
                newest_close
            } else if i == n - 1 {
                oldest_close
            } else {
                100.0
            };
            // Put the extreme high/low on the first row.
            let (high, low) = if i == 0 {
                (max_high, min_low)
            } else {
                (close, close)
            };
            rows.push(row(
                1_700_000_000 - i as i64 * 3600,
                close,
                high,
                low,
                close,
            ));
        }
        rows
    }

    #[test]
    fn compute_symbol_24h_extracts_closes_high_low_and_count() {
        // 3 rows: newest close 110, oldest 100; max high 130, min low 90.
        let rows = series(3, 110.0, 100.0, 130.0, 90.0);
        let s = compute_symbol_24h(&rows).unwrap();
        assert_eq!(s.count, 3);
        assert_eq!(s.newest_close, 110.0);
        assert_eq!(s.oldest_close, 100.0);
        assert_eq!(s.max_high, 130.0);
        assert_eq!(s.min_low, 90.0);
    }

    #[test]
    fn scale_unit_price_f64_hand_computed_decimals_9() {
        // SOL decimals 9, USD_DECIMALS 20: raw 150.0 -> 1.5e13.
        assert_eq!(scale_unit_price_f64(150.0, 9), "15000000000000");
        assert_eq!(scale_unit_price_f64(1.0, 9), "100000000000");
    }

    fn swap_plan(fetch_symbol: &str, decimals: i8) -> SwapCandlePlan {
        SwapCandlePlan {
            fetch_symbol: fetch_symbol.to_string(),
            decimals,
        }
    }

    fn wanted_sol_btc_swap_sol() -> WantedSymbols {
        let mut wanted = WantedSymbols::default();
        wanted
            .index
            .insert(SOL_INDEX.to_string(), "SOL".to_string());
        wanted
            .index
            .insert(BTC_INDEX.to_string(), "BTC".to_string());
        // Swap side: SOL (decimals 9) normalizes to itself, fetching under "SOL".
        wanted.swap.insert("SOL".to_string(), swap_plan("SOL", 9));
        wanted
    }

    #[test]
    fn normalize_symbol_for_candles_strips_exact_wrapped_set_else_verbatim() {
        // Exactly the Go set: WSOL/WETH/WBTC/WPUMP/WGMX drop the leading "W".
        assert_eq!(normalize_symbol_for_candles("WSOL"), "SOL");
        assert_eq!(normalize_symbol_for_candles("WGMX"), "GMX");
        // "W" tokens NOT in the Go set must NOT be stripped.
        assert_eq!(normalize_symbol_for_candles("WIF"), "WIF");
        assert_eq!(normalize_symbol_for_candles("SOL"), "SOL");
        // Only the part before the FIRST "." is kept (Go Split[0]).
        assert_eq!(normalize_symbol_for_candles("A.B.C"), "A");
    }

    #[test]
    fn build_candle_data_24_candle_index_present_non24_absent() {
        let wanted = wanted_sol_btc_swap_sol();
        let mut symbol_candles = HashMap::new();
        // SOL: exactly 24 rows, newest close 110, oldest 100 -> +10% -> "1000".
        symbol_candles.insert("SOL".to_string(), series(24, 110.0, 100.0, 130.0, 90.0));
        // BTC: only 10 rows -> NOT exactly 24 -> absent.
        symbol_candles.insert("BTC".to_string(), series(10, 200.0, 100.0, 250.0, 90.0));

        let cd = build_candle_data(&wanted, &symbol_candles);

        // SOL index token present with the hand-computed +10% = 1000 bps.
        assert_eq!(
            cd.percent_change_24h.get(SOL_INDEX).map(String::as_str),
            Some("1000")
        );
        // BTC (10 rows) absent from percent map.
        assert!(!cd.percent_change_24h.contains_key(BTC_INDEX));
    }

    #[test]
    fn build_candle_data_swap_wsol_fetches_under_sol_keys_under_wsol() {
        // A WSOL-collateral swap row uses SOL's candles but is keyed by raw "WSOL".
        let mut wanted = WantedSymbols::default();
        // WSOL swap token: raw key "WSOL", fetch under normalized "SOL", decimals 9.
        wanted.swap.insert("WSOL".to_string(), swap_plan("SOL", 9));

        let mut symbol_candles = HashMap::new();
        // Candle data is provided ONLY under "SOL".
        symbol_candles.insert("SOL".to_string(), series(24, 110.0, 100.0, 130.0, 90.0));

        let cd = build_candle_data(&wanted, &symbol_candles);

        // Entry is keyed by the RAW "WSOL", populated from the SOL series.
        assert!(!cd.swap_24h.contains_key("SOL"));
        let wsol = cd
            .swap_24h
            .get("WSOL")
            .expect("WSOL swap candle present from SOL series");
        // max high 130, decimals 9 -> 130 * 10^20 / 10^9 = 1.3e13.
        assert_eq!(wsol.max_unit_price_24h, "13000000000000");
        assert_eq!(wsol.min_unit_price_24h, "9000000000000");
        assert_eq!(wsol.percent_change_24h, "1000");
    }

    #[test]
    fn build_candle_data_uses_usdc_history_for_swap_24h() {
        let mut wanted = WantedSymbols::default();
        wanted.swap.insert("USDC".to_string(), swap_plan("USDC", 6));
        let stablecoin_rows = (0..24)
            .map(|i| {
                row(
                    1_700_000_000 - i * 3600,
                    1.0,
                    if i == 0 { 1.01 } else { 1.0 },
                    if i == 0 { 0.99 } else { 1.0 },
                    1.0,
                )
            })
            .collect();
        let symbol_candles = HashMap::from([("USDC".to_string(), stablecoin_rows)]);

        let data = build_candle_data(&wanted, &symbol_candles);

        let usdc = data.swap_24h.get("USDC").expect("USDC swap 24h data");
        assert_eq!(usdc.max_unit_price_24h, "101000000000000");
        assert_eq!(usdc.min_unit_price_24h, "99000000000000");
        assert_eq!(usdc.percent_change_24h, "0");
        assert!(data.percent_change_24h.is_empty());
    }

    #[test]
    fn runtime_disabled_without_restored_usdc_history_omits_swap_24h() {
        let mut wanted = WantedSymbols::default();
        wanted.swap.insert("USDC".to_string(), swap_plan("USDC", 6));

        let data = build_candle_data(&wanted, &HashMap::new());

        assert!(!data.swap_24h.contains_key("USDC"));
    }

    #[test]
    fn distinct_symbols_swap_uses_normalized_fetch_symbol() {
        // A WSOL swap token (normalizes to SOL) plus an index SOL: fetched ONCE.
        let mut wanted = WantedSymbols::default();
        wanted
            .index
            .insert(SOL_INDEX.to_string(), "SOL".to_string());
        wanted.swap.insert("WSOL".to_string(), swap_plan("SOL", 9));
        let syms = distinct_symbols(&wanted);
        // "WSOL" is NOT fetched; its normalized "SOL" dedupes with the index SOL.
        assert_eq!(syms, vec!["SOL".to_string()]);
    }
}
