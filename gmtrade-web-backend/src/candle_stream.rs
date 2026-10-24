//! Chainlink Data Engine SSE price stream folding live ticks into the in-memory [`CandleTip`](crate::state::CandleTip) for direct periods.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;

use crate::candle_source_refresh::{chainlink_prefetch_plans, PrefetchPlan};
use crate::sources::chainlink_candle::{
    parse_stream_tick, resolution_seconds, stream_price_to_f64, StreamTick,
};
use crate::state::AppState;
/// Delay before reconnecting a dropped/failed stream.
const RECONNECT_DELAY: Duration = Duration::from_secs(2);
/// Force a reconnect if no bytes arrive within this window (heartbeat silence means a dead connection).
const STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(60);
/// Hard cap on the un-terminated line buffer, guarding against a newline-less blob growing it unbounded.
const MAX_SSE_LINE_BYTES: usize = 1 << 20;

/// Align `ts` down to the start of its `period` bucket. PURE.
pub fn align_ts(ts: i64, period: &str) -> Option<i64> {
    let secs = resolution_seconds(period)?;
    Some(ts - ts.rem_euclid(secs))
}

/// Fold a price tick into the forming candle for one bucket, baselining on the tip, then cache, then a fresh open. PURE.
pub fn fold_tick(
    prev_tip: Option<[f64; 5]>,
    cache_row: Option<[f64; 5]>,
    aligned_ts: i64,
    price: f64,
) -> [f64; 5] {
    let ats = aligned_ts as f64;
    let base = match prev_tip {
        Some(t) if t[0] == ats => Some(t),
        _ => match cache_row {
            Some(c) if c[0] == ats => Some(c),
            _ => None,
        },
    };
    match base {
        // [ts, open(kept), high, low, close]
        Some(b) => [ats, b[1], b[2].max(price), b[3].min(price), price],
        None => [ats, price, price, price, price],
    }
}

/// Return the prior tip when a tick's `aligned_ts` is strictly newer, marking that bucket as just closed for Redis persistence. PURE.
pub fn closed_candle_on_roll(prev_tip: Option<[f64; 5]>, aligned_ts: i64) -> Option<[f64; 5]> {
    prev_tip.filter(|p| (p[0] as i64) < aligned_ts)
}

/// Dedup the plans into stream symbol groups plus per-query-symbol precision digits. PURE.
pub fn stream_groups_and_digits(
    plans: &[PrefetchPlan],
) -> (Vec<Vec<String>>, HashMap<String, i32>) {
    let mut digits = HashMap::new();
    let mut symbols = Vec::new();
    for p in plans {
        if digits.insert(p.query_symbol.clone(), p.digits).is_none() {
            symbols.push(p.query_symbol.clone());
        }
    }
    let groups = symbols
        .chunks(crate::runtime::params().stream_group_size)
        .map(<[String]>::to_vec)
        .collect();
    (groups, digits)
}

/// Fold one live price into every direct-period tip, then persist any candle closed by the tick.
/// Shared by the Data Engine SSE and, under `price_candle_first`, the keeper subscription.
pub(crate) async fn apply_live_candle_price(state: &AppState, symbol: &str, ts: i64, price: f64) {
    // Fold the tick into the tip for every direct period, collecting any rolled-over bucket to flush, no `.await` inside the lock.
    let mut closed: Vec<(&'static str, [f64; 5])> = Vec::new();
    {
        let cache = state.candle_cache.load();
        let Ok(mut tip) = state.candle_tip.lock() else {
            return;
        };
        for period in &crate::runtime::params().direct_periods {
            let Some(aligned) = align_ts(ts, period) else {
                continue;
            };
            let key = (symbol.to_string(), period.to_string());
            let prev = tip.get(&key).copied();
            if let Some(row) = closed_candle_on_roll(prev, aligned) {
                closed.push((period, row));
            }
            let cache_row = cache.candles.get(&key).and_then(|r| r.first().copied());
            let folded = fold_tick(prev, cache_row, aligned, price);
            tip.insert(key, folded);
        }
    }

    // Persist the just-closed candle(s) into Redis at bucket boundaries, in the same format as the prefetch write.
    if let Some(redis) = &state.redis {
        let rows: Vec<_> = closed
            .into_iter()
            .map(|(period, row)| {
                let suffix = format!("v2:candlestick:{symbol}:{period}");
                let ts = row[0] as i64;
                let member = crate::candle_source_refresh::candle_member_json(ts, &row);
                (suffix, ts as f64, member)
            })
            .collect();
        if let Err(e) = redis.zadd_upsert_many(&rows).await {
            tracing::warn!(error = %e, symbol, "redis live candle write failed");
        }
    }
}

/// Apply one Data Engine tick to both the live spot-price map and the forming candle tips.
async fn apply_tick(state: &AppState, tick: &StreamTick, digits: &HashMap<String, i32>) {
    let token_digits = digits.get(&tick.symbol).copied().unwrap_or(0);
    let price = stream_price_to_f64(tick.price_raw, token_digits);

    // PRIMARY lastprice for the data_source=Chainlink leg: record the live spot price keyed by query symbol
    // (single price, stream tick `ts`), mirroring the old Go backend's stream_processor.
    if tick.price_raw >= 0 {
        if let Ok(mut p) = state.cl_prices.lock() {
            p.insert(tick.symbol.clone(), (tick.price_raw as u128, tick.ts));
        }
    }

    apply_live_candle_price(state, &tick.symbol, tick.ts, price).await;
}

/// One stream connection lifetime for `csv` symbols, applying newline-delimited JSON ticks until it ends, errors, or goes idle.
async fn stream_group_once(
    state: &AppState,
    csv: &str,
    token: &str,
    digits: &HashMap<String, i32>,
) -> eyre::Result<()> {
    let resp = state.chainlink_candle.open_stream(csv, token).await?;
    let mut stream = resp.bytes_stream();
    let mut buf: Vec<u8> = Vec::new();
    loop {
        let chunk = match tokio::time::timeout(STREAM_IDLE_TIMEOUT, stream.next()).await {
            Err(_) => eyre::bail!("stream idle timeout"),
            Ok(None) => return Ok(()), // stream ended cleanly
            Ok(Some(item)) => item?,
        };
        buf.extend_from_slice(&chunk);
        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buf.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&line);
            if let Some(tick) = parse_stream_tick(&line) {
                apply_tick(state, &tick, digits).await;
            }
        }
        // No newline within the cap => malformed/hostile stream; reconnect.
        if buf.len() > MAX_SSE_LINE_BYTES {
            eyre::bail!("stream line exceeded {MAX_SSE_LINE_BYTES} bytes without a newline");
        }
    }
}

/// Reconnect loop for one symbol group, reloading the auth token and streaming until it drops, forever.
async fn run_stream_group(
    state: AppState,
    symbols: Vec<String>,
    digits: Arc<HashMap<String, i32>>,
) {
    let csv = symbols.join(",");
    loop {
        // Clone the token to an owned String and drop the ArcSwap guard before the long-lived stream await.
        let token = match state.cl_auth_token.load().as_ref() {
            Some(t) => t.clone(),
            None => {
                // Auth not warmed yet — wait for the auth refresher's first tick.
                tokio::time::sleep(RECONNECT_DELAY).await;
                continue;
            }
        };
        if let Err(err) = stream_group_once(&state, &csv, &token, &digits).await {
            // `?err` (Debug) prints the full eyre source chain so a recurring stream failure is diagnosable from logs.
            tracing::warn!(symbols = %csv, error = ?err, "candle stream disconnected; reconnecting");
        }
        tokio::time::sleep(RECONNECT_DELAY).await;
    }
}

/// Spawn one reconnecting stream task per symbol group, idle when the token table yields no Chainlink symbols.
pub async fn run_candle_stream(state: AppState) {
    let plans = chainlink_prefetch_plans();
    let (groups, digits) = stream_groups_and_digits(&plans);
    if groups.is_empty() {
        tracing::info!("candle stream: no chainlink symbols; stream task idle");
        return;
    }
    let digits = Arc::new(digits);
    tracing::info!(
        groups = groups.len(),
        "starting chainlink candle stream tasks"
    );
    let mut handles = Vec::new();
    for group in groups {
        handles.push(tokio::spawn(run_stream_group(
            state.clone(),
            group,
            digits.clone(),
        )));
    }
    for h in handles {
        let _ = h.await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn align_ts_floors_to_bucket() {
        assert_eq!(align_ts(1_780_660_859, "1m"), Some(1_780_660_800)); // 59s floors to :00
        assert_eq!(align_ts(1_780_660_859, "1h"), Some(1_780_660_800));
        assert_eq!(align_ts(1_780_662_000, "1h"), Some(1_780_660_800)); // mid-hour floors to the boundary
        assert_eq!(
            align_ts(1_780_660_859, "1d"),
            Some(1_780_660_859 - 1_780_660_859 % 86_400)
        );
        assert_eq!(align_ts(123, "nope"), None);
    }

    #[test]
    fn fold_tick_new_bucket_opens_at_price() {
        // No prior tip, no matching cache row -> fresh candle [ts,p,p,p,p].
        assert_eq!(
            fold_tick(None, None, 1000, 65.0),
            [1000.0, 65.0, 65.0, 65.0, 65.0]
        );
    }

    #[test]
    fn fold_tick_updates_high_low_close_on_same_bucket() {
        let prev = [1000.0, 60.0, 66.0, 59.0, 64.0];
        // higher price -> new high, close updates, open/low kept.
        assert_eq!(
            fold_tick(Some(prev), None, 1000, 70.0),
            [1000.0, 60.0, 70.0, 59.0, 70.0]
        );
        // lower price -> new low.
        assert_eq!(
            fold_tick(Some(prev), None, 1000, 55.0),
            [1000.0, 60.0, 66.0, 55.0, 55.0]
        );
    }

    #[test]
    fn fold_tick_seeds_open_from_cached_history_candle() {
        // No tip yet but a cached candle exists for this bucket -> keep its open, update close.
        let cached = [1000.0, 61.0, 67.0, 58.0, 63.0];
        assert_eq!(
            fold_tick(None, Some(cached), 1000, 64.0),
            [1000.0, 61.0, 67.0, 58.0, 64.0]
        );
        // Cache row for a DIFFERENT bucket is ignored -> fresh candle.
        assert_eq!(
            fold_tick(None, Some(cached), 2000, 64.0),
            [2000.0, 64.0, 64.0, 64.0, 64.0]
        );
    }

    #[test]
    fn closed_candle_on_roll_flushes_prior_bucket_only_on_advance() {
        let prev = [1000.0, 60.0, 66.0, 59.0, 64.0];
        // Same bucket -> the candle is still forming, nothing to persist.
        assert_eq!(closed_candle_on_roll(Some(prev), 1000), None);
        // New (newer) bucket -> the prior candle just closed, so return it.
        assert_eq!(closed_candle_on_roll(Some(prev), 2000), Some(prev));
        // First-ever tick for this bucket (no prior tip) -> nothing closed.
        assert_eq!(closed_candle_on_roll(None, 2000), None);
        // Defensive: a stale tick into an OLDER bucket must not be treated as a close.
        assert_eq!(closed_candle_on_roll(Some(prev), 500), None);
    }

    #[test]
    fn stream_groups_batches_by_five_and_dedups_digits() {
        let plans: Vec<PrefetchPlan> = ["A", "B", "C", "D", "E", "F"]
            .iter()
            .map(|s| PrefetchPlan {
                query_symbol: s.to_string(),
                digits: 3,
                arbitrum_symbol: None,
                index_token: String::new(),
            })
            .collect();
        let (groups, digits) = stream_groups_and_digits(&plans);
        assert_eq!(groups.len(), 2); // 5 + 1
        assert_eq!(groups[0].len(), 5);
        assert_eq!(groups[1].len(), 1);
        assert_eq!(digits.get("A"), Some(&3));
        assert_eq!(digits.len(), 6);
    }

    #[test]
    fn displayable_stream_plans_exclude_usdc_extra_token() {
        let plans = chainlink_prefetch_plans();
        assert!(!plans.iter().any(|plan| plan.query_symbol == "USDC"));
    }
}
