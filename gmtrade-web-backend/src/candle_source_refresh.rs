//! Chainlink Data Engine candle prefetch + auth-token refresher pre-aggregating into [`CandleCache`].

use std::collections::HashMap;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use futures_util::{stream, StreamExt};
use gmsol_price_candle_client::PriceCandle;

use crate::sources::arbitrum_tickers::normalize_symbol;
use crate::sources::chainlink_candle::{candle_window, data_source_symbol, HistoryOutcome};
use crate::state::{AppState, CandleCache};
use crate::tokens::token_rows;
use crate::tokens::{DataSource, DECIMALS_DIFF};
use crate::util::now_unix;
use crate::{
    config::{Config, ExtraTokenCandlesConfig},
    tokens::TokenRow,
};

use crate::metrics;

/// Periods the Arbitrum candle endpoint serves; 30m/2h are NOT among them (it 400s), so the fallback skips those.
const ARBITRUM_PERIODS: [&str; 6] = ["1m", "5m", "15m", "1h", "4h", "1d"];

/// Each aggregable period and its finer fallback sources (coarsest first), derived only when its own direct fetch was empty; ordered fine-to-coarse so a coarser target can reuse a finer one derived this pass.
const AGGREGATIONS: [(&str, &[&str]); 4] = [
    ("15m", &["5m", "1m"]),
    ("30m", &["15m", "5m", "1m"]),
    ("2h", &["1h", "30m", "15m", "5m", "1m"]),
    ("4h", &["2h", "1h", "30m", "15m", "5m", "1m"]),
];

/// One fetched `(symbol, period)` candle window result.
type FetchResult = ((String, String), Vec<[f64; 5]>);

/// Batch-prefetched price-candle windows keyed by `(index_token, period)`.
type PriceCandleBatchMap = HashMap<(String, String), Vec<[f64; 5]>>;
type PriceCandleBatch = Arc<PriceCandleBatchMap>;

fn price_candle_batch_estimated_rows(
    token_count: usize,
    resolution_secs: i64,
    from: i64,
    to: i64,
) -> i64 {
    if resolution_secs <= 0 {
        return 0;
    }
    let buckets = (to - from).max(0) / resolution_secs;
    buckets.saturating_mul(token_count as i64)
}

fn price_candle_batch_exceeds_limit(
    token_count: usize,
    resolution_secs: i64,
    from: i64,
    to: i64,
    max_rows: i64,
) -> Option<i64> {
    if max_rows <= 0 {
        return None;
    }
    let estimated = price_candle_batch_estimated_rows(token_count, resolution_secs, from, to);
    (estimated > max_rows).then_some(estimated)
}

fn price_candle_batch_chunk_size(
    token_count: usize,
    resolution_secs: i64,
    from: i64,
    to: i64,
    target_rows: i64,
    max_rows: i64,
) -> usize {
    if token_count == 0 {
        return 0;
    }
    let rows_per_token = price_candle_batch_estimated_rows(1, resolution_secs, from, to);
    if rows_per_token <= 0 {
        return token_count;
    }
    let row_budget = match (target_rows > 0, max_rows > 0) {
        (true, true) => target_rows.min(max_rows),
        (true, false) => target_rows,
        (false, true) => max_rows,
        (false, false) => return token_count,
    };
    usize::try_from(row_budget / rows_per_token)
        .unwrap_or(usize::MAX)
        .clamp(1, token_count)
}

/// Aggregate finer candles into a coarser period, newest-first, dropping an unaligned leading bucket. PURE.
pub fn aggregate_candles(rows: &[[f64; 5]], target_secs: i64) -> Vec<[f64; 5]> {
    if rows.is_empty() || target_secs <= 0 {
        return Vec::new();
    }
    // Track oldest/newest source ts to pick open/close, plus running high/low.
    struct Bucket {
        oldest_ts: i64,
        newest_ts: i64,
        open: f64,
        close: f64,
        high: f64,
        low: f64,
    }
    let mut buckets: HashMap<i64, Bucket> = HashMap::new();

    // Oldest input candle is the LAST element (newest-first); its bucket is dropped if unaligned.
    let oldest = rows[rows.len() - 1];
    let oldest_ts = oldest[0] as i64;
    let oldest_aligned = oldest_ts - oldest_ts.rem_euclid(target_secs);
    let drop_leading_bucket = oldest_aligned != oldest_ts;

    for row in rows {
        let ts = row[0] as i64;
        let aligned = ts - ts.rem_euclid(target_secs);
        // When the oldest candle is unaligned, its whole bucket is discarded.
        if drop_leading_bucket && aligned == oldest_aligned {
            continue;
        }
        let (open, high, low, close) = (row[1], row[2], row[3], row[4]);
        buckets
            .entry(aligned)
            .and_modify(|b| {
                if high > b.high {
                    b.high = high;
                }
                if low < b.low {
                    b.low = low;
                }
                if ts < b.oldest_ts {
                    b.oldest_ts = ts;
                    b.open = open;
                }
                if ts > b.newest_ts {
                    b.newest_ts = ts;
                    b.close = close;
                }
            })
            .or_insert(Bucket {
                oldest_ts: ts,
                newest_ts: ts,
                open,
                close,
                high,
                low,
            });
    }

    // Emit newest-first (descending bucket start).
    let mut aligned_keys: Vec<i64> = buckets.keys().copied().collect();
    aligned_keys.sort_unstable_by(|a, b| b.cmp(a));
    aligned_keys
        .into_iter()
        .map(|k| {
            let b = &buckets[&k];
            [k as f64, b.open, b.high, b.low, b.close]
        })
        .collect()
}

/// Aggregate `target_secs` candles for `symbol` from the first non-empty period in `sources` (coarsest first); returns `(rows, source_used)` or `None`. PURE.
fn derive_cascade(
    windows: &HashMap<(String, String), Vec<[f64; 5]>>,
    symbol: &str,
    sources: &[&'static str],
    target_secs: i64,
) -> Option<(Vec<[f64; 5]>, &'static str)> {
    for source in sources {
        let Some(rows) = windows
            .get(&(symbol.to_string(), (*source).to_string()))
            .filter(|w| !w.is_empty())
        else {
            continue;
        };
        let agg = aggregate_candles(rows, target_secs);
        if !agg.is_empty() {
            return Some((agg, *source));
        }
    }
    None
}

/// Convert price-candle GraphQL rows (18-decimal OHLC strings) into the pipeline's newest-first
/// `[ts, open, high, low, close]` float rows, matching the frontend's `candlePrice / 1e18`. Rows with an
/// unparseable or non-finite OHLC field are dropped. PURE.
pub fn price_candle_rows_to_ohlc(rows: &[PriceCandle]) -> Vec<[f64; 5]> {
    let scale = |s: &str| -> Option<f64> {
        let v = s.parse::<f64>().ok()? / 1e18;
        v.is_finite().then_some(v)
    };
    let mut out: Vec<[f64; 5]> = rows
        .iter()
        .filter_map(|c| {
            Some([
                c.timestamp as f64,
                scale(&c.open)?,
                scale(&c.high)?,
                scale(&c.low)?,
                scale(&c.close)?,
            ])
        })
        .collect();
    // Pipeline rows are newest-first: aggregate_candles/derive_cascade and the cache/HTTP readers all assume descending ts.
    out.sort_unstable_by(|a, b| b[0].total_cmp(&a[0]));
    out
}

/// Fetch + convert one `(index_token, period)` window from the price-candle GraphQL service into the
/// pipeline's newest-first OHLC rows. Empty when the endpoint is unset, the token is unknown, the period
/// has no resolution, or the fetch errors. Used as the FIRST source under `price_candle_first` and as the
/// last-resort fallback otherwise.
async fn fetch_price_candle_window(
    state: &AppState,
    index_token: &str,
    period: &str,
    from: i64,
    to: i64,
) -> Vec<[f64; 5]> {
    if index_token.is_empty() || !state.price_candle.is_configured() {
        return Vec::new();
    }
    let Some(secs) = crate::sources::chainlink_candle::resolution_seconds(period) else {
        return Vec::new();
    };
    let upstream = metrics::UpstreamGuard::start(metrics::UpstreamOperation::PriceCandleWindow);
    let fetched = state
        .price_candle
        .fetch_candles(index_token.to_string(), secs as i32, from, to)
        .await;
    upstream.finish_result(&fetched, Vec::is_empty);
    match fetched {
        Ok(rows) => price_candle_rows_to_ohlc(&rows),
        Err(err) => {
            tracing::warn!(index_token = %index_token, period = %period, error = %err, "price-candle candle fetch failed; keeping previous window");
            Vec::new()
        }
    }
}

async fn fetch_price_candle_window_with_service(
    price_candle: &gmsol_price_candle_client::PriceCandleService,
    index_token: &str,
    period: &str,
    from: i64,
    to: i64,
) -> Vec<[f64; 5]> {
    if index_token.is_empty() || !price_candle.is_configured() {
        return Vec::new();
    }
    let Some(secs) = crate::sources::chainlink_candle::resolution_seconds(period) else {
        return Vec::new();
    };
    let upstream = metrics::UpstreamGuard::start(metrics::UpstreamOperation::PriceCandleWindow);
    let fetched = price_candle
        .fetch_candles(index_token.to_string(), secs as i32, from, to)
        .await;
    upstream.finish_result(&fetched, Vec::is_empty);
    match fetched {
        Ok(rows) => price_candle_rows_to_ohlc(&rows),
        Err(err) => {
            tracing::warn!(index_token = %index_token, period = %period, error = %err, "price-candle candle fetch failed; keeping previous window");
            Vec::new()
        }
    }
}

#[derive(Debug, Clone)]
struct DirectCandleFetchTask {
    symbol: String,
    period: String,
    digits: i32,
    from: i64,
    to: i64,
    arbitrum_symbol: Option<String>,
    index_token: String,
    is_extra: bool,
    prefetch_limit: usize,
}

#[derive(Clone, Copy)]
enum DirectCandleSourcePolicy<'a> {
    PriceCandleOnly {
        batch: Option<&'a PriceCandleBatchMap>,
    },
    Standard {
        auth_token: Option<&'a str>,
    },
}

struct DirectCandleFetcher<'a> {
    chainlink_candle: &'a crate::sources::chainlink_candle::ChainlinkCandleClient,
    arbitrum: &'a crate::sources::arbitrum_tickers::ArbitrumTickerClient,
    price_candle: &'a gmsol_price_candle_client::PriceCandleService,
    policy: DirectCandleSourcePolicy<'a>,
}

impl<'a> DirectCandleFetcher<'a> {
    fn price_candle_only(
        chainlink_candle: &'a crate::sources::chainlink_candle::ChainlinkCandleClient,
        arbitrum: &'a crate::sources::arbitrum_tickers::ArbitrumTickerClient,
        price_candle: &'a gmsol_price_candle_client::PriceCandleService,
        batch: Option<&'a PriceCandleBatchMap>,
    ) -> Self {
        Self {
            chainlink_candle,
            arbitrum,
            price_candle,
            policy: DirectCandleSourcePolicy::PriceCandleOnly { batch },
        }
    }

    fn standard(
        chainlink_candle: &'a crate::sources::chainlink_candle::ChainlinkCandleClient,
        arbitrum: &'a crate::sources::arbitrum_tickers::ArbitrumTickerClient,
        price_candle: &'a gmsol_price_candle_client::PriceCandleService,
        auth_token: Option<&'a str>,
    ) -> Self {
        Self {
            chainlink_candle,
            arbitrum,
            price_candle,
            policy: DirectCandleSourcePolicy::Standard { auth_token },
        }
    }

    /// Fetch one direct candle window with the configured source policy. Empty results are handled by
    /// keep-previous cache assembly at the caller.
    async fn fetch(&self, task: &DirectCandleFetchTask) -> Vec<[f64; 5]> {
        match self.policy {
            DirectCandleSourcePolicy::PriceCandleOnly { batch } => {
                self.fetch_price_candle_only(task, batch).await
            }
            DirectCandleSourcePolicy::Standard { auth_token } => {
                self.fetch_standard(task, auth_token).await
            }
        }
    }

    async fn fetch_price_candle_only(
        &self,
        task: &DirectCandleFetchTask,
        batch: Option<&PriceCandleBatchMap>,
    ) -> Vec<[f64; 5]> {
        let fetched = match batch {
            Some(batch) => batch
                .get(&(task.index_token.clone(), task.period.clone()))
                .cloned()
                .unwrap_or_default(),
            None => {
                fetch_price_candle_window_with_service(
                    self.price_candle,
                    &task.index_token,
                    &task.period,
                    task.from,
                    task.to,
                )
                .await
            }
        };
        if !fetched.is_empty() {
            tracing::debug!(
                symbol = %task.symbol,
                index_token = %task.index_token,
                period = %task.period,
                n = fetched.len(),
                "candle prefetch: price-candle primary (price_candle_first)"
            );
        }
        fetched
    }

    async fn fetch_standard(
        &self,
        task: &DirectCandleFetchTask,
        auth_token: Option<&str>,
    ) -> Vec<[f64; 5]> {
        let mut empty_reason: Option<&'static str> = None;
        let mut fetched = Vec::new();

        if let Some(token) = auth_token {
            let upstream =
                metrics::UpstreamGuard::start(metrics::UpstreamOperation::DataEngineCandles);
            let fetched_result = self
                .chainlink_candle
                .fetch_candles(
                    &task.symbol,
                    &task.period,
                    task.from,
                    task.to,
                    token,
                    task.digits,
                )
                .await;
            upstream.finish_result(
                &fetched_result,
                |outcome| !matches!(outcome, HistoryOutcome::Rows(rows) if !rows.is_empty()),
            );
            match fetched_result {
                Ok(HistoryOutcome::Rows(rows)) => fetched = rows,
                Ok(HistoryOutcome::NotFound) => {
                    empty_reason = Some("Data Engine 404 (no series for symbol/resolution)");
                }
                Ok(HistoryOutcome::EmptyBody) => {
                    empty_reason = Some("Data Engine 200 but empty body (no candles)");
                }
                Err(err) => {
                    tracing::warn!(symbol = %task.symbol, period = %task.period, error = %err, "candle prefetch fetch failed; keeping previous window");
                    empty_reason = Some("fetch error");
                }
            }
        }

        let may_use_fallback = auth_token.is_some() || task.is_extra;
        if fetched.is_empty()
            && may_use_fallback
            && ARBITRUM_PERIODS.contains(&task.period.as_str())
            && task.arbitrum_symbol.is_some()
        {
            let arbitrum_symbol = task.arbitrum_symbol.as_deref().expect("checked above");
            let upstream =
                metrics::UpstreamGuard::start(metrics::UpstreamOperation::ArbitrumCandles);
            let fetched_result = self
                .arbitrum
                .fetch_candles(arbitrum_symbol, &task.period, task.prefetch_limit)
                .await;
            upstream.finish_result(&fetched_result, Vec::is_empty);
            match fetched_result {
                Ok(rows) if !rows.is_empty() => {
                    tracing::debug!(
                        symbol = %task.symbol,
                        arbitrum_symbol,
                        period = %task.period,
                        n = rows.len(),
                        "candle prefetch fell back to Arbitrum"
                    );
                    fetched = rows;
                    empty_reason = None;
                }
                Ok(_) => {}
                Err(err) => {
                    tracing::warn!(symbol = %task.symbol, period = %task.period, error = %err, "Arbitrum candle fallback failed; keeping previous window");
                }
            }
        }

        if fetched.is_empty() && may_use_fallback {
            let converted = fetch_price_candle_window_with_service(
                self.price_candle,
                &task.index_token,
                &task.period,
                task.from,
                task.to,
            )
            .await;
            if !converted.is_empty() {
                tracing::debug!(
                    symbol = %task.symbol,
                    index_token = %task.index_token,
                    period = %task.period,
                    n = converted.len(),
                    "candle prefetch fell back to price-candle"
                );
                fetched = converted;
                empty_reason = None;
            }
        }

        if fetched.is_empty() {
            if let Some(reason) = empty_reason {
                tracing::info!(
                    symbol = %task.symbol,
                    period = %task.period,
                    reason,
                    "candle prefetch: no data after fallback"
                );
            }
        }
        fetched
    }
}

/// Batch-prefetch every plan's price-candle window with bounded `candlesBatch` token chunks,
/// keyed `(index_token, period) -> newest-first OHLC rows`. The window per period matches
/// what the per-token path computes, so results are equivalent. A failed/empty chunk only
/// leaves that chunk's entries absent, so the caller keeps previous windows for those tokens.
async fn batch_prefetch_price_candle(
    state: &AppState,
    plans: &[PrefetchPlan],
    now: i64,
) -> PriceCandleBatchMap {
    batch_prefetch_price_candle_for_periods(
        &state.price_candle,
        plans,
        &crate::runtime::params().direct_periods,
        now,
        PriceCandleBatchPrefetchOptions {
            prefetch_limit: state.config.candle_prefetch_limit.max(1),
            max_rows: state.config.price_candle_batch_max_rows,
            target_rows: state.config.price_candle_batch_target_rows,
            concurrency: state.config.price_candle_batch_concurrency,
        },
    )
    .await
}

#[derive(Debug, Clone, Copy)]
struct PriceCandleBatchPrefetchOptions {
    prefetch_limit: i64,
    max_rows: i64,
    target_rows: i64,
    concurrency: usize,
}

async fn batch_prefetch_price_candle_for_periods(
    price_candle: &gmsol_price_candle_client::PriceCandleService,
    plans: &[PrefetchPlan],
    periods: &[String],
    now: i64,
    options: PriceCandleBatchPrefetchOptions,
) -> PriceCandleBatchMap {
    let mut out: PriceCandleBatchMap = HashMap::new();
    if !price_candle.is_configured() {
        return out;
    }
    let index_tokens: Vec<String> = plans
        .iter()
        .map(|p| p.index_token.clone())
        .filter(|t| !t.is_empty())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    if index_tokens.is_empty() {
        return out;
    }
    for period in periods {
        let Some(secs) = crate::sources::chainlink_candle::resolution_seconds(period) else {
            continue;
        };
        let Some((from, to)) = candle_window(now, period, options.prefetch_limit.max(1)) else {
            continue;
        };
        // Mirror the per-token retention clamp so `to - from` stays an exact resolution multiple.
        let from = match candle_retention_secs(period) {
            Some(r) => from.max(to - r),
            None => from,
        };
        let chunk_size = price_candle_batch_chunk_size(
            index_tokens.len(),
            secs,
            from,
            to,
            options.target_rows,
            options.max_rows,
        );
        let chunks: Vec<Vec<String>> = index_tokens
            .chunks(chunk_size.max(1))
            .map(<[String]>::to_vec)
            .collect();
        let chunk_count = chunks.len();
        let results = stream::iter(chunks.into_iter().enumerate().map(|(chunk_index, tokens)| {
            let estimated_rows = price_candle_batch_estimated_rows(tokens.len(), secs, from, to);
            async move {
                if price_candle_batch_exceeds_limit(tokens.len(), secs, from, to, options.max_rows)
                    .is_some()
                {
                    return (chunk_index, tokens, estimated_rows, None);
                }
                let upstream =
                    metrics::UpstreamGuard::start(metrics::UpstreamOperation::PriceCandleBatch);
                let result = price_candle
                    .fetch_candles_batch(&tokens, secs as i32, from, to)
                    .await;
                upstream.finish_result(&result, Vec::is_empty);
                (chunk_index, tokens, estimated_rows, Some(result))
            }
        }))
        .buffer_unordered(options.concurrency.max(1))
        .collect::<Vec<_>>()
        .await;

        for (chunk_index, tokens, estimated_rows, result) in results {
            match result {
                Some(Ok(rows)) => {
                    tracing::debug!(
                        period = %period,
                        chunk = chunk_index + 1,
                        chunk_count,
                        token_count = tokens.len(),
                        estimated_rows,
                        returned_rows = rows.len(),
                        "price-candle batch chunk fetched"
                    );
                    let mut by_token: HashMap<String, Vec<PriceCandle>> = HashMap::new();
                    for r in rows {
                        by_token
                            .entry(r.index_token)
                            .or_default()
                            .push(PriceCandle {
                                timestamp: r.timestamp,
                                open: r.open,
                                high: r.high,
                                low: r.low,
                                close: r.close,
                            });
                    }
                    for (token, candles) in by_token {
                        out.insert(
                            (token, period.to_string()),
                            price_candle_rows_to_ohlc(&candles),
                        );
                    }
                }
                Some(Err(err)) => {
                    tracing::warn!(
                        period = %period,
                        chunk = chunk_index + 1,
                        chunk_count,
                        token_count = tokens.len(),
                        estimated_rows,
                        error = %err,
                        "price-candle batch chunk failed; keeping previous windows for this chunk"
                    );
                }
                None => {
                    tracing::warn!(
                        period = %period,
                        chunk = chunk_index + 1,
                        chunk_count,
                        token_count = tokens.len(),
                        estimated_rows,
                        max_rows = options.max_rows,
                        "price-candle batch chunk skipped; one-token window exceeds web-backend hard limit"
                    );
                }
            }
        }
    }
    out
}

/// Keep-previous-on-empty for one `(symbol, period)` window: non-empty fetch wins, else keep `prev`. PURE.
pub fn merge_keep_previous_window(
    prev: Option<&Vec<[f64; 5]>>,
    fetched: Vec<[f64; 5]>,
) -> Option<Vec<[f64; 5]>> {
    if !fetched.is_empty() {
        Some(fetched)
    } else {
        prev.cloned()
    }
}

fn assemble_direct_windows(
    prev: &CandleCache,
    results: Vec<FetchResult>,
) -> HashMap<(String, String), Vec<[f64; 5]>> {
    let mut next = HashMap::new();
    for (key, fetched) in results {
        if let Some(window) = merge_keep_previous_window(prev.candles.get(&key), fetched) {
            next.insert(key, window);
        }
    }
    next
}

fn preserve_unfilled_previous_window(
    prev: &CandleCache,
    next: &mut HashMap<(String, String), Vec<[f64; 5]>>,
    target_key: &(String, String),
    preserve: bool,
) {
    if !preserve {
        return;
    }
    if let Some(previous) = prev
        .candles
        .get(target_key)
        .filter(|window| !window.is_empty())
    {
        next.insert(target_key.clone(), previous.clone());
    }
}

/// Per-token prefetch plan: the Chainlink query symbol, precision-trim `digits`, and the Arbitrum fallback symbol for Gmx tokens.
#[derive(Debug, Clone, PartialEq)]
pub struct PrefetchPlan {
    pub query_symbol: String,
    pub digits: i32,
    /// `Some(arbitrum_symbol)` for `data_source = Gmx` tokens the Data Engine may lack (ASTER/WLFI/XPL); `None` otherwise.
    pub arbitrum_symbol: Option<String>,
    /// Index-token mint, used as the price-candle GraphQL fallback key when the Data Engine + Arbitrum are empty (keeper-priced markets).
    pub index_token: String,
}

/// The Chainlink-universe prefetch plans resolving each token to its query symbol + precision digits. PURE.
pub fn chainlink_prefetch_plans() -> Vec<PrefetchPlan> {
    // Chainlink is the primary candle source; Gmx tokens fall back to Arbitrum when the Data Engine returns nothing.
    token_rows()
        .iter()
        .filter(|r| r.view_flg)
        .map(|r| PrefetchPlan {
            query_symbol: data_source_symbol(r.symbol),
            digits: r.decimals as i32 - DECIMALS_DIFF as i32,
            arbitrum_symbol: (r.data_source == DataSource::Gmx).then(|| normalize_symbol(r.symbol)),
            index_token: r.index_token_address.to_string(),
        })
        .collect()
}

#[derive(Debug, Clone)]
struct CandlePlanSet {
    plans: Vec<PrefetchPlan>,
    extra_query_symbols: BTreeSet<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ExtraCandleIssue {
    symbol: String,
    reason: &'static str,
}

#[derive(Debug, Clone, Default)]
struct ExtraCandleResolution {
    configured_count: usize,
    plans: Vec<PrefetchPlan>,
    resolved: Vec<ResolvedExtraCandle>,
    query_symbols: BTreeSet<String>,
    issues: Vec<ExtraCandleIssue>,
}

impl ExtraCandleResolution {
    fn is_degraded(&self) -> bool {
        self.plans.is_empty() || !self.issues.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ResolvedExtraCandle {
    canonical_symbol: String,
    data_source: DataSource,
    query_symbol: String,
    has_arbitrum_fallback: bool,
}

fn canonical_symbol(symbol: &str) -> Option<String> {
    let symbol = symbol.trim();
    (!symbol.is_empty()).then(|| symbol.to_ascii_uppercase())
}

fn resolve_extra_candle_plans_from_rows(
    config: &ExtraTokenCandlesConfig,
    rows: &[TokenRow],
    price_candle_first: bool,
) -> ExtraCandleResolution {
    resolve_extra_candle_plans_with_query_symbol(
        config,
        rows,
        price_candle_first,
        data_source_symbol,
    )
}

fn resolve_extra_candle_plans_with_query_symbol<F>(
    config: &ExtraTokenCandlesConfig,
    rows: &[TokenRow],
    price_candle_first: bool,
    query_symbol_for: F,
) -> ExtraCandleResolution
where
    F: Fn(&str) -> String,
{
    let mut resolution = ExtraCandleResolution::default();
    if !config.enabled {
        return resolution;
    }

    let mut configured = BTreeSet::new();
    for raw in &config.symbols {
        match canonical_symbol(raw) {
            Some(symbol) => {
                configured.insert(symbol);
            }
            None => resolution.issues.push(ExtraCandleIssue {
                symbol: raw.clone(),
                reason: "empty_symbol",
            }),
        }
    }
    resolution.configured_count = configured.len();

    let mut rows_by_symbol: BTreeMap<String, Vec<&TokenRow>> = BTreeMap::new();
    for row in rows {
        if let Some(symbol) = canonical_symbol(row.symbol) {
            rows_by_symbol.entry(symbol).or_default().push(row);
        }
    }
    let displayable_queries: BTreeSet<String> = rows
        .iter()
        .filter(|row| row.view_flg)
        .filter_map(|row| canonical_symbol(row.symbol))
        .map(|symbol| query_symbol_for(&symbol))
        .collect();
    let mut candidates: BTreeMap<String, Vec<(String, DataSource, PrefetchPlan)>> = BTreeMap::new();

    for symbol in configured {
        let Some(matches) = rows_by_symbol.get(&symbol) else {
            resolution.issues.push(ExtraCandleIssue {
                symbol,
                reason: "unknown_symbol",
            });
            continue;
        };
        if matches.len() != 1 {
            resolution.issues.push(ExtraCandleIssue {
                symbol,
                reason: "ambiguous_symbol",
            });
            continue;
        }
        let row = matches[0];
        if !price_candle_first && row.data_source != DataSource::Gmx {
            resolution.issues.push(ExtraCandleIssue {
                symbol,
                reason: "invalid_source_policy",
            });
            continue;
        }
        let plan = PrefetchPlan {
            query_symbol: query_symbol_for(&symbol),
            digits: row.decimals as i32 - DECIMALS_DIFF as i32,
            arbitrum_symbol: (row.data_source == DataSource::Gmx)
                .then(|| normalize_symbol(&symbol)),
            index_token: row.index_token_address.to_string(),
        };
        if displayable_queries.contains(&plan.query_symbol) {
            resolution.issues.push(ExtraCandleIssue {
                symbol,
                reason: "displayable_query_collision",
            });
            continue;
        }
        candidates
            .entry(plan.query_symbol.clone())
            .or_default()
            .push((symbol, row.data_source, plan));
    }

    for (query_symbol, mut entries) in candidates {
        if entries.len() != 1 {
            resolution
                .issues
                .extend(entries.into_iter().map(|(symbol, _, _)| ExtraCandleIssue {
                    symbol,
                    reason: "extra_query_collision",
                }));
            continue;
        }
        let (canonical_symbol, data_source, plan) = entries.pop().expect("single checked entry");
        resolution.resolved.push(ResolvedExtraCandle {
            canonical_symbol,
            data_source,
            query_symbol: query_symbol.clone(),
            has_arbitrum_fallback: plan.arbitrum_symbol.is_some(),
        });
        resolution.query_symbols.insert(query_symbol);
        resolution.plans.push(plan);
    }
    resolution
}

fn resolve_extra_candle_plans(config: &Config) -> ExtraCandleResolution {
    resolve_extra_candle_plans_from_rows(
        &config.extra_token_candles,
        token_rows(),
        config.price_candle_first,
    )
}

fn history_candle_plan_set(config: &Config) -> CandlePlanSet {
    let mut plans = chainlink_prefetch_plans();
    let resolution = resolve_extra_candle_plans(config);
    plans.extend(resolution.plans);
    CandlePlanSet {
        plans,
        extra_query_symbols: resolution.query_symbols,
    }
}

fn candle_redis_suffix_with_policy(query_symbol: &str, period: &str, is_extra: bool) -> String {
    if is_extra {
        format!("v2:extra-candlestick:{query_symbol}:{period}")
    } else {
        format!("v2:candlestick:{query_symbol}:{period}")
    }
}

/// Resolve the Redis namespace for an HTTP/24h read using the same extra-token resolver as history.
pub(crate) fn candle_redis_suffix(config: &Config, query_symbol: &str, period: &str) -> String {
    let is_extra = resolve_extra_candle_plans(config)
        .query_symbols
        .contains(query_symbol);
    candle_redis_suffix_with_policy(query_symbol, period, is_extra)
}

fn candle_reaggregation_suffixes(
    query_symbol: &str,
    source: &str,
    target: &str,
    extra_query_symbols: &BTreeSet<String>,
) -> (String, String) {
    let is_extra = extra_query_symbols.contains(query_symbol);
    (
        candle_redis_suffix_with_policy(query_symbol, source, is_extra),
        candle_redis_suffix_with_policy(query_symbol, target, is_extra),
    )
}

type CandleRestoreQuery = (String, isize, isize);
type CandleRestoreRequests = (Vec<CandleRestoreQuery>, Vec<(String, String)>);

fn candle_restore_requests(
    plans: &[PrefetchPlan],
    periods: &[String],
    extra_query_symbols: &BTreeSet<String>,
    prefetch_limit: i64,
) -> CandleRestoreRequests {
    let prefetch_limit = prefetch_limit.max(1);
    let queries = plans
        .iter()
        .flat_map(|plan| {
            periods.iter().map(move |period| {
                (
                    candle_redis_suffix_with_policy(
                        &plan.query_symbol,
                        period,
                        extra_query_symbols.contains(&plan.query_symbol),
                    ),
                    0,
                    prefetch_limit as isize - 1,
                )
            })
        })
        .collect();
    let keys = plans
        .iter()
        .flat_map(|plan| {
            periods
                .iter()
                .map(move |period| (plan.query_symbol.clone(), period.clone()))
        })
        .collect();
    (queries, keys)
}

pub fn audit_extra_candle_resolution(config: &Config, token_table_ready: bool) {
    let runtime = &config.extra_token_candles;
    if !runtime.enabled {
        tracing::info!(
            configured = runtime.symbols.len(),
            "extra token candles disabled by runtime config"
        );
        return;
    }
    if !config.token_source.enable {
        tracing::error!(
            reason = "token_source_disabled",
            configured = runtime.symbols.len(),
            "extra token candles degraded"
        );
        return;
    }
    if !token_table_ready {
        tracing::error!(
            reason = "token_map_unavailable",
            configured = runtime.symbols.len(),
            "extra token candles degraded"
        );
        return;
    }

    let resolution = resolve_extra_candle_plans(config);
    for issue in &resolution.issues {
        tracing::error!(
            symbol = %issue.symbol,
            reason = issue.reason,
            "extra token candle symbol rejected"
        );
    }
    for resolved in &resolution.resolved {
        tracing::info!(
            canonical_symbol = %resolved.canonical_symbol,
            data_source = ?resolved.data_source,
            query_symbol = %resolved.query_symbol,
            storage_scope = "v2:extra-candlestick",
            arbitrum_fallback = resolved.has_arbitrum_fallback,
            "extra token candle plan resolved"
        );
    }
    if resolution.plans.is_empty() {
        tracing::error!(
            status = "degraded",
            configured = resolution.configured_count,
            resolved_history = 0,
            rejected = resolution.issues.len(),
            stream_count = 0,
            reason = "no_valid_extra_plans",
            "extra token candles degraded"
        );
        return;
    }
    if resolution.is_degraded() {
        tracing::error!(
            status = "degraded",
            configured = resolution.configured_count,
            resolved_history = resolution.plans.len(),
            rejected = resolution.issues.len(),
            stream_count = 0,
            source_policy = if config.price_candle_first {
                "price-candle-only"
            } else {
                "data-engine-arbitrum-price-candle"
            },
            storage_scope = "v2:extra-candlestick",
            reason = "partial_resolution",
            "extra token candles degraded"
        );
        return;
    }
    tracing::info!(
        status = "resolved",
        configured = resolution.configured_count,
        resolved_history = resolution.plans.len(),
        rejected = 0,
        stream_count = 0,
        source_policy = if config.price_candle_first {
            "price-candle-only"
        } else {
            "data-engine-arbitrum-price-candle"
        },
        storage_scope = "v2:extra-candlestick",
        "extra token candles resolved"
    );
}

/// The Data Engine auth-token refresh loop: on success store the new token; on error KEEP the previous token + warn.
pub async fn run_auth_token_refresh(state: AppState) {
    let secs = state.config.cl_auth_refresh_secs.max(1);
    let mut interval = crate::ticker::interval(secs);
    tracing::info!(
        cl_auth_refresh_secs = secs,
        "chainlink candle auth-token refresh loop started"
    );
    loop {
        interval.tick().await;
        match state.chainlink_candle.fetch_auth_token().await {
            Ok(token) => {
                state.cl_auth_token.store(Arc::new(Some(token)));
                tracing::debug!("chainlink candle auth token refreshed");
            }
            Err(err) => {
                tracing::warn!(error = %err, "chainlink candle auth token refresh failed; keeping previous token");
            }
        }
    }
}

/// Run one prefetch tick: fetch each token's direct periods, keep-previous-on-empty, derive missing periods via cascade, store the [`CandleCache`]. Never errors.
pub async fn candle_prefetch_tick_once(state: &AppState) {
    if state.config.extra_token_candles.enabled {
        return candle_prefetch_tick_with_extra_tokens(state).await;
    }

    let refresh = metrics::RefreshGuard::start(metrics::Worker::CandlePrefetch);

    // The Data Engine auth token is consumed only by the Data Engine leg, which is
    // skipped entirely under `price_candle_first` (price-candle is the sole source)
    // and whose refresher is therefore never spawned in that mode. Gating the whole
    // tick on the token there would freeze the cache forever, so only require it when
    // the Data Engine leg is actually used; otherwise proceed with an unused token.
    let token = state.cl_auth_token.load();
    let token = match token.as_ref() {
        Some(t) => t.clone(),
        None if state.config.price_candle_first => String::new(),
        None => {
            // Auth not warmed yet - skip this tick (keep whatever is cached).
            tracing::debug!("candle prefetch skipped: auth token not available yet");
            refresh.finish(metrics::RefreshResult::Skipped);
            return;
        }
    };

    let prev = state.candle_cache.load();
    let now = now_unix();
    let plans = chainlink_prefetch_plans();
    let concurrency = state.config.candle_prefetch_concurrency.max(1);
    let prefetch_limit = state.config.candle_prefetch_limit.max(1);

    // Under price_candle_first, price-candle is the sole direct source. Batch all of it
    // up front -- ONE `candlesBatch` request per period instead of one `candles` request
    // per (token, period) -- so we don't hammer the service and trip the HTTP/2
    // reset-stream limit on the shared connection. `None` under !price_candle_first, where
    // price-candle is only a lazy per-token fallback (low volume) and stays unchanged.
    let price_candle_batch: Option<PriceCandleBatch> = if state.config.price_candle_first {
        Some(Arc::new(
            batch_prefetch_price_candle(state, &plans, now).await,
        ))
    } else {
        None
    };

    // Flat list of DIRECT-period fetch tasks, fanned out below with bounded concurrency.
    let mut tasks = Vec::new();
    for plan in &plans {
        for period in &crate::runtime::params().direct_periods {
            let Some((from, to)) = candle_window(now, period, prefetch_limit) else {
                continue;
            };
            // Clamp the lookback to the per-period retention relative to `to` so `to - from` stays an exact resolution multiple.
            let from = match candle_retention_secs(period) {
                Some(secs) => from.max(to - secs),
                None => from,
            };
            tasks.push((
                plan.query_symbol.clone(),
                period.to_string(),
                plan.digits,
                from,
                to,
                plan.arbitrum_symbol.clone(),
                plan.index_token.clone(),
            ));
        }
    }

    // A fetch error yields an empty window (keep-previous applies below).
    let results: Vec<FetchResult> = futures_util::stream::iter(tasks)
        .map(|(symbol, period, digits, from, to, arbitrum_symbol, index_token)| {
            let token = token.clone();
            let price_candle_batch = price_candle_batch.clone();
            let price_candle_first = state.config.price_candle_first;
            async move {
                // Why the Data Engine returned no rows, surfaced only if still empty after every fallback.
                let mut empty_reason: Option<&'static str> = None;
                let mut fetched: Vec<[f64; 5]> = Vec::new();

                // price_candle_first: price-candle is the SOLE direct source -- the Data Engine + Arbitrum
                // are never tried. Periods price-candle doesn't serve (e.g. 30m/2h, which devnet's
                // price-candle resolutions omit) are left empty here and filled by the aggregation cascade
                // below from the finer price-candle periods, so there's no Data Engine 401 on devnet and no
                // data loss. (Used on devnet to serve the devnet series.)
                if price_candle_first {
                    // Look up the up-front batch (one request per period) instead of a
                    // per-token fetch; fall back to the per-token path only if the batch
                    // was unavailable (endpoint unset).
                    fetched = match &price_candle_batch {
                        Some(batch) => batch
                            .get(&(index_token.clone(), period.clone()))
                            .cloned()
                            .unwrap_or_default(),
                        None => {
                            fetch_price_candle_window(state, &index_token, &period, from, to).await
                        }
                    };
                    if !fetched.is_empty() {
                        tracing::debug!(symbol = %symbol, index_token = %index_token, period = %period, n = fetched.len(), "candle prefetch: price-candle primary (price_candle_first)");
                    }
                }

                // Data Engine: primary source (skipped entirely under price_candle_first).
                if fetched.is_empty() && !price_candle_first {
                    let upstream = metrics::UpstreamGuard::start(
                        metrics::UpstreamOperation::DataEngineCandles,
                    );
                    let fetched_result = state
                        .chainlink_candle
                        .fetch_candles(&symbol, &period, from, to, &token, digits)
                        .await;
                    upstream.finish_result(&fetched_result, |outcome| {
                        !matches!(outcome, HistoryOutcome::Rows(rows) if !rows.is_empty())
                    });
                    match fetched_result {
                        Ok(HistoryOutcome::Rows(rows)) => fetched = rows,
                        Ok(HistoryOutcome::NotFound) => {
                            empty_reason = Some("Data Engine 404 (no series for symbol/resolution)");
                        }
                        Ok(HistoryOutcome::EmptyBody) => {
                            empty_reason = Some("Data Engine 200 but empty body (no candles)");
                        }
                        Err(err) => {
                            tracing::warn!(symbol = %symbol, period = %period, error = %err, "candle prefetch fetch failed; keeping previous window");
                            empty_reason = Some("fetch error");
                        }
                    }
                }
                // Gmx tokens the Data Engine can't price (ASTER/WLFI/XPL) fall back to Arbitrum's real-price
                // candles. Also skipped under price_candle_first (price-candle is the sole source).
                if fetched.is_empty() && !price_candle_first && ARBITRUM_PERIODS.contains(&period.as_str()) {
                    if let Some(arb_symbol) = &arbitrum_symbol {
                        let upstream = metrics::UpstreamGuard::start(
                            metrics::UpstreamOperation::ArbitrumCandles,
                        );
                        let fetched_result = state
                            .arbitrum
                            .fetch_candles(arb_symbol, &period, prefetch_limit as usize)
                            .await;
                        upstream.finish_result(&fetched_result, Vec::is_empty);
                        match fetched_result {
                            Ok(rows) if !rows.is_empty() => {
                                tracing::debug!(symbol = %symbol, arb_symbol = %arb_symbol, period = %period, n = rows.len(), "candle prefetch fell back to Arbitrum");
                                fetched = rows;
                                empty_reason = None;
                            }
                            Ok(_) => {}
                            Err(err) => tracing::warn!(symbol = %symbol, period = %period, error = %err, "Arbitrum candle fallback failed; keeping previous window"),
                        }
                    }
                }
                // price-candle fallback: keeper-priced markets (USDMXN/WTI/precious metals) that neither the
                // Data Engine nor Arbitrum can price. Fetched by index-token from the price-candle GraphQL
                // service -- the same source the frontend uses for these markets -- so they flow through the
                // identical cache/Redis/24h path as every other candle. No-op when the endpoint is unset.
                // Skipped when `price_candle_first` already tried price-candle as the primary above.
                if fetched.is_empty() && !price_candle_first {
                    let converted =
                        fetch_price_candle_window(state, &index_token, &period, from, to).await;
                    if !converted.is_empty() {
                        tracing::debug!(symbol = %symbol, index_token = %index_token, period = %period, n = converted.len(), "candle prefetch fell back to price-candle");
                        fetched = converted;
                        empty_reason = None;
                    }
                }
                // Genuinely empty after every fallback: report the reason (404 vs empty body) at INFO so a frozen/missing feed is diagnosable in prod.
                if fetched.is_empty() {
                    if let Some(reason) = empty_reason {
                        tracing::info!(symbol = %symbol, period = %period, reason = %reason, "candle prefetch: no data after fallback");
                    }
                }
                ((symbol, period), fetched)
            }
        })
        .buffer_unordered(concurrency)
        .collect()
        .await;

    // Remember which direct windows were fetched successfully THIS tick. A previous
    // window retained after an empty fetch must not block the aggregation fallback.
    let fresh_direct: BTreeSet<(String, String)> = results
        .iter()
        .filter(|(_, fetched)| !fetched.is_empty())
        .map(|(key, _)| key.clone())
        .collect();

    // Assemble the DIRECT-period cache, keep-previous-on-empty per (symbol, period).
    let mut next: HashMap<(String, String), Vec<[f64; 5]>> = HashMap::new();
    for (key, fetched) in results {
        let prev_window = prev.candles.get(&key);
        if let Some(window) = merge_keep_previous_window(prev_window, fetched) {
            next.insert(key, window);
        }
    }

    // Derive missing periods via cascade; record (symbol,period)->source for tip-repair; `unfilled` = a period with no non-empty finer source to derive from this tick.
    let mut derived: HashMap<(String, String), &'static str> = HashMap::new();
    let mut unfilled: Vec<(String, String)> = Vec::new();
    for plan in &plans {
        for (target, sources) in AGGREGATIONS {
            let target_key = (plan.query_symbol.clone(), target.to_string());
            // A successful direct fetch this tick wins. A retained previous window does
            // not: try fresh/finer aggregation before falling back to that old window.
            if fresh_direct.contains(&target_key) {
                continue;
            }
            let Some(target_secs) = crate::sources::chainlink_candle::resolution_seconds(target)
            else {
                continue;
            };
            match derive_cascade(&next, &plan.query_symbol, sources, target_secs) {
                Some((agg, source)) => {
                    if let Some(window) =
                        merge_keep_previous_window(prev.candles.get(&target_key), agg)
                    {
                        next.insert(target_key.clone(), window);
                        derived.insert(target_key, source);
                    }
                }
                None => unfilled.push(target_key),
            }
        }
    }

    // A coarse period with no finer source at all could not be derived this tick (token fully dark).
    if !unfilled.is_empty() {
        tracing::warn!(count = unfilled.len(), windows = ?unfilled, "candle prefetch: periods unfilled -- no non-empty finer source to derive from");
    }

    write_candles_to_redis(state, &next).await;

    // Repair the truncated newest buckets of the periods we derived from the now-complete Redis source.
    reaggregate_recent_from_redis(state, &derived).await;

    state
        .candle_cache
        .store(Arc::new(CandleCache { candles: next }));
    refresh.finish(metrics::RefreshResult::Completed);
}

#[cfg(test)]
static EXTRA_PREFETCH_ENTRY_COUNT: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);

async fn candle_prefetch_tick_with_extra_tokens(state: &AppState) {
    #[cfg(test)]
    EXTRA_PREFETCH_ENTRY_COUNT.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

    let refresh = metrics::RefreshGuard::start(metrics::Worker::CandlePrefetch);

    let CandlePlanSet {
        plans,
        extra_query_symbols,
    } = history_candle_plan_set(&state.config);
    let token = state.cl_auth_token.load().as_ref().clone();
    if token.is_none() && !state.config.price_candle_first && extra_query_symbols.is_empty() {
        tracing::debug!("candle prefetch skipped: auth token not available yet");
        refresh.finish(metrics::RefreshResult::Skipped);
        return;
    }
    let prev = state.candle_cache.load();
    let now = now_unix();
    let concurrency = state.config.candle_prefetch_concurrency.max(1);
    let prefetch_limit = state.config.candle_prefetch_limit.max(1);

    let price_candle_batch: Option<PriceCandleBatch> = if state.config.price_candle_first {
        Some(Arc::new(
            batch_prefetch_price_candle(state, &plans, now).await,
        ))
    } else {
        None
    };

    let mut tasks = Vec::new();
    for plan in &plans {
        let is_extra = extra_query_symbols.contains(&plan.query_symbol);
        for period in &crate::runtime::params().direct_periods {
            let Some((from, to)) = candle_window(now, period, prefetch_limit) else {
                continue;
            };
            let from = match candle_retention_secs(period) {
                Some(secs) => from.max(to - secs),
                None => from,
            };
            tasks.push(DirectCandleFetchTask {
                symbol: plan.query_symbol.clone(),
                period: period.to_string(),
                digits: plan.digits,
                from,
                to,
                arbitrum_symbol: plan.arbitrum_symbol.clone(),
                index_token: plan.index_token.clone(),
                is_extra,
                prefetch_limit: prefetch_limit as usize,
            });
        }
    }

    let results: Vec<FetchResult> = futures_util::stream::iter(tasks)
        .map(|task| {
            let token = token.clone();
            let price_candle_batch = price_candle_batch.clone();
            let price_candle_first = state.config.price_candle_first;
            async move {
                let fetcher = if price_candle_first {
                    DirectCandleFetcher::price_candle_only(
                        &state.chainlink_candle,
                        &state.arbitrum,
                        &state.price_candle,
                        price_candle_batch.as_deref(),
                    )
                } else {
                    DirectCandleFetcher::standard(
                        &state.chainlink_candle,
                        &state.arbitrum,
                        &state.price_candle,
                        token.as_deref(),
                    )
                };
                let fetched = fetcher.fetch(&task).await;
                ((task.symbol, task.period), fetched)
            }
        })
        .buffer_unordered(concurrency)
        .collect()
        .await;

    let fresh_direct: BTreeSet<(String, String)> = results
        .iter()
        .filter(|(_, fetched)| !fetched.is_empty())
        .map(|(key, _)| key.clone())
        .collect();
    let mut next = assemble_direct_windows(&prev, results);
    let mut derived: HashMap<(String, String), &'static str> = HashMap::new();
    let mut unfilled: Vec<(String, String)> = Vec::new();
    let preserve_unfilled_previous = !extra_query_symbols.is_empty();
    for plan in &plans {
        for (target, sources) in AGGREGATIONS {
            let target_key = (plan.query_symbol.clone(), target.to_string());
            if fresh_direct.contains(&target_key) {
                continue;
            }
            let Some(target_secs) = crate::sources::chainlink_candle::resolution_seconds(target)
            else {
                continue;
            };
            match derive_cascade(&next, &plan.query_symbol, sources, target_secs) {
                Some((agg, source)) => {
                    if let Some(window) =
                        merge_keep_previous_window(prev.candles.get(&target_key), agg)
                    {
                        next.insert(target_key.clone(), window);
                        derived.insert(target_key, source);
                    }
                }
                None => {
                    preserve_unfilled_previous_window(
                        &prev,
                        &mut next,
                        &target_key,
                        preserve_unfilled_previous,
                    );
                    unfilled.push(target_key);
                }
            }
        }
    }

    if !unfilled.is_empty() {
        tracing::warn!(count = unfilled.len(), windows = ?unfilled, "candle prefetch: periods unfilled -- no non-empty finer source to derive from");
    }

    write_extra_candles_to_redis(state, &next, &extra_query_symbols).await;
    reaggregate_recent_extra_from_redis(state, &derived, &extra_query_symbols).await;

    state
        .candle_cache
        .store(Arc::new(CandleCache { candles: next }));
    refresh.finish(metrics::RefreshResult::Completed);
}

/// Number of recent SOURCE candles to re-aggregate from Redis each tick to repair the truncated target tip.
const REAGGREGATE_SOURCE_RECENT: isize = 24;

/// Parse a Redis candle member JSON into `[f64; 5]`, `None` on malformed input or wrong arity. PURE.
fn parse_candle_row(member: &str) -> Option<[f64; 5]> {
    let v: Vec<serde_json::Value> = serde_json::from_str(member).ok()?;
    if v.len() != 5 {
        return None;
    }
    Some([
        v[0].as_f64()?,
        v[1].as_f64()?,
        v[2].as_f64()?,
        v[3].as_f64()?,
        v[4].as_f64()?,
    ])
}

/// Repair the newest derived-period Redis buckets by re-aggregating the recent source series the tick used; only touches derived periods, never a direct fetch. No-op without Redis.
async fn reaggregate_recent_from_redis(
    state: &AppState,
    derived: &HashMap<(String, String), &'static str>,
) {
    let Some(redis) = &state.redis else {
        return;
    };
    for ((query_symbol, target), source) in derived {
        let Some(target_secs) = crate::sources::chainlink_candle::resolution_seconds(target) else {
            continue;
        };
        let src_suffix = format!("v2:candlestick:{query_symbol}:{source}");
        let members = redis
            .zrevrange(&src_suffix, 0, REAGGREGATE_SOURCE_RECENT - 1)
            .await
            .unwrap_or_default();
        let src_rows: Vec<[f64; 5]> = members.iter().filter_map(|m| parse_candle_row(m)).collect();
        if src_rows.is_empty() {
            continue;
        }
        let tgt_suffix = format!("v2:candlestick:{query_symbol}:{target}");
        let rows: Vec<_> = aggregate_candles(&src_rows, target_secs)
            .into_iter()
            .map(|row| {
                let ts = row[0] as i64;
                let member = candle_member_json(ts, &row);
                (tgt_suffix.clone(), ts as f64, member)
            })
            .collect();
        if let Err(e) = redis.zadd_upsert_many(&rows).await {
            tracing::warn!(%tgt_suffix, error = %e, "redis recent re-aggregation write failed");
        }
    }
}

async fn reaggregate_recent_extra_from_redis(
    state: &AppState,
    derived: &HashMap<(String, String), &'static str>,
    extra_query_symbols: &BTreeSet<String>,
) {
    let Some(redis) = &state.redis else {
        return;
    };
    for ((query_symbol, target), source) in derived {
        let Some(target_secs) = crate::sources::chainlink_candle::resolution_seconds(target) else {
            continue;
        };
        let (src_suffix, tgt_suffix) =
            candle_reaggregation_suffixes(query_symbol, source, target, extra_query_symbols);
        let members = redis
            .zrevrange(&src_suffix, 0, REAGGREGATE_SOURCE_RECENT - 1)
            .await
            .unwrap_or_default();
        let src_rows: Vec<[f64; 5]> = members.iter().filter_map(|m| parse_candle_row(m)).collect();
        if src_rows.is_empty() {
            continue;
        }
        let rows: Vec<_> = aggregate_candles(&src_rows, target_secs)
            .into_iter()
            .map(|row| {
                let ts = row[0] as i64;
                let member = candle_member_json(ts, &row);
                (tgt_suffix.clone(), ts as f64, member)
            })
            .collect();
        if let Err(e) = redis.zadd_upsert_many(&rows).await {
            tracing::warn!(%tgt_suffix, error = %e, "redis recent re-aggregation write failed");
        }
    }
}

/// Serialize a candle row as the wire `[ts,o,h,l,c]` JSON array. A tuple serializes to the same
/// array as `json!([...])` but without building an intermediate `serde_json::Value`.
pub(crate) fn candle_member_json(ts: i64, row: &[f64; 5]) -> String {
    serde_json::to_string(&(ts, row[1], row[2], row[3], row[4])).unwrap_or_default()
}

/// Retention window (seconds) per candle period.
fn candle_retention_secs(period: &str) -> Option<i64> {
    const DAY: i64 = 86_400;
    Some(match period {
        "1m" => DAY,
        "5m" => 5 * DAY,
        "15m" => 30 * DAY,
        "30m" => 30 * DAY,
        "1h" => 90 * DAY,
        "2h" => 180 * DAY,
        "4h" => 365 * DAY,
        "1d" => 365 * DAY,
        _ => return None,
    })
}

/// Mirror the assembled candle windows into Redis keyed by query symbol, trimming below retention, no-op without Redis.
fn candle_window_entries(
    candles: &HashMap<(String, String), Vec<[f64; 5]>>,
    extra_query_symbols: &BTreeSet<String>,
    now: i64,
) -> Vec<crate::redis_store::CandleWindowEntry> {
    candles
        .iter()
        .map(|((query_symbol, period), rows)| {
            let suffix = candle_redis_suffix_with_policy(
                query_symbol,
                period,
                extra_query_symbols.contains(query_symbol),
            );
            let members = rows
                .iter()
                .map(|row| {
                    let ts = row[0] as i64;
                    (ts as f64, candle_member_json(ts, row))
                })
                .collect();
            let trim = candle_retention_secs(period).map(|window| (now - window) as f64);
            (suffix, members, trim)
        })
        .collect()
}

async fn write_candles_to_redis(
    state: &AppState,
    candles: &HashMap<(String, String), Vec<[f64; 5]>>,
) {
    let Some(redis) = &state.redis else {
        return;
    };
    let now = time::OffsetDateTime::now_utc().unix_timestamp();
    // Build one (key, rows, trim_cutoff) entry per candlestick window, then write all in a single batched pass.
    let entries: Vec<crate::redis_store::CandleWindowEntry> = candles
        .iter()
        .map(|((query_symbol, period), rows)| {
            let suffix = format!("v2:candlestick:{query_symbol}:{period}");
            let members = rows
                .iter()
                .map(|row| {
                    let ts = row[0] as i64;
                    (ts as f64, candle_member_json(ts, row))
                })
                .collect();
            let trim = candle_retention_secs(period).map(|window| (now - window) as f64);
            (suffix, members, trim)
        })
        .collect();
    if let Err(e) = redis.write_candle_windows(&entries).await {
        tracing::warn!(error = %e, "redis candle bulk write failed");
    }
}

async fn write_extra_candles_to_redis(
    state: &AppState,
    candles: &HashMap<(String, String), Vec<[f64; 5]>>,
    extra_query_symbols: &BTreeSet<String>,
) {
    let Some(redis) = &state.redis else {
        return;
    };
    let now = time::OffsetDateTime::now_utc().unix_timestamp();
    let entries = candle_window_entries(candles, extra_query_symbols, now);
    if let Err(e) = redis.write_candle_windows(&entries).await {
        tracing::warn!(error = %e, "redis candle bulk write failed");
    }
}

/// Tips whose bucket has fully ENDED by `now` — closed candles stuck in the tip with no later tick to roll them over. PURE.
pub fn ended_tip_buckets(
    tips: &HashMap<(String, String), [f64; 5]>,
    now: i64,
) -> Vec<((String, String), [f64; 5])> {
    tips.iter()
        .filter_map(|(key, row)| {
            let secs = crate::sources::chainlink_candle::resolution_seconds(&key.1)?;
            // Flush once `now` is past bucket_ts + resolution.
            (now >= row[0] as i64 + secs).then(|| (key.clone(), *row))
        })
        .collect()
}

/// Persist any ENDED-bucket tips to Redis, snapshotting under the lock then writing outside it, no-op without Redis.
async fn flush_ended_tips(state: &AppState, now: i64) {
    let Some(redis) = &state.redis else {
        return;
    };
    let ended = {
        let Ok(tip) = state.candle_tip.lock() else {
            return;
        };
        ended_tip_buckets(&tip, now)
    };
    let rows: Vec<_> = ended
        .into_iter()
        .map(|((symbol, period), row)| {
            let suffix = format!("v2:candlestick:{symbol}:{period}");
            let ts = row[0] as i64;
            let member = serde_json::json!([ts, row[1], row[2], row[3], row[4]]).to_string();
            (suffix, ts as f64, member)
        })
        .collect();
    if let Err(e) = redis.zadd_upsert_many(&rows).await {
        tracing::warn!(error = %e, count = rows.len(), "redis ended-tip flush failed");
    }
}

/// Hydrate the in-memory [`CandleCache`] from Redis at startup so derivation can run from last-good even when a token's feed is frozen at boot; no-op without Redis.
pub async fn restore_candle_cache_from_redis(state: &AppState) {
    if state.config.extra_token_candles.enabled {
        return restore_extra_candle_cache_from_redis(state).await;
    }

    let Some(redis) = &state.redis else {
        return;
    };
    let plans = chainlink_prefetch_plans();
    let periods = crate::runtime::params().valid_periods.clone();
    let prefetch_limit = state.config.candle_prefetch_limit.max(1);
    let mut restored: HashMap<(String, String), Vec<[f64; 5]>> = HashMap::new();
    let queries: Vec<(String, isize, isize)> = plans
        .iter()
        .flat_map(|plan| {
            periods.iter().map(move |period| {
                (
                    format!("v2:candlestick:{}:{period}", plan.query_symbol),
                    0,
                    prefetch_limit as isize - 1,
                )
            })
        })
        .collect();
    let keys: Vec<(String, String)> = plans
        .iter()
        .flat_map(|plan| {
            periods
                .iter()
                .map(move |period| (plan.query_symbol.clone(), period.clone()))
        })
        .collect();
    let members_by_key = redis.zrevrange_many(&queries).await.unwrap_or_default();
    for (key, members) in keys.into_iter().zip(members_by_key) {
        let rows: Vec<[f64; 5]> = members.iter().filter_map(|m| parse_candle_row(m)).collect();
        if !rows.is_empty() {
            restored.insert(key, rows);
        }
    }
    if restored.is_empty() {
        tracing::info!("candle cache: nothing to restore from Redis at startup");
        return;
    }
    let windows = restored.len();
    state
        .candle_cache
        .store(Arc::new(CandleCache { candles: restored }));
    tracing::info!(windows, "candle cache: restored from Redis at startup");
}

#[cfg(test)]
static EXTRA_RESTORE_ENTRY_COUNT: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);

async fn restore_extra_candle_cache_from_redis(state: &AppState) {
    #[cfg(test)]
    EXTRA_RESTORE_ENTRY_COUNT.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

    let Some(redis) = &state.redis else {
        return;
    };
    let CandlePlanSet {
        plans,
        extra_query_symbols,
    } = history_candle_plan_set(&state.config);
    let periods = crate::runtime::params().valid_periods.clone();
    let mut restored: HashMap<(String, String), Vec<[f64; 5]>> = HashMap::new();
    let (queries, keys) = candle_restore_requests(
        &plans,
        &periods,
        &extra_query_symbols,
        state.config.candle_prefetch_limit,
    );
    let members_by_key = redis.zrevrange_many(&queries).await.unwrap_or_default();
    for (key, members) in keys.into_iter().zip(members_by_key) {
        let rows: Vec<[f64; 5]> = members.iter().filter_map(|m| parse_candle_row(m)).collect();
        if !rows.is_empty() {
            restored.insert(key, rows);
        }
    }
    if restored.is_empty() {
        tracing::info!("candle cache: nothing to restore from Redis at startup");
        return;
    }
    let windows = restored.len();
    state
        .candle_cache
        .store(Arc::new(CandleCache { candles: restored }));
    tracing::info!(windows, "candle cache: restored from Redis at startup");
}

/// The candle-prefetch loop: tick every `candle_prefetch_secs`, forever.
pub async fn run_candle_prefetch(state: AppState) {
    let secs = state.config.candle_prefetch_secs.max(1);
    let mut interval = crate::ticker::interval(secs);
    tracing::info!(
        candle_prefetch_secs = secs,
        periods = ?crate::runtime::params().direct_periods,
        "chainlink candle prefetch loop started"
    );
    // Seed the in-memory cache from Redis before the first tick so a feed frozen at boot can still derive its coarse periods from last-good.
    restore_candle_cache_from_redis(&state).await;
    loop {
        interval.tick().await;
        candle_prefetch_tick_once(&state).await;
        // Persist closed candles stuck in the tip of low-volume / closed markets.
        flush_ended_tips(&state, now_unix()).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

    #[derive(Clone, Default)]
    struct CandleStubCounts {
        history: Arc<AtomicUsize>,
        arbitrum: Arc<AtomicUsize>,
        price_candle: Arc<AtomicUsize>,
        price_candle_batch_sizes: Arc<std::sync::Mutex<Vec<usize>>>,
        history_has_rows: Arc<AtomicBool>,
        history_is_empty: Arc<AtomicBool>,
        history_errors: Arc<AtomicBool>,
        arbitrum_is_empty: Arc<AtomicBool>,
        arbitrum_errors: Arc<AtomicBool>,
        price_candle_is_empty: Arc<AtomicBool>,
    }

    async fn stub_history(
        axum::extract::State(counts): axum::extract::State<CandleStubCounts>,
    ) -> axum::response::Response {
        use axum::response::IntoResponse;

        counts.history.fetch_add(1, Ordering::SeqCst);
        if counts.history_errors.load(Ordering::SeqCst) {
            return axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        if counts.history_is_empty.load(Ordering::SeqCst) {
            return axum::body::Body::empty().into_response();
        }
        if counts.history_has_rows.load(Ordering::SeqCst) {
            axum::Json(serde_json::json!({
                "candles": [[
                    1_700_000_000,
                    "1000000000000000000",
                    "1100000000000000000",
                    "900000000000000000",
                    "1050000000000000000"
                ]]
            }))
            .into_response()
        } else {
            axum::http::StatusCode::NOT_FOUND.into_response()
        }
    }

    async fn stub_arbitrum_candles(
        axum::extract::State(counts): axum::extract::State<CandleStubCounts>,
    ) -> axum::response::Response {
        use axum::response::IntoResponse;

        counts.arbitrum.fetch_add(1, Ordering::SeqCst);
        if counts.arbitrum_errors.load(Ordering::SeqCst) {
            return axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        if counts.arbitrum_is_empty.load(Ordering::SeqCst) {
            return axum::Json(serde_json::json!({ "candles": [] })).into_response();
        }
        axum::Json(serde_json::json!({
            "candles": [[1_700_000_000.0, 1.0, 1.1, 0.9, 1.05]]
        }))
        .into_response()
    }

    async fn stub_price_candles(
        axum::extract::State(counts): axum::extract::State<CandleStubCounts>,
        axum::Json(request): axum::Json<serde_json::Value>,
    ) -> axum::Json<serde_json::Value> {
        counts.price_candle.fetch_add(1, Ordering::SeqCst);
        let candles = if counts.price_candle_is_empty.load(Ordering::SeqCst) {
            serde_json::json!([])
        } else {
            serde_json::json!([{
                "timestamp": 1_700_000_000,
                "open": "1000000000000000000",
                "high": "1250000000000000000",
                "low": "950000000000000000",
                "close": "1200000000000000000"
            }])
        };
        let is_batch = request
            .get("query")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|query| query.contains("candlesBatch"));
        if is_batch {
            let tokens = request
                .pointer("/variables/indexTokens")
                .and_then(serde_json::Value::as_array)
                .cloned()
                .unwrap_or_default();
            counts
                .price_candle_batch_sizes
                .lock()
                .unwrap()
                .push(tokens.len());
            let candles = tokens
                .into_iter()
                .filter_map(|token| token.as_str().map(str::to_owned))
                .flat_map(|token| {
                    candles
                        .as_array()
                        .into_iter()
                        .flatten()
                        .cloned()
                        .map(move |mut candle| {
                            candle["indexToken"] = serde_json::Value::String(token.clone());
                            candle
                        })
                })
                .collect::<Vec<_>>();
            axum::Json(serde_json::json!({ "data": { "candlesBatch": candles } }))
        } else {
            axum::Json(serde_json::json!({ "data": { "candles": candles } }))
        }
    }

    async fn spawn_candle_source_stub() -> (String, CandleStubCounts, tokio::task::JoinHandle<()>) {
        let counts = CandleStubCounts::default();
        let app = axum::Router::new()
            .route("/history", axum::routing::get(stub_history))
            .route("/arb", axum::routing::get(stub_arbitrum_candles))
            .route("/price", axum::routing::post(stub_price_candles))
            .with_state(counts.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let handle = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (base, counts, handle)
    }

    fn test_candle_clients(
        base: &str,
    ) -> (
        crate::sources::chainlink_candle::ChainlinkCandleClient,
        crate::sources::arbitrum_tickers::ArbitrumTickerClient,
        gmsol_price_candle_client::PriceCandleService,
    ) {
        let chainlink = crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
            crate::sources::chainlink_candle::ChainlinkCandleConfig {
                auth_url: format!("{base}/auth"),
                history_url: format!("{base}/history"),
                streaming_url: format!("{base}/stream"),
                timeout_ms: 1_000,
            },
            false,
        )
        .unwrap();
        let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
            crate::sources::arbitrum_tickers::ArbitrumConfig {
                tickers_url: format!("{base}/tickers"),
                candles_url: format!("{base}/arb"),
                timeout_ms: 1_000,
            },
        )
        .unwrap();
        let price_candle =
            gmsol_price_candle_client::PriceCandleService::new(gmsol_price_candle_client::Config {
                endpoint: format!("{base}/price"),
                timeout_ms: 1_000,
            })
            .unwrap();
        (chainlink, arbitrum, price_candle)
    }

    fn test_direct_candle_task() -> DirectCandleFetchTask {
        DirectCandleFetchTask {
            symbol: "USDC".to_string(),
            period: "1h".to_string(),
            digits: 4,
            from: 1_699_000_000,
            to: 1_700_000_000,
            arbitrum_symbol: Some("USDC".to_string()),
            index_token: "FakeUsdcMint".to_string(),
            is_extra: true,
            prefetch_limit: 1_000,
        }
    }

    #[test]
    fn candle_member_json_matches_json_macro_wire_format() {
        // The tuple serializer must be byte-identical to the old `json!([...])` form (prod reads these).
        let cases: [(i64, [f64; 5]); 3] = [
            (1_700_000_000, [1_700_000_000.0, 1.5, 2.25, 0.0, 3.333333]),
            (0, [0.0, 10.0, 12.0, 5.0, 15.0]),
            (
                1_741_478_400,
                [1_741_478_400.0, 0.000_001, 99_999.99, -1.0, 42.0],
            ),
        ];
        for (ts, row) in cases {
            let old = serde_json::json!([ts, row[1], row[2], row[3], row[4]]).to_string();
            assert_eq!(candle_member_json(ts, &row), old);
        }
    }

    #[test]
    fn aggregate_15m_from_5m_multiple_buckets_newest_first() {
        // Bucket A aligned 0 (ts 0,300,600), bucket B aligned 900 (ts 900,1200), newest-first.
        let rows = vec![
            [1200.0, 50.0, 55.0, 49.0, 52.0], // B newest (close)
            [900.0, 40.0, 60.0, 38.0, 45.0],  // B oldest (open), high 60
            [600.0, 30.0, 35.0, 28.0, 31.0],  // A newest (close)
            [300.0, 20.0, 40.0, 18.0, 25.0],  // A
            [0.0, 10.0, 12.0, 5.0, 15.0],     // A oldest (open), low 5
        ];
        let out = aggregate_candles(&rows, 900);
        assert_eq!(out.len(), 2);
        // newest-first: bucket B (900) first, then A (0).
        assert_eq!(out[0][0], 900.0);
        assert_eq!(out[0][1], 40.0); // open = ts 900
        assert_eq!(out[0][2], 60.0); // high
        assert_eq!(out[0][3], 38.0); // low
        assert_eq!(out[0][4], 52.0); // close = ts 1200
        assert_eq!(out[1][0], 0.0);
        assert_eq!(out[1][1], 10.0); // open = ts 0
        assert_eq!(out[1][2], 40.0); // high
        assert_eq!(out[1][3], 5.0); // low
        assert_eq!(out[1][4], 31.0); // close = ts 600
    }

    #[test]
    fn aggregate_drops_leading_bucket_when_oldest_unaligned() {
        // Oldest candle ts 300 is unaligned, so bucket A is dropped; bucket B (ts 900, aligned) is kept.
        let rows = vec![
            [900.0, 40.0, 60.0, 38.0, 45.0], // B (aligned start)
            [600.0, 30.0, 35.0, 28.0, 31.0], // A
            [300.0, 20.0, 40.0, 18.0, 25.0], // A oldest, ts 300 unaligned -> drop A
        ];
        let out = aggregate_candles(&rows, 900);
        // Only bucket B survives; bucket A (with ts 600 + 300) is fully dropped.
        assert_eq!(out.len(), 1);
        assert_eq!(out[0][0], 900.0);
        assert_eq!(out[0][1], 40.0); // open
        assert_eq!(out[0][4], 45.0); // close
    }

    /// Eight hourly candles, newest-first, h0..h7 at ts h*3600.
    fn hourly_8() -> Vec<[f64; 5]> {
        (0..8)
            .rev()
            .map(|h| {
                let ts = (h as f64) * 3600.0;
                [
                    ts,
                    100.0 + h as f64,
                    200.0 + h as f64,
                    h as f64,
                    150.0 + h as f64,
                ]
            })
            .collect()
    }

    #[test]
    fn derive_cascade_falls_through_to_finer_source() {
        // 2h is empty (the Data Engine lacked it, e.g. SPCX) -> cascade to 1h.
        let mut w: std::collections::HashMap<(String, String), Vec<[f64; 5]>> =
            std::collections::HashMap::new();
        w.insert(("X".into(), "2h".into()), Vec::new());
        w.insert(("X".into(), "1h".into()), hourly_8());

        let sources = ["2h", "1h", "30m", "5m", "1m"];
        let (rows, source) = derive_cascade(&w, "X", &sources, 14400).expect("derives from 1h");
        assert_eq!(source, "1h", "empty 2h cascades to 1h");
        // 8 hourly candles -> two aligned 4h buckets, newest-first.
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0][0], 14400.0);
        assert_eq!(rows[1][0], 0.0);
    }

    #[test]
    fn derive_cascade_prefers_coarsest_available_source() {
        let mut w: std::collections::HashMap<(String, String), Vec<[f64; 5]>> =
            std::collections::HashMap::new();
        // newest-first (aggregate_candles requires it): ts 7200 then 0, both align to bucket 0.
        w.insert(
            ("X".into(), "2h".into()),
            vec![[7200.0, 2.0, 3.0, 1.5, 2.5], [0.0, 1.0, 2.0, 0.5, 1.5]],
        );
        w.insert(("X".into(), "1h".into()), hourly_8());
        let (_, source) = derive_cascade(&w, "X", &["2h", "1h", "1m"], 14400).expect("derives");
        assert_eq!(source, "2h", "coarsest available source wins");
    }

    #[test]
    fn derive_cascade_none_when_no_source_has_data() {
        let w: std::collections::HashMap<(String, String), Vec<[f64; 5]>> =
            std::collections::HashMap::new();
        assert!(derive_cascade(&w, "X", &["2h", "1h"], 14400).is_none());
    }

    fn gen_candles(n: usize, interval: i64) -> Vec<[f64; 5]> {
        (0..n)
            .rev()
            .map(|i| [(i as i64 * interval) as f64, 100.0, 110.0, 90.0, 105.0])
            .collect()
    }

    #[test]
    fn full_derivation_loop_fills_30m_2h_4h_from_finer_direct_periods() {
        // SPCX-shape: Data Engine has 1m/5m/1h/1d but NOT 30m/2h; 15m/30m/2h/4h must derive.
        let mut next: std::collections::HashMap<(String, String), Vec<[f64; 5]>> =
            std::collections::HashMap::new();
        next.insert(("SPCX".into(), "5m".into()), gen_candles(200, 300));
        next.insert(("SPCX".into(), "1h".into()), gen_candles(100, 3600));
        let prev: std::collections::HashMap<(String, String), Vec<[f64; 5]>> =
            std::collections::HashMap::new();
        let fresh_direct: BTreeSet<(String, String)> = next.keys().cloned().collect();

        // Exact replica of the candle_prefetch_tick_once derivation loop.
        for qsym in ["SPCX"] {
            for (target, sources) in AGGREGATIONS {
                let target_key = (qsym.to_string(), target.to_string());
                if fresh_direct.contains(&target_key) {
                    continue;
                }
                let Some(target_secs) =
                    crate::sources::chainlink_candle::resolution_seconds(target)
                else {
                    continue;
                };
                let Some((agg, _src)) = derive_cascade(&next, qsym, sources, target_secs) else {
                    continue;
                };
                if let Some(window) = merge_keep_previous_window(prev.get(&target_key), agg) {
                    next.insert(target_key, window);
                }
            }
        }

        for p in ["15m", "30m", "2h", "4h"] {
            let w = next.get(&("SPCX".to_string(), p.to_string()));
            assert!(
                w.is_some_and(|w| !w.is_empty()),
                "{p} should have been derived"
            );
        }
    }

    #[test]
    fn stale_direct_window_does_not_block_fresh_finer_fallback() {
        let stale_2h = vec![[0.0, 1.0, 1.0, 1.0, 1.0]];
        let mut prev = CandleCache::default();
        prev.candles
            .insert(("X".into(), "2h".into()), stale_2h.clone());

        let results = vec![
            (("X".into(), "2h".into()), Vec::new()),
            (("X".into(), "1h".into()), hourly_8()),
        ];
        let fresh_direct: BTreeSet<(String, String)> = results
            .iter()
            .filter(|(_, fetched)| !fetched.is_empty())
            .map(|(key, _)| key.clone())
            .collect();
        let mut next = assemble_direct_windows(&prev, results);

        for (target, sources) in AGGREGATIONS {
            let target_key = ("X".to_string(), target.to_string());
            if fresh_direct.contains(&target_key) {
                continue;
            }
            let target_secs = crate::sources::chainlink_candle::resolution_seconds(target).unwrap();
            if let Some((agg, _)) = derive_cascade(&next, "X", sources, target_secs) {
                next.insert(target_key, agg);
            }
        }

        let two_hour = next.get(&("X".into(), "2h".into())).unwrap();
        assert_ne!(two_hour, &stale_2h);
        assert_eq!(two_hour.len(), 4);
        assert_eq!(next.get(&("X".into(), "4h".into())).unwrap().len(), 2);
    }

    #[test]
    fn parse_candle_row_reads_integer_ts_and_float_ohlc() {
        // The exact member format written to Redis (ts integer, OHLC floats).
        let row = parse_candle_row("[1780992000,66.0,67.5,65.2,66.8]").unwrap();
        assert_eq!(row, [1_780_992_000.0, 66.0, 67.5, 65.2, 66.8]);
        // Wrong arity -> None (defends the re-aggregation against malformed members).
        assert!(parse_candle_row("[1,2,3]").is_none());
        // Non-JSON -> None.
        assert!(parse_candle_row("not json").is_none());
    }

    #[test]
    fn ended_tip_buckets_flushes_only_closed() {
        let mut tips = HashMap::new();
        // 1h bucket starting at 3600 ends at 7200; at now=7200 it has CLOSED -> flush.
        tips.insert(
            ("SOL".to_string(), "1h".to_string()),
            [3600.0, 1.0, 2.0, 0.5, 1.5],
        );
        // 1h bucket starting at 7200 ends at 10800; at now=7200 it is FORMING -> skip.
        tips.insert(
            ("BTC".to_string(), "1h".to_string()),
            [7200.0, 1.0, 2.0, 0.5, 1.5],
        );
        let out = ended_tip_buckets(&tips, 7200);
        assert_eq!(out.len(), 1, "only the closed bucket is flushed");
        assert_eq!(out[0].0, ("SOL".to_string(), "1h".to_string()));
    }

    #[test]
    fn price_candle_rows_scale_by_1e18_and_sort_newest_first() {
        let pc = |ts: i64, o: &str, h: &str, l: &str, c: &str| PriceCandle {
            timestamp: ts,
            open: o.to_string(),
            high: h.to_string(),
            low: l.to_string(),
            close: c.to_string(),
        };
        // Input ascending; output must be newest-first, OHLC divided by 1e18.
        let rows = vec![
            pc(
                1000,
                "70000000000000000000",
                "71000000000000000000",
                "69000000000000000000",
                "70500000000000000000",
            ),
            pc(
                2000,
                "70500000000000000000",
                "72000000000000000000",
                "70000000000000000000",
                "71500000000000000000",
            ),
        ];
        let out = price_candle_rows_to_ohlc(&rows);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0][0], 2000.0, "newest-first");
        assert_eq!(out[0][1], 70.5);
        assert_eq!(out[0][4], 71.5);
        assert_eq!(out[1][0], 1000.0);
        assert_eq!(out[1][1], 70.0);

        // Malformed OHLC drops the row.
        let bad = vec![pc(3000, "not-a-number", "1", "1", "1")];
        assert!(price_candle_rows_to_ohlc(&bad).is_empty());
    }

    #[test]
    fn merge_keeps_previous_on_empty_fetch() {
        let prev = vec![[1.0, 2.0, 3.0, 4.0, 5.0]];
        let kept = merge_keep_previous_window(Some(&prev), Vec::new());
        assert_eq!(kept, Some(prev));
    }

    #[test]
    fn price_candle_batch_row_limit_uses_service_estimate() {
        let estimated = price_candle_batch_estimated_rows(3, 60, 0, 600);
        assert_eq!(estimated, 30);
        assert_eq!(
            price_candle_batch_exceeds_limit(3, 60, 0, 600, 29),
            Some(30)
        );
        assert_eq!(price_candle_batch_exceeds_limit(3, 60, 0, 600, 30), None);
        assert_eq!(price_candle_batch_exceeds_limit(3, 60, 0, 600, 0), None);
    }

    #[test]
    fn price_candle_batch_chunk_size_honors_target_and_hard_limit() {
        assert_eq!(
            price_candle_batch_chunk_size(70, 60, 0, 60_000, 10_000, 100_000),
            10
        );
        assert_eq!(
            price_candle_batch_chunk_size(70, 60, 0, 60_000, 0, 30_000),
            30
        );
        assert_eq!(price_candle_batch_chunk_size(70, 60, 0, 60_000, 0, 0), 70);
        assert_eq!(
            price_candle_batch_chunk_size(3, 60, 0, 60_000, 1, 100_000),
            1
        );
        assert_eq!(
            price_candle_batch_chunk_size(0, 60, 0, 60_000, 10_000, 100_000),
            0
        );
    }

    #[test]
    fn chainlink_prefetch_plans_cover_all_displayable_tokens() {
        let plans = chainlink_prefetch_plans();
        assert!(!plans.is_empty());
        // SHIB is a USD-based token -> "SHIBUSD".
        assert!(plans.iter().any(|p| p.query_symbol == "SHIBUSD"));
        // USDJPY is a non-USD-based FX pair -> "USDJPY" (no suffix).
        assert!(plans.iter().any(|p| p.query_symbol == "USDJPY"));
        // SOL is now prefetched too since Chainlink is the sole candle source -> "SOLUSD".
        assert!(plans.iter().any(|p| p.query_symbol == "SOLUSD"));
        // Non-displayable collateral (view_flg=false, e.g. WSOL) is excluded.
        assert!(!plans.iter().any(|p| p.query_symbol == "WSOLUSD"));
    }

    fn fake_row(symbol: &str, mint: &str, data_source: DataSource, view_flg: bool) -> TokenRow {
        TokenRow {
            symbol: Box::leak(symbol.to_string().into_boxed_str()),
            name: Box::leak(symbol.to_string().into_boxed_str()),
            is_synthetic: false,
            data_source,
            view_flg,
            is_usd_based: true,
            decimals: 6,
            decimals_gmx: 6,
            index_token_address: Box::leak(mint.to_string().into_boxed_str()),
            wrapped_address: "",
        }
    }

    fn config_with_extra(enabled: bool, symbols: &[&str]) -> Config {
        Config::from_figment(figment::Figment::new().merge(
            figment::providers::Serialized::defaults(serde_json::json!({
                "extra_token_candles": {
                    "enabled": enabled,
                    "symbols": symbols,
                }
            })),
        ))
        .unwrap()
    }

    #[test]
    fn extra_resolver_canonicalizes_deduplicates_and_uses_row_identity() {
        let rows = [fake_row("USDC", "FakeUsdcMint", DataSource::Gmx, false)];
        let config = ExtraTokenCandlesConfig {
            enabled: true,
            symbols: vec![" usdc ".into(), "USDC".into()],
        };
        let resolution = resolve_extra_candle_plans_from_rows(&config, &rows, false);
        assert_eq!(resolution.configured_count, 1);
        assert!(resolution.issues.is_empty());
        assert_eq!(resolution.plans.len(), 1);
        assert_eq!(resolution.plans[0].query_symbol, "USDC");
        assert_eq!(resolution.plans[0].index_token, "FakeUsdcMint");
        assert_eq!(resolution.plans[0].digits, 4);
        assert_eq!(resolution.plans[0].arbitrum_symbol.as_deref(), Some("USDC"));
        assert_eq!(
            resolution.resolved,
            [ResolvedExtraCandle {
                canonical_symbol: "USDC".to_string(),
                data_source: DataSource::Gmx,
                query_symbol: "USDC".to_string(),
                has_arbitrum_fallback: true,
            }]
        );
        assert!(!resolution.is_degraded());
    }

    #[test]
    fn extra_resolver_rejects_unknown_ambiguous_and_invalid_source() {
        let rows = [
            fake_row("USDC", "FakeMintA", DataSource::Gmx, false),
            fake_row("usdc", "FakeMintB", DataSource::Gmx, false),
            fake_row("EURC", "FakeMintC", DataSource::Chainlink, false),
        ];
        let config = ExtraTokenCandlesConfig {
            enabled: true,
            symbols: vec!["USDC".into(), "EURC".into(), "MISSING".into()],
        };
        let resolution = resolve_extra_candle_plans_from_rows(&config, &rows, false);
        assert!(resolution.plans.is_empty());
        assert!(resolution
            .issues
            .iter()
            .any(|issue| issue.symbol == "USDC" && issue.reason == "ambiguous_symbol"));
        assert!(resolution
            .issues
            .iter()
            .any(|issue| issue.symbol == "EURC" && issue.reason == "invalid_source_policy"));
        assert!(resolution
            .issues
            .iter()
            .any(|issue| issue.symbol == "MISSING" && issue.reason == "unknown_symbol"));
    }

    #[test]
    fn extra_resolver_allows_non_gmx_rows_in_price_candle_only_mode() {
        let rows = [fake_row(
            "EURC",
            "FakeEurcMint",
            DataSource::Chainlink,
            false,
        )];
        let config = ExtraTokenCandlesConfig {
            enabled: true,
            symbols: vec!["EURC".into()],
        };

        let resolution = resolve_extra_candle_plans_from_rows(&config, &rows, true);

        assert!(resolution.issues.is_empty());
        assert_eq!(resolution.plans.len(), 1);
        assert_eq!(resolution.plans[0].index_token, "FakeEurcMint");
        assert!(resolution.plans[0].arbitrum_symbol.is_none());
    }

    #[test]
    fn enabled_empty_extra_config_resolves_to_degraded_empty_universe() {
        let resolution = resolve_extra_candle_plans_from_rows(
            &ExtraTokenCandlesConfig {
                enabled: true,
                symbols: Vec::new(),
            },
            &[],
            false,
        );

        assert_eq!(resolution.configured_count, 0);
        assert!(resolution.plans.is_empty());
        assert!(resolution.issues.is_empty());
        assert!(resolution.is_degraded());
    }

    #[test]
    fn partial_extra_resolution_is_degraded_even_with_a_valid_plan() {
        let rows = [fake_row("USDC", "FakeUsdcMint", DataSource::Gmx, false)];
        let config = ExtraTokenCandlesConfig {
            enabled: true,
            symbols: vec!["USDC".into(), "MISSING".into()],
        };

        let resolution = resolve_extra_candle_plans_from_rows(&config, &rows, false);

        assert_eq!(resolution.plans.len(), 1);
        assert_eq!(resolution.issues.len(), 1);
        assert!(resolution.is_degraded());
    }

    #[test]
    fn extra_resolver_rejects_displayable_and_extra_query_collisions() {
        let rows = [
            fake_row("DISPLAY", "FakeDisplay", DataSource::Gmx, true),
            fake_row("COLLIDES", "FakeCollision", DataSource::Gmx, false),
            fake_row("EXTRA_A", "FakeExtraA", DataSource::Gmx, false),
            fake_row("EXTRA_B", "FakeExtraB", DataSource::Gmx, false),
        ];
        let config = ExtraTokenCandlesConfig {
            enabled: true,
            symbols: vec!["COLLIDES".into(), "EXTRA_A".into(), "EXTRA_B".into()],
        };
        let resolution =
            resolve_extra_candle_plans_with_query_symbol(&config, &rows, false, |symbol| {
                match symbol {
                    "DISPLAY" | "COLLIDES" => "DISPLAY_QUERY".to_string(),
                    "EXTRA_A" | "EXTRA_B" => "EXTRA_QUERY".to_string(),
                    _ => symbol.to_string(),
                }
            });
        assert!(resolution.plans.is_empty());
        assert!(resolution.issues.iter().any(|issue| {
            issue.symbol == "COLLIDES" && issue.reason == "displayable_query_collision"
        }));
        assert_eq!(
            resolution
                .issues
                .iter()
                .filter(|issue| issue.reason == "extra_query_collision")
                .count(),
            2
        );
    }

    #[test]
    fn history_plans_and_redis_policy_follow_runtime_switch() {
        let disabled = config_with_extra(false, &["USDC"]);
        let disabled_plans = history_candle_plan_set(&disabled);
        assert!(!disabled_plans
            .plans
            .iter()
            .any(|plan| plan.query_symbol == "USDC"));
        assert_eq!(
            candle_redis_suffix(&disabled, "USDC", "1h"),
            "v2:candlestick:USDC:1h"
        );

        let enabled = config_with_extra(true, &["USDC"]);
        let enabled_plans = history_candle_plan_set(&enabled);
        assert!(enabled_plans
            .plans
            .iter()
            .any(|plan| plan.query_symbol == "USDC"));
        assert!(enabled_plans.extra_query_symbols.contains("USDC"));
        assert_eq!(
            candle_redis_suffix(&enabled, "USDC", "1h"),
            "v2:extra-candlestick:USDC:1h"
        );
    }

    #[test]
    fn extra_redis_policy_is_shared_by_write_restore_read_and_reaggregation() {
        let config = config_with_extra(true, &["USDC"]);
        let CandlePlanSet {
            plans,
            extra_query_symbols,
        } = history_candle_plan_set(&config);
        let periods = vec!["1h".to_string(), "4h".to_string()];
        let (restore_queries, restore_keys) =
            candle_restore_requests(&plans, &periods, &extra_query_symbols, 1_000);
        assert!(restore_queries
            .iter()
            .any(|(suffix, _, _)| suffix == "v2:extra-candlestick:USDC:1h"));
        assert!(restore_keys.contains(&("USDC".to_string(), "1h".to_string())));

        let candles = HashMap::from([
            (
                ("USDC".to_string(), "1h".to_string()),
                vec![[1_700_000_000.0, 1.0, 1.01, 0.99, 1.0]],
            ),
            (
                ("SOLUSD".to_string(), "1h".to_string()),
                vec![[1_700_000_000.0, 10.0, 11.0, 9.0, 10.5]],
            ),
        ]);
        let entries = candle_window_entries(&candles, &extra_query_symbols, 1_700_000_100);
        assert!(entries
            .iter()
            .any(|(suffix, _, _)| suffix == "v2:extra-candlestick:USDC:1h"));
        assert!(entries
            .iter()
            .any(|(suffix, _, _)| suffix == "v2:candlestick:SOLUSD:1h"));

        let (source, target) =
            candle_reaggregation_suffixes("USDC", "1h", "4h", &extra_query_symbols);
        assert_eq!(source, "v2:extra-candlestick:USDC:1h");
        assert_eq!(target, "v2:extra-candlestick:USDC:4h");
        assert_eq!(
            candle_redis_suffix(&config, "USDC", "4h"),
            "v2:extra-candlestick:USDC:4h"
        );
    }

    #[test]
    fn runtime_disable_removes_extra_history_from_restore_and_memory_universe() {
        let disabled = config_with_extra(false, &["USDC"]);
        let CandlePlanSet {
            plans,
            extra_query_symbols,
        } = history_candle_plan_set(&disabled);
        let periods = vec!["1h".to_string()];
        let (queries, keys) =
            candle_restore_requests(&plans, &periods, &extra_query_symbols, 1_000);

        assert!(extra_query_symbols.is_empty());
        assert!(!queries
            .iter()
            .any(|(suffix, _, _)| suffix.contains("extra-candlestick")));
        assert!(!keys.iter().any(|(symbol, _)| symbol == "USDC"));
        assert!(!plans.iter().any(|plan| plan.query_symbol == "USDC"));
    }

    #[tokio::test]
    async fn production_entries_route_before_extra_prefetch_and_restore() {
        EXTRA_PREFETCH_ENTRY_COUNT.store(0, Ordering::SeqCst);
        EXTRA_RESTORE_ENTRY_COUNT.store(0, Ordering::SeqCst);

        let disabled = crate::state::extra_candle_test_state(config_with_extra(false, &[]));
        let preserved_key = ("SOLUSD".to_string(), "1h".to_string());
        let preserved_rows = vec![[1_700_000_000.0, 10.0, 11.0, 9.0, 10.5]];
        disabled.candle_cache.store(Arc::new(CandleCache {
            candles: HashMap::from([(preserved_key.clone(), preserved_rows.clone())]),
        }));

        candle_prefetch_tick_once(&disabled).await;
        restore_candle_cache_from_redis(&disabled).await;

        assert_eq!(EXTRA_PREFETCH_ENTRY_COUNT.load(Ordering::SeqCst), 0);
        assert_eq!(EXTRA_RESTORE_ENTRY_COUNT.load(Ordering::SeqCst), 0);
        assert_eq!(
            disabled.candle_cache.load().candles.get(&preserved_key),
            Some(&preserved_rows)
        );

        let enabled = crate::state::extra_candle_test_state(config_with_extra(true, &[]));
        candle_prefetch_tick_once(&enabled).await;
        restore_candle_cache_from_redis(&enabled).await;

        assert_eq!(EXTRA_PREFETCH_ENTRY_COUNT.load(Ordering::SeqCst), 1);
        assert_eq!(EXTRA_RESTORE_ENTRY_COUNT.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn direct_source_dispatch_covers_standard_auth_missing_and_price_only_modes() {
        let (base, counts, handle) = spawn_candle_source_stub().await;
        let (chainlink, arbitrum, price_candle) = test_candle_clients(&base);
        let task = test_direct_candle_task();

        counts.history_has_rows.store(true, Ordering::SeqCst);
        let data_engine_rows =
            DirectCandleFetcher::standard(&chainlink, &arbitrum, &price_candle, Some("test-token"))
                .fetch(&task)
                .await;
        assert_eq!(data_engine_rows[0][4], 1.05);
        assert_eq!(counts.history.load(Ordering::SeqCst), 1);
        assert_eq!(counts.arbitrum.load(Ordering::SeqCst), 0);
        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 0);

        counts.history_has_rows.store(false, Ordering::SeqCst);
        counts.history.store(0, Ordering::SeqCst);
        let arbitrum_fallback =
            DirectCandleFetcher::standard(&chainlink, &arbitrum, &price_candle, Some("test-token"))
                .fetch(&task)
                .await;
        assert_eq!(arbitrum_fallback[0][4], 1.05);
        assert_eq!(counts.history.load(Ordering::SeqCst), 1);
        assert_eq!(counts.arbitrum.load(Ordering::SeqCst), 1);
        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 0);

        counts.history.store(0, Ordering::SeqCst);
        counts.arbitrum.store(0, Ordering::SeqCst);
        counts.arbitrum_is_empty.store(true, Ordering::SeqCst);
        let price_candle_fallback =
            DirectCandleFetcher::standard(&chainlink, &arbitrum, &price_candle, Some("test-token"))
                .fetch(&task)
                .await;
        assert_eq!(price_candle_fallback[0][4], 1.2);
        assert_eq!(counts.history.load(Ordering::SeqCst), 1);
        assert_eq!(counts.arbitrum.load(Ordering::SeqCst), 1);
        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 1);

        counts.history.store(0, Ordering::SeqCst);
        counts.arbitrum.store(0, Ordering::SeqCst);
        counts.price_candle.store(0, Ordering::SeqCst);
        counts.price_candle_is_empty.store(true, Ordering::SeqCst);
        let all_empty =
            DirectCandleFetcher::standard(&chainlink, &arbitrum, &price_candle, Some("test-token"))
                .fetch(&task)
                .await;
        assert!(all_empty.is_empty());
        assert_eq!(counts.history.load(Ordering::SeqCst), 1);
        assert_eq!(counts.arbitrum.load(Ordering::SeqCst), 1);
        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 1);

        counts.history.store(0, Ordering::SeqCst);
        counts.arbitrum.store(0, Ordering::SeqCst);
        counts.price_candle.store(0, Ordering::SeqCst);
        counts.arbitrum_is_empty.store(false, Ordering::SeqCst);
        counts.price_candle_is_empty.store(false, Ordering::SeqCst);
        let auth_missing_extra =
            DirectCandleFetcher::standard(&chainlink, &arbitrum, &price_candle, None)
                .fetch(&task)
                .await;
        assert_eq!(auth_missing_extra.len(), 1);
        assert_eq!(counts.history.load(Ordering::SeqCst), 0);
        assert_eq!(counts.arbitrum.load(Ordering::SeqCst), 1);
        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 0);

        counts.arbitrum.store(0, Ordering::SeqCst);
        let displayable_task = DirectCandleFetchTask {
            symbol: "SOLUSD".to_string(),
            digits: 7,
            arbitrum_symbol: Some("SOL".to_string()),
            index_token: "FakeSolMint".to_string(),
            is_extra: false,
            ..task.clone()
        };
        let auth_missing_displayable =
            DirectCandleFetcher::standard(&chainlink, &arbitrum, &price_candle, None)
                .fetch(&displayable_task)
                .await;
        assert!(auth_missing_displayable.is_empty());
        assert_eq!(counts.history.load(Ordering::SeqCst), 0);
        assert_eq!(counts.arbitrum.load(Ordering::SeqCst), 0);
        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 0);

        let price_only_rows = vec![[1_700_000_000.0, 2.0, 2.1, 1.9, 2.05]];
        let price_batch = HashMap::from([(
            ("FakeUsdcMint".to_string(), "1h".to_string()),
            price_only_rows.clone(),
        )]);
        let price_only = DirectCandleFetcher::price_candle_only(
            &chainlink,
            &arbitrum,
            &price_candle,
            Some(&price_batch),
        )
        .fetch(&task)
        .await;
        assert_eq!(price_only, price_only_rows);
        assert_eq!(counts.history.load(Ordering::SeqCst), 0);
        assert_eq!(counts.arbitrum.load(Ordering::SeqCst), 0);
        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 0);
        handle.abort();
    }

    #[tokio::test]
    async fn source_dispatch_falls_back_after_data_engine_and_arbitrum_errors() {
        let (base, counts, handle) = spawn_candle_source_stub().await;
        let (chainlink, arbitrum, price_candle) = test_candle_clients(&base);
        let task = test_direct_candle_task();

        counts.history_is_empty.store(true, Ordering::SeqCst);
        let after_empty_body =
            DirectCandleFetcher::standard(&chainlink, &arbitrum, &price_candle, Some("test-token"))
                .fetch(&task)
                .await;
        assert_eq!(after_empty_body[0][4], 1.05);
        assert_eq!(counts.history.load(Ordering::SeqCst), 1);
        assert_eq!(counts.arbitrum.load(Ordering::SeqCst), 1);

        counts.history.store(0, Ordering::SeqCst);
        counts.arbitrum.store(0, Ordering::SeqCst);
        counts.history_is_empty.store(false, Ordering::SeqCst);
        counts.history_errors.store(true, Ordering::SeqCst);
        let after_data_engine_error =
            DirectCandleFetcher::standard(&chainlink, &arbitrum, &price_candle, Some("test-token"))
                .fetch(&task)
                .await;
        assert_eq!(after_data_engine_error[0][4], 1.05);
        assert_eq!(counts.history.load(Ordering::SeqCst), 1);
        assert_eq!(counts.arbitrum.load(Ordering::SeqCst), 1);

        counts.history.store(0, Ordering::SeqCst);
        counts.arbitrum.store(0, Ordering::SeqCst);
        counts.price_candle.store(0, Ordering::SeqCst);
        counts.history_errors.store(false, Ordering::SeqCst);
        counts.arbitrum_errors.store(true, Ordering::SeqCst);
        let after_arbitrum_error =
            DirectCandleFetcher::standard(&chainlink, &arbitrum, &price_candle, Some("test-token"))
                .fetch(&task)
                .await;
        assert_eq!(after_arbitrum_error[0][4], 1.2);
        assert_eq!(counts.history.load(Ordering::SeqCst), 1);
        assert_eq!(counts.arbitrum.load(Ordering::SeqCst), 1);
        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 1);
        handle.abort();
    }

    #[tokio::test]
    async fn price_only_batch_prefetch_uses_the_actual_batch_endpoint() {
        let (base, counts, handle) = spawn_candle_source_stub().await;
        let (_, _, price_candle) = test_candle_clients(&base);
        let plans = vec![PrefetchPlan {
            query_symbol: "USDC".to_string(),
            digits: 4,
            arbitrum_symbol: Some("USDC".to_string()),
            index_token: "FakeUsdcMint".to_string(),
        }];

        let batch = batch_prefetch_price_candle_for_periods(
            &price_candle,
            &plans,
            &["1h".to_string()],
            1_700_000_000,
            PriceCandleBatchPrefetchOptions {
                prefetch_limit: 1_000,
                max_rows: 0,
                target_rows: 10_000,
                concurrency: 2,
            },
        )
        .await;

        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 1);
        let rows = batch
            .get(&("FakeUsdcMint".to_string(), "1h".to_string()))
            .expect("USDC batch rows");
        assert_eq!(rows[0][4], 1.2);
        handle.abort();
    }

    #[tokio::test]
    async fn price_only_batch_prefetch_skips_when_estimate_exceeds_limit() {
        let (base, counts, handle) = spawn_candle_source_stub().await;
        let (_, _, price_candle) = test_candle_clients(&base);
        let plans = vec![PrefetchPlan {
            query_symbol: "USDC".to_string(),
            digits: 4,
            arbitrum_symbol: Some("USDC".to_string()),
            index_token: "FakeUsdcMint".to_string(),
        }];

        let batch = batch_prefetch_price_candle_for_periods(
            &price_candle,
            &plans,
            &["1h".to_string()],
            1_700_000_000,
            PriceCandleBatchPrefetchOptions {
                prefetch_limit: 1_000,
                max_rows: 1,
                target_rows: 10_000,
                concurrency: 2,
            },
        )
        .await;

        assert!(batch.is_empty());
        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 0);
        handle.abort();
    }

    #[tokio::test]
    async fn price_only_batch_prefetch_splits_tokens_by_target_rows() {
        let (base, counts, handle) = spawn_candle_source_stub().await;
        let (_, _, price_candle) = test_candle_clients(&base);
        let plans = (0..5)
            .map(|n| PrefetchPlan {
                query_symbol: format!("TOKEN{n}"),
                digits: 4,
                arbitrum_symbol: None,
                index_token: format!("FakeMint{n}"),
            })
            .collect::<Vec<_>>();

        let batch = batch_prefetch_price_candle_for_periods(
            &price_candle,
            &plans,
            &["1h".to_string()],
            1_700_000_000,
            PriceCandleBatchPrefetchOptions {
                prefetch_limit: 1_000,
                max_rows: 100_000,
                target_rows: 2_000,
                concurrency: 2,
            },
        )
        .await;

        assert_eq!(counts.price_candle.load(Ordering::SeqCst), 3);
        let mut batch_sizes = counts.price_candle_batch_sizes.lock().unwrap().clone();
        batch_sizes.sort_unstable();
        assert_eq!(batch_sizes, vec![1, 2, 2]);
        assert_eq!(batch.len(), 5);
        handle.abort();
    }

    #[test]
    fn auth_missing_extra_refresh_preserves_derived_displayable_windows() {
        let displayable_15m_key = ("SOLUSD".to_string(), "15m".to_string());
        let displayable_15m_rows = vec![[1_700_000_000.0, 10.0, 11.0, 9.0, 10.5]];
        let displayable_4h_key = ("SOLUSD".to_string(), "4h".to_string());
        let displayable_4h_rows = vec![[1_699_992_000.0, 9.0, 12.0, 8.0, 10.5]];
        let prev = CandleCache {
            candles: HashMap::from([
                (displayable_15m_key.clone(), displayable_15m_rows.clone()),
                (displayable_4h_key.clone(), displayable_4h_rows.clone()),
            ]),
        };
        let extra_key = ("USDC".to_string(), "1h".to_string());
        let extra_rows = vec![[1_700_000_000.0, 1.0, 1.01, 0.99, 1.0]];

        let mut next = assemble_direct_windows(
            &prev,
            vec![
                (("SOLUSD".to_string(), "1h".to_string()), Vec::new()),
                (extra_key.clone(), extra_rows.clone()),
            ],
        );
        assert!(derive_cascade(&next, "SOLUSD", &["5m", "1m"], 900).is_none());
        assert!(derive_cascade(&next, "SOLUSD", &["2h", "1h"], 14_400).is_none());
        preserve_unfilled_previous_window(&prev, &mut next, &displayable_15m_key, true);
        preserve_unfilled_previous_window(&prev, &mut next, &displayable_4h_key, true);

        assert_eq!(next.get(&displayable_15m_key), Some(&displayable_15m_rows));
        assert_eq!(next.get(&displayable_4h_key), Some(&displayable_4h_rows));
        assert_eq!(next.get(&extra_key), Some(&extra_rows));
        assert_eq!(
            next.len(),
            3,
            "extra-only results must not replace the cache"
        );
    }

    #[test]
    fn one_day_lookback_clamped_to_365d_retention_clean_multiple() {
        // 1d window reaches ~2.74y back; clamp caps it at 365d relative to `to` for a clean resolution multiple.
        let now = 1_900_000_000i64;
        let (from, to) = candle_window(now, "1d", 1_000).unwrap();
        let retention = candle_retention_secs("1d").unwrap();
        assert_eq!(retention, 365 * 86_400);
        assert!(
            from < to - retention,
            "raw 1d window is older than the 365d floor"
        );
        let clamped = from.max(to - retention);
        assert_eq!(clamped, to - 365 * 86_400, "clamped to 365d before `to`");
        // The clean-multiple invariant that keeps the engine from 400-ing:
        assert_eq!(
            (to - clamped) % 86_400,
            0,
            "to - from must be an exact multiple of the 1d resolution"
        );
        assert_eq!(to - clamped, 365 * 86_400);
    }

    #[test]
    fn short_period_lookback_not_clamped() {
        // 1h * 1000 = ~41.7d back, well inside the 90d retention -> clamp is a no-op.
        let now = 1_900_000_000i64;
        let (from, to) = candle_window(now, "1h", 1_000).unwrap();
        let retention = candle_retention_secs("1h").unwrap();
        assert!(from > to - retention, "1h window is inside its retention");
        assert_eq!(from.max(to - retention), from, "clamp is a no-op for 1h");
    }
}
