//! `CandleSource` — wait-free reader over [`CandleCache`](crate::state::CandleCache), never the network.

use std::sync::Arc;

use crate::dto::CandlesResp;
use arc_swap::ArcSwap;
use serde_json::Value;

use crate::sources::chainlink_candle::data_source_symbol;
use crate::state::{CandleCache, CandleTip};
use crate::tokens::token_by_symbol;

/// Go `maxLimit` for the candles endpoint.
const MAX_LIMIT: u32 = 1000;

/// Go rule: clamp `limit` to `maxLimit` when it is `0` or `> maxLimit`.
pub(crate) fn clamp_limit(limit: u32) -> u32 {
    if limit == 0 || limit > MAX_LIMIT {
        MAX_LIMIT
    } else {
        limit
    }
}

/// Map raw `[ts, o, h, l, c]` rows to the legacy DTO inner-array shape (ts as JSON int, OHLC as floats).
pub(crate) fn to_candle_rows(raw: &[[f64; 5]]) -> Vec<Vec<Value>> {
    raw.iter()
        .map(|row| {
            vec![
                // Go casts ts to int64; saturating cast (NaN -> 0).
                Value::from(row[0] as i64),
                Value::from(row[1]),
                Value::from(row[2]),
                Value::from(row[3]),
                Value::from(row[4]),
            ]
        })
        .collect()
}

/// Merge the live forming-candle `tip` into newest-first `rows` (replace, prepend, or ignore if stale).
pub(crate) fn merge_tip(rows: &[[f64; 5]], tip: Option<[f64; 5]>) -> Vec<[f64; 5]> {
    let Some(t) = tip else {
        return rows.to_vec();
    };
    match rows.first() {
        None => vec![t],
        Some(newest) if t[0] == newest[0] => {
            let mut out = rows.to_vec();
            out[0] = t;
            out
        }
        Some(newest) if t[0] > newest[0] => {
            let mut out = Vec::with_capacity(rows.len() + 1);
            out.push(t);
            out.extend_from_slice(rows);
            out
        }
        // tip older than the newest row -> stale, ignore.
        _ => rows.to_vec(),
    }
}

/// Resolve a caller's BASE symbol to the Chainlink QUERY symbol; unknown symbols pass through.
pub(crate) fn query_symbol_for(base_symbol: &str) -> String {
    match token_by_symbol(base_symbol) {
        Some(_) => data_source_symbol(base_symbol),
        None => base_symbol.to_string(),
    }
}

/// A wait-free reader over [`CandleCache`] plus the live [`CandleTip`] merged on read.
#[derive(Clone)]
pub struct CandleSource {
    cache: Arc<ArcSwap<CandleCache>>,
    tip: CandleTip,
}

impl CandleSource {
    pub fn new(cache: Arc<ArcSwap<CandleCache>>, tip: CandleTip) -> Self {
        Self { cache, tip }
    }

    /// Candle window for `(token_symbol, period, limit)` from the cache, with the live tip merged in.
    pub async fn candles(&self, token_symbol: &str, period: &str, limit: u32) -> CandlesResp {
        let limit = clamp_limit(limit) as usize;
        let query_symbol = query_symbol_for(token_symbol);
        let key = (query_symbol, period.to_string());

        let cache = self.cache.load();
        let base = cache.candles.get(&key);
        let tip = self.tip.lock().ok().and_then(|t| t.get(&key).copied());

        let merged = merge_tip(base.map(Vec::as_slice).unwrap_or(&[]), tip);
        let take = merged.len().min(limit);
        let rows = to_candle_rows(&merged[..take]);

        CandlesResp {
            candles: rows,
            period: period.to_string(),
            token_symbol: token_symbol.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn seeded(symbol: &str, period: &str, rows: Vec<[f64; 5]>) -> CandleSource {
        let mut candles = HashMap::new();
        candles.insert((symbol.to_string(), period.to_string()), rows);
        CandleSource::new(
            Arc::new(ArcSwap::from_pointee(CandleCache { candles })),
            crate::state::new_candle_tip(),
        )
    }

    #[test]
    fn clamp_limit_matches_go_rule() {
        assert_eq!(clamp_limit(0), 1000); // <= 0 -> max
        assert_eq!(clamp_limit(1001), 1000); // > max -> max
        assert_eq!(clamp_limit(300), 300); // in-range passthrough
        assert_eq!(clamp_limit(1000), 1000); // boundary kept
    }

    #[test]
    fn query_symbol_for_usd_based_chainlink_token_gets_usd_suffix() {
        assert_eq!(query_symbol_for("SHIB"), "SHIBUSD"); // USD-based -> suffix
        assert_eq!(query_symbol_for("USDJPY"), "USDJPY"); // FX pair -> unchanged
        assert_eq!(query_symbol_for("NOTATOKEN"), "NOTATOKEN"); // unknown -> verbatim
    }

    #[test]
    fn query_symbol_for_usdc_keeps_the_usd_prefix_symbol() {
        assert_eq!(query_symbol_for("USDC"), "USDC");
    }

    /// ts shaped to a JSON int and OHLC to floats, serving the cache with BASE-symbol resolution and limit honored.
    #[tokio::test]
    async fn candles_reads_seeded_cache_shaped_and_echoes_metadata() {
        let rows = vec![
            [1_748_736_000.0, 150.25, 151.80, 149.50, 151.20],
            [1_748_735_700.0, 149.00, 150.50, 148.80, 150.25],
        ];
        let src = seeded("SHIBUSD", "1h", rows); // SHIB is USD-based -> key ("SHIBUSD","1h").

        let resp = src.candles("SHIB", "1h", 1).await;
        assert_eq!(resp.period, "1h");
        assert_eq!(resp.token_symbol, "SHIB"); // echoes the BASE symbol
        assert_eq!(resp.candles.len(), 1); // limit honored
        let ts = &resp.candles[0][0];
        assert!(ts.is_i64() && !ts.is_f64());
        assert_eq!(ts.as_i64(), Some(1_748_736_000));
        assert!(resp.candles[0][1].is_f64());
        assert_eq!(resp.candles[0][1].as_f64(), Some(150.25));
    }

    #[tokio::test]
    async fn candles_reads_extra_usdc_history_from_the_shared_memory_window() {
        let src = seeded(
            "USDC",
            "1h",
            vec![[1_748_736_000.0, 1.0, 1.01, 0.99, 1.001]],
        );

        let resp = src.candles("USDC", "1h", 24).await;

        assert_eq!(resp.token_symbol, "USDC");
        assert_eq!(resp.candles.len(), 1);
        assert_eq!(resp.candles[0][4].as_f64(), Some(1.001));
    }

    #[tokio::test]
    async fn runtime_disabled_rebuilt_memory_does_not_expose_usdc_to_ws_reader() {
        let src = seeded(
            "SOLUSD",
            "1h",
            vec![[1_748_736_000.0, 100.0, 101.0, 99.0, 100.5]],
        );

        let resp = src.candles("USDC", "1h", 24).await;

        assert!(resp.candles.is_empty());
    }

    #[test]
    fn merge_tip_replaces_prepends_or_ignores() {
        let rows = [[200.0, 1.0, 2.0, 0.5, 1.5], [100.0, 0.8, 1.2, 0.7, 1.0]];
        // same bucket ts -> replace newest.
        let same = merge_tip(&rows, Some([200.0, 1.0, 3.0, 0.5, 2.9]));
        assert_eq!(same.len(), 2);
        assert_eq!(same[0], [200.0, 1.0, 3.0, 0.5, 2.9]);
        // newer bucket -> prepend.
        let newer = merge_tip(&rows, Some([300.0, 2.9, 3.1, 2.8, 3.0]));
        assert_eq!(newer.len(), 3);
        assert_eq!(newer[0][0], 300.0);
        assert_eq!(newer[1][0], 200.0);
        // stale (older than newest) -> ignored.
        let stale = merge_tip(&rows, Some([150.0, 1.0, 1.0, 1.0, 1.0]));
        assert_eq!(stale, rows.to_vec());
        // empty base -> just the tip; None tip -> unchanged.
        assert_eq!(merge_tip(&[], Some([10.0, 1.0, 1.0, 1.0, 1.0])).len(), 1);
        assert_eq!(merge_tip(&rows, None), rows.to_vec());
    }

    /// The live tip surfaces through `candles()` as the newest row (WS push path).
    #[tokio::test]
    async fn candles_merges_live_tip() {
        let cache_rows = vec![[1_748_736_000.0, 150.25, 151.80, 149.50, 151.20]];
        let candles = {
            let mut m = HashMap::new();
            m.insert(("SHIBUSD".to_string(), "1h".to_string()), cache_rows);
            m
        };
        let tip = crate::state::new_candle_tip();
        // same bucket ts as the cached newest row -> the tip's live close wins.
        tip.lock().unwrap().insert(
            ("SHIBUSD".to_string(), "1h".to_string()),
            [1_748_736_000.0, 150.25, 152.40, 149.50, 152.10],
        );
        let src = CandleSource::new(
            Arc::new(ArcSwap::from_pointee(CandleCache { candles })),
            tip,
        );

        let resp = src.candles("SHIB", "1h", 1).await;
        assert_eq!(resp.candles.len(), 1);
        assert_eq!(resp.candles[0][4].as_f64(), Some(152.10)); // live close
        assert_eq!(resp.candles[0][2].as_f64(), Some(152.40)); // live high
    }
}
