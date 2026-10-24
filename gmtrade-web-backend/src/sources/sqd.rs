//! `SqdSource` — wrapper over [`gmsol_sqd_client::SqdService`] that shapes raw rows into daily DTOs plus moka caches.

use std::future::Future;
use std::sync::Arc;
use std::time::Duration;

use crate::dto::{GtUpdate, LineChartData, PoolLineData, PriceLineData};
use gmsol_sqd_client::{
    GlvInfoDailyApy, GtUpdate as SqdGtUpdate, MarketGmInfoDailyApy, MarketGmPriceDaily,
    MarketTokenPriceHourly, SqdService,
};
use moka::future::Cache;
use tokio::sync::RwLock;

use crate::metrics;

/// Run `fetch`, caching success as last-good and falling back to it (or `Default`) on error.
pub(crate) async fn or_stale<T, F, Fut>(last_good: &Arc<RwLock<Option<T>>>, fetch: F) -> T
where
    T: Clone + Default,
    F: FnOnce() -> Fut,
    Fut: Future<Output = eyre::Result<T>>,
{
    match fetch().await {
        Ok(value) => {
            *last_good.write().await = Some(value.clone());
            value
        }
        Err(err) => {
            tracing::warn!(error = %err, "upstream fetch failed; serving stale data");
            last_good.read().await.clone().unwrap_or_default()
        }
    }
}

const SECS_PER_DAY: i64 = 86_400;

/// Per-day gtUpdates backfill concurrency and per-day retries; a still-failing day is omitted.
const GT_BACKFILL_CONCURRENCY: usize = 8;
const GT_BACKFILL_RETRIES: usize = 3;

/// Max concurrent per-token feeApy fetches (one fetch per token, avoiding shared-limit truncation).
const FEEAPY_CONCURRENCY: usize = 8;

/// Per-token daily long/short series consumed by `annPerformance`: `token -> day -> (long, short)`.
pub(crate) type TokenDailyPrices =
    std::collections::HashMap<String, std::collections::BTreeMap<i64, (String, String)>>;

/// Per-token daily apy series consumed by `feeApy`: `token -> day -> apy`.
pub(crate) type TokenDailyApy =
    std::collections::HashMap<String, std::collections::BTreeMap<i64, f64>>;

/// Per-token daily GM/GLV pool-price series consumed by `annPerformance`: `token -> day -> pool_price`.
/// Sourced from the accumulated `gm_price_cache` / `glv_price_cache` zsets so ann no longer re-fetches it live.
pub(crate) type TokenDailyPoolPrice =
    std::collections::HashMap<String, std::collections::BTreeMap<i64, String>>;

const ANN_PERFORMANCE_TTL: Duration = Duration::from_secs(3600);
const FEE_APY_TTL: Duration = Duration::from_secs(360);
const GT_UPDATES_TTL: Duration = Duration::from_secs(120);
const GM_PRICES_TTL: Duration = Duration::from_secs(3600);
const GLV_PRICES_TTL: Duration = Duration::from_secs(3600);

/// RFC3339 -> unix seconds; falls back to a bare integer epoch string, `None` otherwise.
pub(crate) fn parse_rfc3339_to_unix(ts: &str) -> Option<i64> {
    use time::format_description::well_known::Rfc3339;
    time::OffsetDateTime::parse(ts, &Rfc3339)
        .ok()
        .map(|dt| dt.unix_timestamp())
        .or_else(|| ts.parse::<i64>().ok())
}

pub(crate) fn floor_to_day(unix_secs: i64) -> i64 {
    unix_secs - unix_secs.rem_euclid(SECS_PER_DAY)
}

/// Unix seconds -> RFC3339 UTC-midnight string for a subsquid `DateTime` filter bound, falling back to the epoch on overflow.
fn iso_midnight(unix_secs: i64) -> String {
    let dt = time::OffsetDateTime::from_unix_timestamp(unix_secs)
        .unwrap_or(time::OffsetDateTime::UNIX_EPOCH);
    format!(
        "{:04}-{:02}-{:02}T00:00:00Z",
        dt.year(),
        u8::from(dt.month()),
        dt.day()
    )
}

/// Window start in unix secs, where `days < 0` means "all" (~19999 days back).
pub(crate) fn window_start_ts(days: i64, now_unix: i64) -> i64 {
    let start_of_today = floor_to_day(now_unix);
    let back = if days < 0 { 19_999 } else { days };
    start_of_today - back * SECS_PER_DAY
}

/// Row limit for daily series. The indexer enforces its own max, so over-estimate is safe.
pub(crate) fn daily_limit(days: i64) -> i64 {
    if days < 0 {
        20_000
    } else {
        days + 1
    }
}

/// Row limit for the hourly series (annPerformance only): ~24 rows per day.
pub(crate) fn hourly_limit(days: i64) -> i64 {
    if days < 0 {
        20_000
    } else {
        (days + 1) * 24
    }
}

/// feeApy `annualized`: the mean of the daily `ydata` values, or `0.0` when the sum is `<= 0`.
pub(crate) fn fee_apy_annualized(ydatas: &[f64]) -> f64 {
    let sum: f64 = ydatas.iter().copied().sum();
    if sum > 0.0 {
        sum / (ydatas.len() as f64)
    } else {
        0.0
    }
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct CumPoint {
    pub long: f64,
    pub short: f64,
    pub pool: f64,
    pub day_timestamp: i64,
}

/// Port of Go `CalculateCumulative`, returning `(line_charts, annualized)`.
pub(crate) fn calculate_cumulative(daily: &[CumPoint]) -> (Vec<LineChartData>, f64) {
    if daily.is_empty() {
        return (Vec::new(), 0.0);
    }
    let start = daily[0];
    let mut line_charts: Vec<LineChartData> = Vec::with_capacity(daily.len());
    for (i, day) in daily.iter().enumerate() {
        if i == 0 {
            line_charts.push(LineChartData {
                time_stamp: day.day_timestamp,
                ydata: 0.0,
            });
            continue;
        }
        let ratio = (day.long * day.short) / (start.long * start.short);
        let benchmark = start.pool * ratio.sqrt();
        let diff = day.pool - benchmark;
        let cumulative = diff / start.pool;
        line_charts.push(LineChartData {
            time_stamp: day.day_timestamp,
            ydata: cumulative,
        });
    }
    let start_day = line_charts.first().map(|c| c.time_stamp).unwrap_or(0);
    let end_day = line_charts.last().map(|c| c.time_stamp).unwrap_or(0);
    let duration_days = (end_day - start_day) / SECS_PER_DAY + 1; // integer floor div, matches Go
    let last_ydata = line_charts.last().map(|c| c.ydata).unwrap_or(0.0);
    let annualized = last_ydata * (365.0 / duration_days as f64);
    (line_charts, annualized)
}

/// Collapse `(unix_secs, value_string)` pairs into one [`PriceLineData`] per UTC day, window-filtered and emitted ascending.
fn dedup_by_day_string(
    pairs: impl Iterator<Item = (i64, String)>,
    window_start: i64,
) -> Vec<PriceLineData> {
    use std::collections::BTreeMap;
    let mut by_day: BTreeMap<i64, String> = BTreeMap::new();
    for (unix_secs, value) in pairs {
        let day = floor_to_day(unix_secs);
        if day < window_start {
            continue;
        }
        by_day.entry(day).or_insert(value);
    }
    by_day
        .into_iter()
        .map(|(day, ydata)| PriceLineData {
            time_stamp: day,
            ydata,
        })
        .collect()
}

/// Shape `marketGmPriceDailies` rows for a single market token into the `gmPrices` series.
pub(crate) fn shape_gm_prices(
    rows: &[MarketGmPriceDaily],
    window_start: i64,
) -> Vec<PriceLineData> {
    dedup_by_day_string(
        rows.iter()
            .filter_map(|r| Some((parse_rfc3339_to_unix(&r.timestamp)?, r.gm_price_now.clone()))),
        window_start,
    )
}

/// See [`shape_gm_prices`].
pub(crate) fn shape_glv_prices(
    rows: &[gmsol_sqd_client::GlvPriceDaily],
    window_start: i64,
) -> Vec<PriceLineData> {
    dedup_by_day_string(
        rows.iter().filter_map(|r| {
            Some((
                parse_rfc3339_to_unix(&r.timestamp)?,
                r.glv_price_now.clone(),
            ))
        }),
        window_start,
    )
}

/// A daily/intraday apy row abstracting over the market and GLV feeds so `shape_fee_apy` works on both.
pub(crate) trait ApyRow {
    fn apy(&self) -> &str;
    fn timestamp(&self) -> &str;
}

impl ApyRow for MarketGmInfoDailyApy {
    fn apy(&self) -> &str {
        &self.apy
    }
    fn timestamp(&self) -> &str {
        &self.timestamp
    }
}

impl ApyRow for GlvInfoDailyApy {
    fn apy(&self) -> &str {
        &self.apy
    }
    fn timestamp(&self) -> &str {
        &self.timestamp
    }
}

pub(crate) fn shape_fee_apy<R: ApyRow>(
    token_address: &str,
    rows: &[R],
    window_start: i64,
) -> Option<PoolLineData> {
    use std::collections::BTreeMap;
    // One row per UTC day, freshest wins (sqd order is DESC).
    let mut by_day: BTreeMap<i64, f64> = BTreeMap::new();
    for r in rows {
        let Some(unix_secs) = parse_rfc3339_to_unix(r.timestamp()) else {
            continue;
        };
        let day = floor_to_day(unix_secs);
        if day < window_start {
            continue;
        }
        let Ok(value) = r.apy().parse::<f64>() else {
            tracing::debug!(token = %token_address, raw = %r.apy(), "sqd: skipping unparseable apy");
            continue;
        };
        by_day.entry(day).or_insert(value);
    }
    if by_day.is_empty() {
        return None;
    }
    let line_charts: Vec<LineChartData> = by_day
        .into_iter()
        .map(|(day, ydata)| LineChartData {
            time_stamp: day,
            ydata,
        })
        .collect();
    let ydatas: Vec<f64> = line_charts.iter().map(|c| c.ydata).collect();
    let annualized = fee_apy_annualized(&ydatas);
    Some(PoolLineData {
        token_address: token_address.to_string(),
        annualized,
        line_charts,
    })
}

/// `shape_fee_apy` over an already-reduced `day -> apy` series, dropping days before `window_start`.
pub(crate) fn shape_fee_apy_from_daily(
    token_address: &str,
    by_day: &std::collections::BTreeMap<i64, f64>,
    window_start: i64,
) -> Option<PoolLineData> {
    let line_charts: Vec<LineChartData> = by_day
        .iter()
        .filter(|(day, _)| **day >= window_start)
        .map(|(day, ydata)| LineChartData {
            time_stamp: *day,
            ydata: *ydata,
        })
        .collect();
    if line_charts.is_empty() {
        return None;
    }
    let ydatas: Vec<f64> = line_charts.iter().map(|c| c.ydata).collect();
    let annualized = fee_apy_annualized(&ydatas);
    Some(PoolLineData {
        token_address: token_address.to_string(),
        annualized,
        line_charts,
    })
}

/// Group raw apy rows by token, reducing each to one freshest row per UTC day as `(token, day_timestamp, apy, timestamp)`.
fn reduce_apy_by_day<R>(
    rows: Vec<R>,
    token_of: impl Fn(&R) -> String,
    apy_of: impl Fn(&R) -> &str,
    ts_of: impl Fn(&R) -> &str,
) -> Vec<(String, i64, String, String)> {
    use std::collections::{BTreeMap, HashMap};
    let mut grouped: HashMap<String, BTreeMap<i64, (String, String)>> = HashMap::new();
    for r in &rows {
        let Some(unix_secs) = parse_rfc3339_to_unix(ts_of(r)) else {
            continue;
        };
        let day = floor_to_day(unix_secs);
        grouped
            .entry(token_of(r))
            .or_default()
            .entry(day)
            .or_insert_with(|| (apy_of(r).to_string(), ts_of(r).to_string()));
    }
    let mut out = Vec::new();
    for (token, by_day) in grouped {
        for (day, (apy, ts)) in by_day {
            out.push((token.clone(), day, apy, ts));
        }
    }
    out
}

/// Reduce timestamped rows to one freshest value per UTC day (`day -> value`); the first row seen per day wins (sqd order is DESC). Unparseable timestamps are skipped.
fn freshest_by_day<R, V>(
    rows: &[R],
    ts_of: impl Fn(&R) -> &str,
    val_of: impl Fn(&R) -> V,
) -> std::collections::BTreeMap<i64, V> {
    let mut by_day = std::collections::BTreeMap::new();
    for r in rows {
        let Some(unix_secs) = parse_rfc3339_to_unix(ts_of(r)) else {
            continue;
        };
        by_day
            .entry(floor_to_day(unix_secs))
            .or_insert_with(|| val_of(r));
    }
    by_day
}

/// Daily-reduce hourly token-price rows for one market token into `day -> (long, short)` raw strings, freshest wins.
fn reduce_token_prices_by_day(
    rows: &[MarketTokenPriceHourly],
) -> std::collections::BTreeMap<i64, (String, String)> {
    freshest_by_day(
        rows,
        |r| r.timestamp.as_str(),
        |r| (r.long_token_price.clone(), r.short_token_price.clone()),
    )
}

fn reduce_gm_prices_by_day(rows: &[MarketGmPriceDaily]) -> std::collections::BTreeMap<i64, String> {
    freshest_by_day(rows, |r| r.timestamp.as_str(), |r| r.gm_price_now.clone())
}

/// Freshest-per-day GLV pool price (`glvPriceNow`), the GLV analogue of [`reduce_gm_prices_by_day`].
fn reduce_glv_prices_by_day(
    rows: &[gmsol_sqd_client::GlvPriceDaily],
) -> std::collections::BTreeMap<i64, String> {
    freshest_by_day(rows, |r| r.timestamp.as_str(), |r| r.glv_price_now.clone())
}

/// Build the joined ascending daily series for annPerformance, skipping unmatched, unparseable, or zero days.
pub(crate) fn join_cum_points(
    token_prices: &std::collections::BTreeMap<i64, (String, String)>,
    gm_prices: &std::collections::BTreeMap<i64, String>,
    window_start: i64,
) -> Vec<CumPoint> {
    let mut out = Vec::new();
    for (&day, (long_s, short_s)) in token_prices {
        if day < window_start {
            continue;
        }
        let Some(pool_s) = gm_prices.get(&day) else {
            continue;
        };
        let (Ok(long), Ok(short), Ok(pool)) = (
            long_s.parse::<f64>(),
            short_s.parse::<f64>(),
            pool_s.parse::<f64>(),
        ) else {
            continue;
        };
        if long == 0.0 || short == 0.0 || pool == 0.0 {
            continue;
        }
        out.push(CumPoint {
            long,
            short,
            pool,
            day_timestamp: day,
        });
    }
    out // BTreeMap iteration is ascending by day already.
}

/// Shape `gtUpdateds` rows into the `gtUpdates` series, one freshest entry per day emitted ascending.
pub(crate) fn shape_gt_updates(rows: &[SqdGtUpdate]) -> Vec<GtUpdate> {
    use std::collections::BTreeMap;
    let mut by_day: BTreeMap<i64, (String, String)> = BTreeMap::new();
    for r in rows {
        let Some(unix_secs) = parse_rfc3339_to_unix(&r.timestamp) else {
            continue;
        };
        by_day
            .entry(floor_to_day(unix_secs))
            .or_insert_with(|| (r.timestamp.clone(), r.total_minted.clone()));
    }
    by_day
        .into_iter()
        .map(|(day, (timestamp, total_minted))| GtUpdate {
            total_minted,
            timestamp,
            day_timestamp: day,
        })
        .collect()
}

/// Group owned rows by their `market_token` key (each row moves, no per-row clone).
fn group_by<T, K>(rows: Vec<T>, key: K) -> std::collections::HashMap<String, Vec<T>>
where
    K: Fn(&T) -> &str,
{
    let mut map: std::collections::HashMap<String, Vec<T>> = std::collections::HashMap::new();
    for r in rows {
        map.entry(key(&r).to_string()).or_default().push(r);
    }
    map
}

fn token_cache_key(days: i64, tokens: &[String]) -> String {
    let mut sorted: Vec<&str> = tokens.iter().map(String::as_str).collect();
    sorted.sort_unstable();
    format!("{days}:{}", sorted.join(","))
}

#[derive(Clone)]
pub struct SqdSource {
    sqd: Arc<SqdService>,
    // moka TTL caches keyed by the request shape.
    gm_prices_cache: Cache<String, Vec<PriceLineData>>,
    glv_prices_cache: Cache<String, Vec<PriceLineData>>,
    fee_apy_cache: Cache<String, Vec<PoolLineData>>,
    ann_performance_cache: Cache<String, Vec<PoolLineData>>,
    gt_updates_cache: Cache<i64, Vec<GtUpdate>>,
    // Stale-fallback store for the global gtUpdates feed.
    last_good_gt_updates: Arc<RwLock<Option<Vec<GtUpdate>>>>,
}

impl SqdSource {
    pub fn new(sqd: SqdService) -> Self {
        Self {
            sqd: Arc::new(sqd),
            gm_prices_cache: Cache::builder()
                .max_capacity(256)
                .time_to_live(GM_PRICES_TTL)
                .build(),
            glv_prices_cache: Cache::builder()
                .max_capacity(256)
                .time_to_live(GLV_PRICES_TTL)
                .build(),
            fee_apy_cache: Cache::builder()
                .max_capacity(256)
                .time_to_live(FEE_APY_TTL)
                .build(),
            ann_performance_cache: Cache::builder()
                .max_capacity(256)
                .time_to_live(ANN_PERFORMANCE_TTL)
                .build(),
            gt_updates_cache: Cache::builder()
                .max_capacity(16)
                .time_to_live(GT_UPDATES_TTL)
                .build(),
            last_good_gt_updates: Arc::new(RwLock::new(None)),
        }
    }

    /// `gmPrices` daily series for a single market token, window-filtered, empty on upstream failure.
    pub async fn gm_prices(&self, market_token: &str, days: i64) -> Vec<PriceLineData> {
        let key = format!("{market_token}:{days}");
        if let Some(cached) = self.gm_prices_cache.get(&key).await {
            return cached;
        }
        let now = time::OffsetDateTime::now_utc().unix_timestamp();
        let window_start = window_start_ts(days, now);
        let token = market_token.to_string();
        let upstream = metrics::UpstreamGuard::start(metrics::UpstreamOperation::SqdGmPrices);
        let fetched = self
            .sqd
            .fetch_market_gm_price_dailies(std::slice::from_ref(&token), daily_limit(days))
            .await;
        upstream.finish_result(&fetched, Vec::is_empty);
        let rows = fetched.unwrap_or_else(|err| {
            tracing::warn!(error = %err, token = %token, "sqd gmPrices fetch failed");
            Vec::new()
        });
        let shaped = shape_gm_prices(&rows, window_start);
        self.gm_prices_cache.insert(key, shaped.clone()).await;
        shaped
    }

    /// `feeApy` [`PoolLineData`] per market token (mean annualization), tokens with no rows omitted.
    pub async fn fee_apy(
        &self,
        market_tokens: &[String],
        glv_tokens: &[String],
        days: i64,
        apy_daily: Option<&TokenDailyApy>,
    ) -> Vec<PoolLineData> {
        if market_tokens.is_empty() && glv_tokens.is_empty() {
            return Vec::new();
        }
        let now = time::OffsetDateTime::now_utc().unix_timestamp();
        let window_start = window_start_ts(days, now);

        // Accumulated-zset path: build straight from the full day->apy series, no sqd fetch.
        if let Some(apy_daily) = apy_daily {
            let mut out = Vec::new();
            for token in market_tokens.iter().chain(glv_tokens.iter()) {
                if let Some(by_day) = apy_daily.get(token) {
                    if let Some(pool) = shape_fee_apy_from_daily(token, by_day, window_start) {
                        out.push(pool);
                    }
                }
            }
            return out;
        }

        let key = format!(
            "{}|glv:{}",
            token_cache_key(days, market_tokens),
            token_cache_key(days, glv_tokens)
        );
        if let Some(cached) = self.fee_apy_cache.get(&key).await {
            return cached;
        }
        // Per-token, since a shared multi-token query truncates each token's series.
        let rows: Vec<MarketGmInfoDailyApy> = {
            use futures_util::StreamExt;
            futures_util::stream::iter(market_tokens.to_vec())
                .map(|token| {
                    let sqd = self.sqd.clone();
                    async move {
                        let upstream =
                            metrics::UpstreamGuard::start(metrics::UpstreamOperation::SqdFeeApy);
                        let fetched = sqd
                            .fetch_market_gm_info_dailies_apy(
                                std::slice::from_ref(&token),
                                daily_limit(days),
                            )
                            .await;
                        upstream.finish_result(&fetched, Vec::is_empty);
                        fetched.unwrap_or_else(|err| {
                            tracing::warn!(error = %err, %token, "sqd feeApy fetch failed");
                            Vec::new()
                        })
                    }
                })
                .buffer_unordered(FEEAPY_CONCURRENCY)
                .collect::<Vec<_>>()
                .await
                .into_iter()
                .flatten()
                .collect()
        };
        let mut grouped = group_by(rows, |r: &MarketGmInfoDailyApy| r.market_token.as_str());
        let mut out = Vec::new();
        for token in market_tokens {
            let token_rows = grouped.remove(token).unwrap_or_default();
            if let Some(pool) = shape_fee_apy(token, &token_rows, window_start) {
                out.push(pool);
            }
        }
        // GLV feeApy: same mean-of-daily algorithm sourced from `glvInfoDailies`, appended after the market rows.
        let glv_rows: Vec<GlvInfoDailyApy> = {
            use futures_util::StreamExt;
            futures_util::stream::iter(glv_tokens.to_vec())
                .map(|token| {
                    let sqd = self.sqd.clone();
                    async move {
                        let upstream =
                            metrics::UpstreamGuard::start(metrics::UpstreamOperation::SqdFeeApy);
                        let fetched = sqd
                            .fetch_glv_info_dailies_apy(
                                std::slice::from_ref(&token),
                                daily_limit(days),
                            )
                            .await;
                        upstream.finish_result(&fetched, Vec::is_empty);
                        fetched.unwrap_or_else(|err| {
                            tracing::warn!(error = %err, %token, "sqd feeApy GLV fetch failed");
                            Vec::new()
                        })
                    }
                })
                .buffer_unordered(FEEAPY_CONCURRENCY)
                .collect::<Vec<_>>()
                .await
                .into_iter()
                .flatten()
                .collect()
        };
        let mut glv_grouped = group_by(glv_rows, |r: &GlvInfoDailyApy| r.glv_token.as_str());
        for token in glv_tokens {
            let token_rows = glv_grouped.remove(token).unwrap_or_default();
            if let Some(pool) = shape_fee_apy(token, &token_rows, window_start) {
                out.push(pool);
            }
        }
        self.fee_apy_cache.insert(key, out.clone()).await;
        out
    }

    /// `annPerformance` [`PoolLineData`] per market token (and GLV vault via `glv_pairs`), joining daily token
    /// prices against daily GM prices through [`calculate_cumulative`]. `token_daily` injects the accumulated
    /// long/short series, `gm_pool`/`glv_pool` inject the accumulated GM/GLV pool-price series (from the
    /// `gm_price_cache`/`glv_price_cache` zsets); each falls back to a live sqd fetch only when its override is `None`.
    pub async fn ann_performance(
        &self,
        market_tokens: &[String],
        glv_pairs: &[(String, String)],
        days: i64,
        token_daily: Option<&TokenDailyPrices>,
        gm_pool: Option<&TokenDailyPoolPrice>,
        glv_pool: Option<&TokenDailyPoolPrice>,
    ) -> Vec<PoolLineData> {
        use std::collections::BTreeMap;

        if market_tokens.is_empty() && glv_pairs.is_empty() {
            return Vec::new();
        }
        let glv_key_tokens: Vec<String> = glv_pairs.iter().map(|(g, _)| g.clone()).collect();
        let key = format!(
            "{}|glv:{}",
            token_cache_key(days, market_tokens),
            token_cache_key(days, &glv_key_tokens)
        );
        if let Some(cached) = self.ann_performance_cache.get(&key).await {
            return cached;
        }
        let now = time::OffsetDateTime::now_utc().unix_timestamp();
        let window_start = window_start_ts(days, now);

        // Per-token daily long/short series: prefer the accumulated zset; else live hourly.
        let fallback_owned;
        let token_daily: &TokenDailyPrices = match token_daily {
            Some(m) => m,
            None => {
                let mut needed: Vec<String> = market_tokens.to_vec();
                needed.extend(glv_pairs.iter().map(|(_, m)| m.clone()));
                let upstream = metrics::UpstreamGuard::start_if(
                    metrics::UpstreamOperation::SqdAnnPerformance,
                    || !needed.is_empty(),
                );
                let fetched = self
                    .sqd
                    .fetch_market_token_price_hourlies(&needed, hourly_limit(days))
                    .await;
                upstream.finish_result(&fetched, Vec::is_empty);
                let hourly_rows = fetched.unwrap_or_else(|err| {
                    tracing::warn!(error = %err, "sqd annPerformance token-price fetch failed");
                    Vec::new()
                });
                fallback_owned = group_by(hourly_rows, |r: &MarketTokenPriceHourly| {
                    r.market_token.as_str()
                })
                .into_iter()
                .map(|(t, rows)| (t, reduce_token_prices_by_day(&rows)))
                .collect();
                &fallback_owned
            }
        };
        let empty_daily: BTreeMap<i64, (String, String)> = BTreeMap::new();

        // GM pool price per market token: prefer the accumulated `gm_price_cache` zset (`gm_pool`); fall back
        // to a live sqd fetch only when no override is supplied (Redis disabled) — so a flaky sqd no longer
        // drops tokens from the series. Per-token fetch, since a shared multi-token query truncates the GM series.
        let gm_fallback;
        let gm_lookup: &TokenDailyPoolPrice = match gm_pool {
            Some(m) => m,
            None => {
                use futures_util::StreamExt;
                let gm_rows: Vec<MarketGmPriceDaily> = futures_util::stream::iter(market_tokens.to_vec())
                    .map(|token| {
                        let sqd = self.sqd.clone();
                        async move {
                            let upstream = metrics::UpstreamGuard::start(
                                metrics::UpstreamOperation::SqdAnnPerformance,
                            );
                            let fetched = sqd.fetch_market_gm_price_dailies(
                                std::slice::from_ref(&token),
                                daily_limit(days),
                            )
                            .await;
                            upstream.finish_result(&fetched, Vec::is_empty);
                            fetched
                            .unwrap_or_else(|err| {
                                tracing::warn!(error = %err, %token, "sqd annPerformance gm-price fetch failed");
                                Vec::new()
                            })
                        }
                    })
                    .buffer_unordered(FEEAPY_CONCURRENCY)
                    .collect::<Vec<_>>()
                    .await
                    .into_iter()
                    .flatten()
                    .collect();
                gm_fallback = group_by(gm_rows, |r: &MarketGmPriceDaily| r.market_token.as_str())
                    .into_iter()
                    .map(|(t, rows)| (t, reduce_gm_prices_by_day(&rows)))
                    .collect();
                &gm_fallback
            }
        };
        let empty_pool: BTreeMap<i64, String> = BTreeMap::new();

        let mut out = Vec::new();
        for token in market_tokens {
            let token_prices = token_daily.get(token).unwrap_or(&empty_daily);
            let gm_prices = gm_lookup.get(token).unwrap_or(&empty_pool);
            let joined = join_cum_points(token_prices, gm_prices, window_start);
            if joined.is_empty() {
                continue;
            }
            let (line_charts, annualized) = calculate_cumulative(&joined);
            out.push(PoolLineData {
                token_address: token.clone(),
                annualized,
                line_charts,
            });
        }

        // GLV vaults: benchmark the representative market's long/short prices against the GLV's own daily price.
        if !glv_pairs.is_empty() {
            // GLV pool price: prefer the accumulated `glv_price_cache` zset (`glv_pool`); live sqd fetch only without an override.
            let glv_fallback;
            let glv_lookup: &TokenDailyPoolPrice = match glv_pool {
                Some(m) => m,
                None => {
                    use futures_util::StreamExt;
                    let glv_tokens: Vec<String> =
                        glv_pairs.iter().map(|(g, _)| g.clone()).collect();
                    let glv_rows: Vec<gmsol_sqd_client::GlvPriceDaily> =
                        futures_util::stream::iter(glv_tokens)
                            .map(|token| {
                                let sqd = self.sqd.clone();
                                async move {
                                    let upstream = metrics::UpstreamGuard::start(
                                        metrics::UpstreamOperation::SqdAnnPerformance,
                                    );
                                    let fetched = sqd.fetch_glv_price_dailies(
                                        std::slice::from_ref(&token),
                                        daily_limit(days),
                                    )
                                    .await;
                                    upstream.finish_result(&fetched, Vec::is_empty);
                                    fetched
                                    .unwrap_or_else(|err| {
                                        tracing::warn!(error = %err, %token, "sqd annPerformance GLV price fetch failed");
                                        Vec::new()
                                    })
                                }
                            })
                            .buffer_unordered(FEEAPY_CONCURRENCY)
                            .collect::<Vec<_>>()
                            .await
                            .into_iter()
                            .flatten()
                            .collect();
                    glv_fallback = group_by(glv_rows, |r: &gmsol_sqd_client::GlvPriceDaily| {
                        r.glv_token.as_str()
                    })
                    .into_iter()
                    .map(|(t, rows)| (t, reduce_glv_prices_by_day(&rows)))
                    .collect();
                    &glv_fallback
                }
            };
            for (glv_token, repr_market) in glv_pairs {
                // representative market's long/short come from the same accumulated series.
                let token_prices = token_daily.get(repr_market).unwrap_or(&empty_daily);
                let glv_prices = glv_lookup.get(glv_token).unwrap_or(&empty_pool);
                let joined = join_cum_points(token_prices, glv_prices, window_start);
                if joined.is_empty() {
                    continue;
                }
                let (line_charts, annualized) = calculate_cumulative(&joined);
                out.push(PoolLineData {
                    token_address: glv_token.clone(),
                    annualized,
                    line_charts,
                });
            }
        }

        self.ann_performance_cache.insert(key, out.clone()).await;
        out
    }

    /// Fetch `marketTokenPriceHourlies` for `tokens` reduced to one freshest row per UTC day as `(market_token, day_timestamp, long, short, timestamp)`.
    pub async fn market_token_prices_daily(
        &self,
        tokens: &[String],
        limit: i64,
    ) -> Vec<(String, i64, String, String, String)> {
        use std::collections::BTreeMap;
        let upstream =
            metrics::UpstreamGuard::start_if(metrics::UpstreamOperation::SqdAnnPerformance, || {
                !tokens.is_empty()
            });
        let fetched = self
            .sqd
            .fetch_market_token_price_hourlies(tokens, limit)
            .await;
        upstream.finish_result(&fetched, Vec::is_empty);
        let rows = fetched.unwrap_or_else(|err| {
            tracing::warn!(error = %err, "sqd market_token_prices_daily fetch failed");
            Vec::new()
        });
        let mut out = Vec::new();
        for (token, token_rows) in
            group_by(rows, |r: &MarketTokenPriceHourly| r.market_token.as_str())
        {
            // Rows arrive timestamp_DESC; keep the first (freshest) seen per day.
            let mut by_day: BTreeMap<i64, (String, String, String)> = BTreeMap::new();
            for r in &token_rows {
                let Some(unix_secs) = parse_rfc3339_to_unix(&r.timestamp) else {
                    continue;
                };
                by_day.entry(floor_to_day(unix_secs)).or_insert_with(|| {
                    (
                        r.long_token_price.clone(),
                        r.short_token_price.clone(),
                        r.timestamp.clone(),
                    )
                });
            }
            for (day, (long, short, ts)) in by_day {
                out.push((token.clone(), day, long, short, ts));
            }
        }
        out
    }

    /// Fetch `marketGmInfoDailies.apy` for `tokens` reduced to one freshest row per UTC day as `(market_token, day_timestamp, apy, timestamp)`.
    pub async fn gm_info_dailies_reduced(
        &self,
        tokens: &[String],
        limit: i64,
    ) -> Vec<(String, i64, String, String)> {
        let upstream =
            metrics::UpstreamGuard::start_if(metrics::UpstreamOperation::SqdFeeApy, || {
                !tokens.is_empty()
            });
        let fetched = self
            .sqd
            .fetch_market_gm_info_dailies_apy(tokens, limit)
            .await;
        upstream.finish_result(&fetched, Vec::is_empty);
        let rows = fetched.unwrap_or_else(|err| {
            tracing::warn!(error = %err, "sqd gm_info_dailies_reduced fetch failed");
            Vec::new()
        });
        reduce_apy_by_day(
            rows,
            |r| r.market_token.clone(),
            |r| &r.apy,
            |r| &r.timestamp,
        )
    }

    /// GLV analogue of [`Self::gm_info_dailies_reduced`], sourced from `glvInfoDailies`.
    pub async fn glv_info_dailies_reduced(
        &self,
        tokens: &[String],
        limit: i64,
    ) -> Vec<(String, i64, String, String)> {
        let upstream =
            metrics::UpstreamGuard::start_if(metrics::UpstreamOperation::SqdFeeApy, || {
                !tokens.is_empty()
            });
        let fetched = self.sqd.fetch_glv_info_dailies_apy(tokens, limit).await;
        upstream.finish_result(&fetched, Vec::is_empty);
        let rows = fetched.unwrap_or_else(|err| {
            tracing::warn!(error = %err, "sqd glv_info_dailies_reduced fetch failed");
            Vec::new()
        });
        reduce_apy_by_day(rows, |r| r.glv_token.clone(), |r| &r.apy, |r| &r.timestamp)
    }

    /// `gtUpdates` daily global series, using last-good stale-fallback across a blip.
    pub async fn gt_updates(&self, limit: i64) -> Vec<GtUpdate> {
        if let Some(cached) = self.gt_updates_cache.get(&limit).await {
            return cached;
        }
        let sqd = self.sqd.clone();
        let fresh = or_stale(&self.last_good_gt_updates, move || async move {
            let upstream = metrics::UpstreamGuard::start(metrics::UpstreamOperation::SqdGtUpdates);
            let fetched = sqd.fetch_gt_updates(limit).await;
            upstream.finish_result(&fetched, Vec::is_empty);
            let rows = fetched.map_err(|e| eyre::eyre!("{}", e))?;
            Ok(shape_gt_updates(&rows))
        })
        .await;
        self.gt_updates_cache.insert(limit, fresh.clone()).await;
        fresh
    }

    /// One-shot full-history gtUpdates backfill, fetching each UTC day's last `totalMinted` independently from the earliest mint.
    pub async fn gt_updates_backfill(&self) -> Vec<GtUpdate> {
        use futures_util::StreamExt;

        let upstream =
            metrics::UpstreamGuard::start(metrics::UpstreamOperation::SqdGtUpdatesBackfill);
        let fetched = self.sqd.fetch_gt_earliest_timestamp().await;
        upstream.finish_result(&fetched, Option::is_none);
        let earliest_iso = match fetched {
            Ok(Some(ts)) => ts,
            Ok(None) => return Vec::new(),
            Err(err) => {
                tracing::warn!(error = %err, "gt backfill: earliest-timestamp fetch failed");
                return Vec::new();
            }
        };
        let Some(earliest_unix) = parse_rfc3339_to_unix(&earliest_iso) else {
            tracing::warn!(ts = %earliest_iso, "gt backfill: unparseable earliest timestamp");
            return Vec::new();
        };
        let now = time::OffsetDateTime::now_utc().unix_timestamp();
        let first_day = floor_to_day(earliest_unix);
        let last_day = floor_to_day(now);
        let days: Vec<i64> = (first_day..=last_day)
            .step_by(SECS_PER_DAY as usize)
            .collect();
        let total = days.len();

        let mut rows: Vec<SqdGtUpdate> = futures_util::stream::iter(days)
            .map(|day| {
                let sqd = self.sqd.clone();
                async move {
                    let start = iso_midnight(day);
                    let end = iso_midnight(day + SECS_PER_DAY);
                    for _ in 0..GT_BACKFILL_RETRIES {
                        let upstream = metrics::UpstreamGuard::start(
                            metrics::UpstreamOperation::SqdGtUpdatesBackfill,
                        );
                        let fetched = sqd.fetch_gt_day_last(&start, &end).await;
                        upstream.finish_result(&fetched, Option::is_none);
                        if let Ok(row) = fetched {
                            return row; // Some(last mint) or None (no mint that day)
                        }
                    }
                    None
                }
            })
            .buffer_unordered(GT_BACKFILL_CONCURRENCY)
            .filter_map(|row| async move { row })
            .collect()
            .await;

        tracing::info!(
            days = total,
            fetched = rows.len(),
            "gt backfill: per-day history collected"
        );
        // Sort for determinism / stable logs before shape_gt_updates de-dups to one-per-day.
        rows.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        shape_gt_updates(&rows)
    }

    // GLV: `glv_prices` and `fee_apy` are wired; annPerformance GLV is still deferred.

    /// `glvPrices` daily series for a single GLV token, window-filtered, empty on upstream failure.
    pub async fn glv_prices(&self, glv_token: &str, days: i64) -> Vec<PriceLineData> {
        let key = format!("{glv_token}:{days}");
        if let Some(cached) = self.glv_prices_cache.get(&key).await {
            return cached;
        }
        let now = time::OffsetDateTime::now_utc().unix_timestamp();
        let window_start = window_start_ts(days, now);
        let token = glv_token.to_string();
        let upstream = metrics::UpstreamGuard::start(metrics::UpstreamOperation::SqdGlvPrices);
        let fetched = self
            .sqd
            .fetch_glv_price_dailies(std::slice::from_ref(&token), daily_limit(days))
            .await;
        upstream.finish_result(&fetched, Vec::is_empty);
        let rows = fetched.unwrap_or_else(|err| {
            tracing::warn!(error = %err, token = %token, "sqd glvPrices fetch failed");
            Vec::new()
        });
        let shaped = shape_glv_prices(&rows, window_start);
        self.glv_prices_cache.insert(key, shaped.clone()).await;
        shaped
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iso_midnight_formats_utc_day_bounds() {
        // 2025-03-09T01:58:00Z -> floored day -> "2025-03-09T00:00:00Z".
        let day = floor_to_day(parse_rfc3339_to_unix("2025-03-09T01:58:00Z").unwrap());
        assert_eq!(iso_midnight(day), "2025-03-09T00:00:00Z");
        // Next day bound rolls month/zero-pads correctly.
        assert_eq!(iso_midnight(day + SECS_PER_DAY), "2025-03-10T00:00:00Z");
        // Epoch + zero-pad sanity.
        assert_eq!(iso_midnight(0), "1970-01-01T00:00:00Z");
    }

    fn gm_row(market_token: &str, price: &str, ts: &str) -> MarketGmPriceDaily {
        MarketGmPriceDaily {
            market_token: market_token.to_string(),
            gm_price_now: price.to_string(),
            timestamp: ts.to_string(),
        }
    }

    fn apy_row(market_token: &str, apy: &str, ts: &str) -> MarketGmInfoDailyApy {
        MarketGmInfoDailyApy {
            market_token: market_token.to_string(),
            apy: apy.to_string(),
            timestamp: ts.to_string(),
        }
    }

    fn glv_apy_row(glv_token: &str, apy: &str, ts: &str) -> GlvInfoDailyApy {
        GlvInfoDailyApy {
            glv_token: glv_token.to_string(),
            apy: apy.to_string(),
            timestamp: ts.to_string(),
        }
    }

    fn hourly_row(market_token: &str, long: &str, short: &str, ts: &str) -> MarketTokenPriceHourly {
        MarketTokenPriceHourly {
            market_token: market_token.to_string(),
            long_token_price: long.to_string(),
            short_token_price: short.to_string(),
            timestamp: ts.to_string(),
        }
    }

    fn gt_row(total_minted: &str, ts: &str) -> SqdGtUpdate {
        SqdGtUpdate {
            total_minted: total_minted.to_string(),
            timestamp: ts.to_string(),
        }
    }

    /// Open window (admit everything) for shaping tests.
    const ALL: i64 = i64::MIN;

    #[test]
    fn parse_rfc3339_to_unix_handles_rfc3339_and_epoch() {
        assert_eq!(
            parse_rfc3339_to_unix("2026-02-05T03:00:00.000000Z"),
            Some(1_770_260_400)
        );
        assert_eq!(parse_rfc3339_to_unix("1748649600"), Some(1_748_649_600));
        assert_eq!(parse_rfc3339_to_unix("not-a-date"), None);
    }

    #[test]
    fn window_start_ts_days_negative_is_19999_days_back() {
        let now = 1_770_381_296;
        let start_today = floor_to_day(now);
        assert_eq!(window_start_ts(30, now), start_today - 30 * SECS_PER_DAY);
        assert_eq!(
            window_start_ts(-1, now),
            start_today - 19_999 * SECS_PER_DAY
        );
    }

    #[test]
    fn fee_apy_annualized_is_mean() {
        // mean of [0.08, 0.0842] = 0.0821 (NOT the latest-day value)
        let m = fee_apy_annualized(&[0.08, 0.0842]);
        assert!((m - 0.0821).abs() < 1e-12, "got {m}");
        // sum <= 0 -> 0.0
        assert_eq!(fee_apy_annualized(&[-1.0, 0.5]), 0.0);
    }

    #[test]
    fn calculate_cumulative_hand_computed_two_days() {
        // day0{1,1,1,0} day1{4,1,3,86400}: cumulative=1.0, duration=2, annualized=182.5.
        let daily = vec![
            CumPoint {
                long: 1.0,
                short: 1.0,
                pool: 1.0,
                day_timestamp: 0,
            },
            CumPoint {
                long: 4.0,
                short: 1.0,
                pool: 3.0,
                day_timestamp: 86_400,
            },
        ];
        let (charts, ann) = calculate_cumulative(&daily);
        assert_eq!(charts.len(), 2);
        assert_eq!(charts[0].time_stamp, 0);
        assert_eq!(charts[0].ydata, 0.0); // first point is always 0.0
        assert_eq!(charts[1].time_stamp, 86_400);
        assert!(
            (charts[1].ydata - 1.0).abs() < 1e-12,
            "got {}",
            charts[1].ydata
        );
        assert!((ann - 182.5).abs() < 1e-9, "got {ann}");
    }

    /// Freshest-per-day wins (sqd DESC), ascending, raw string kept, window-filtered.
    #[test]
    fn shape_gm_prices_emits_ascending_one_per_day_keeps_raw_string() {
        let rows = vec![
            gm_row("MT1", "1.0412", "2026-02-06T05:00:00.000000Z"),
            gm_row("MT1", "1.0400", "2026-02-06T01:00:00.000000Z"),
            gm_row("MT1", "1.0234", "2026-02-05T03:00:00.000000Z"),
        ];
        let out = shape_gm_prices(&rows, ALL);
        assert_eq!(out.len(), 2);
        assert!(out[0].time_stamp < out[1].time_stamp);
        assert_eq!(out[0].ydata, "1.0234");
        assert_eq!(out[1].ydata, "1.0412");
        assert_eq!(out[0].time_stamp % SECS_PER_DAY, 0);
    }

    /// feeApy annualization is the MEAN of daily values, charts ascending.
    #[test]
    fn shape_fee_apy_annualized_is_mean_and_charts_ascending() {
        let rows = vec![
            apy_row("MT1", "0.0842", "2026-02-06T00:00:00.000000Z"),
            apy_row("MT1", "0.08", "2026-02-05T00:00:00.000000Z"),
        ];
        let pool = shape_fee_apy("MT1", &rows, ALL).unwrap();
        assert_eq!(pool.token_address, "MT1");
        assert!(
            (pool.annualized - 0.0821).abs() < 1e-12,
            "got {}",
            pool.annualized
        );
        assert_eq!(pool.line_charts.len(), 2);
        assert!(pool.line_charts[0].time_stamp < pool.line_charts[1].time_stamp);
    }

    /// The accumulated-zset path: mean over in-window days with days before `window_start` dropped.
    #[test]
    fn shape_fee_apy_from_daily_means_in_window_and_drops_older() {
        use std::collections::BTreeMap;
        let by_day: BTreeMap<i64, f64> = BTreeMap::from([
            (1_000, 0.10), // before window -> dropped
            (2_000, 0.08),
            (3_000, 0.0842),
        ]);
        let pool = shape_fee_apy_from_daily("MT1", &by_day, 2_000).unwrap();
        assert_eq!(pool.token_address, "MT1");
        assert_eq!(pool.line_charts.len(), 2); // 1_000 dropped
        assert_eq!(pool.line_charts[0].time_stamp, 2_000);
        assert_eq!(pool.line_charts[1].time_stamp, 3_000); // ascending
        assert!(
            (pool.annualized - 0.0821).abs() < 1e-12,
            "got {}",
            pool.annualized
        );
        // All days before the window -> None (no pool emitted).
        assert!(shape_fee_apy_from_daily("MT1", &by_day, 9_999).is_none());
    }

    /// GLV feeApy reuses `shape_fee_apy` on `glvInfoDailies` rows, one freshest row per UTC day annualized by mean.
    #[test]
    fn shape_fee_apy_reduces_glv_daily_rows_to_mean() {
        let rows = vec![
            glv_apy_row("GLV1", "0.0842", "2026-02-06T00:05:00.000000Z"), // day1 fresh
            glv_apy_row("GLV1", "0.0500", "2026-02-06T00:00:00.000000Z"), // day1 dup (dropped)
            glv_apy_row("GLV1", "0.08", "2026-02-05T00:00:00.000000Z"),   // day0
        ];
        let pool = shape_fee_apy("GLV1", &rows, ALL).unwrap();
        assert_eq!(pool.token_address, "GLV1");
        assert_eq!(pool.line_charts.len(), 2); // two distinct UTC days
        assert!(
            (pool.annualized - 0.0821).abs() < 1e-12,
            "got {}",
            pool.annualized
        );
    }

    #[test]
    fn join_cum_points_joins_on_day_and_skips_unmatched_or_zero() {
        let hourly = vec![
            hourly_row("MT1", "4.0", "1.0", "2026-02-06T05:00:00.000000Z"), // day1 fresh
            hourly_row("MT1", "9.9", "9.9", "2026-02-06T01:00:00.000000Z"), // day1 stale (dropped)
            hourly_row("MT1", "1.0", "1.0", "2026-02-05T03:00:00.000000Z"), // day0
            hourly_row("MT1", "5.0", "5.0", "2026-02-04T03:00:00.000000Z"), // no gm match
            hourly_row("MT1", "0.0", "1.0", "2026-02-03T03:00:00.000000Z"), // zero long → skip
        ];
        let gm = vec![
            gm_row("MT1", "3.0", "2026-02-06T00:00:00.000000Z"), // day1
            gm_row("MT1", "1.0", "2026-02-05T00:00:00.000000Z"), // day0
            gm_row("MT1", "2.0", "2026-02-03T00:00:00.000000Z"), // matches the zero-long day
        ];
        let tp = reduce_token_prices_by_day(&hourly);
        let gmm = reduce_gm_prices_by_day(&gm);
        let joined = join_cum_points(&tp, &gmm, ALL);
        // day0 (1,1,1) and day1 (4,1,3) survive; day for 02-04 has no gm; zero-long day skipped.
        assert_eq!(joined.len(), 2);
        assert!(joined[0].day_timestamp < joined[1].day_timestamp);
        assert_eq!(joined[0].long, 1.0);
        assert_eq!(joined[0].pool, 1.0);
        assert_eq!(joined[1].long, 4.0); // freshest-per-day token price
        assert_eq!(joined[1].pool, 3.0);
        // and the cumulative over these two days reproduces the hand-computed result.
        let (_charts, ann) = calculate_cumulative(&joined);
        assert!((ann - 182.5).abs() < 1e-9, "got {ann}");
    }

    /// Raw `totalMinted`/timestamp preserved, one per day (freshest wins), day floored.
    #[test]
    fn shape_gt_updates_preserves_strings_one_per_day_freshest_wins() {
        let rows = vec![
            gt_row("1100000000000000000000", "2026-02-06T00:00:00.000000Z"),
            gt_row("1000000000000000000000", "2026-02-05T03:00:00.000000Z"),
            gt_row("999", "2026-02-05T01:00:00.000000Z"), // same day, staler -> dropped
        ];
        let out = shape_gt_updates(&rows);
        assert_eq!(out.len(), 2);
        assert!(out[0].day_timestamp < out[1].day_timestamp);
        assert_eq!(out[0].total_minted, "1000000000000000000000");
        assert_eq!(out[1].total_minted, "1100000000000000000000");
        assert_eq!(out[0].day_timestamp % SECS_PER_DAY, 0);
    }
}
