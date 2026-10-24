//! The daily-data pre-aggregation ticker: pre-computes `GET /v2/cache/daily/*` into [`AppState::daily_cache`].

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::dto::{GtUpdate, PoolLineData, PriceLineData};
use crate::state::{AppState, DailyCache};
use crate::ticker::Cadence;
use crate::util::now_unix;

use crate::metrics;

/// Duration windows pre-warmed for every duration-keyed dataset (`-1` = all).
pub const DURATIONS: [i64; 4] = [30, 90, 180, -1];

/// Default `gtUpdates` row limit to pre-warm — the handler's `clamp_gt_limit` default when `limit` is absent.
pub const GT_UPDATES_PREWARM_LIMIT: i64 = 1000;

/// The last computed result of every dataset, kept between ticks so a not-due dataset still contributes its previous value.
#[derive(Clone, Default)]
pub struct DatasetState {
    pub ann_performance: HashMap<i64, Vec<PoolLineData>>,
    pub fee_apy: HashMap<i64, Vec<PoolLineData>>,
    pub gm_prices: HashMap<(String, i64), Vec<PriceLineData>>,
    pub glv_prices: HashMap<(String, i64), Vec<PriceLineData>>,
    pub gt_updates: Vec<GtUpdate>,
}

/// Build the published [`DailyCache`] blob from the per-dataset last results. PURE.
pub fn build_daily_cache(state: &DatasetState) -> DailyCache {
    DailyCache {
        ann_performance: state.ann_performance.clone(),
        fee_apy: state.fee_apy.clone(),
        gm_prices: state.gm_prices.clone(),
        glv_prices: state.glv_prices.clone(),
        gt_updates: state.gt_updates.clone(),
    }
}

/// Rebuild a keyed dataset over the current universe, keeping last-good on empty.
fn merge_keep_previous<K, V>(
    prev: &HashMap<K, Vec<V>>,
    current: impl IntoIterator<Item = (K, Vec<V>)>,
) -> HashMap<K, Vec<V>>
where
    K: std::hash::Hash + Eq + Clone,
    V: Clone,
{
    let mut out: HashMap<K, Vec<V>> = HashMap::new();
    for (key, fetched) in current {
        if !fetched.is_empty() {
            out.insert(key, fetched);
        } else if let Some(prev_val) = prev.get(&key) {
            out.insert(key, prev_val.clone());
        }
        // else: empty fetch + no previous → key stays absent (cold).
    }
    out
}

/// Keep-previous-on-empty for the single global `gtUpdates` Vec.
fn merge_keep_previous_gt(prev: &[GtUpdate], fetched: Vec<GtUpdate>) -> Vec<GtUpdate> {
    if fetched.is_empty() {
        prev.to_vec()
    } else {
        fetched
    }
}

/// Distinct market tokens across the live snapshot's index→market rollups.
fn snapshot_market_tokens(state: &AppState) -> Vec<String> {
    let snapshot = state.snapshot();
    let set: BTreeSet<String> = snapshot
        .index_infos
        .iter()
        .flat_map(|index| index.market_infos.iter())
        .map(|m| m.market_token.clone())
        .collect();
    set.into_iter().collect()
}

/// Refresh annPerformance over the snapshot's market-token universe for every duration.
async fn refresh_ann_performance(state: &AppState, ds: &mut DatasetState) {
    let tokens = snapshot_market_tokens(state);
    // GLV vaults: (glv_token, representative_market) derived on-chain from the Glv account.
    let glv_pairs: Vec<(String, String)> = state
        .glvs
        .load()
        .iter()
        .filter_map(|g| {
            g.representative_market
                .clone()
                .map(|m| (g.glv_token_address.clone(), m))
        })
        .collect();
    if tokens.is_empty() && glv_pairs.is_empty() {
        tracing::debug!("daily: ann_performance skipped (empty market+glv universe)");
        return;
    }
    // Full long/short history from the accumulated zsets; empty falls back to a live hourly fetch.
    let override_map = read_mtp_override(state, &ann_market_universe(state)).await;
    let override_ref = (!override_map.is_empty()).then_some(&override_map);
    // GM/GLV pool prices from the accumulated `gm_price_cache`/`glv_price_cache` zsets, so a flaky sqd no
    // longer drops tokens from the ann series (mirrors the long/short override; live fetch only when empty).
    let gm_pool = read_pool_price_override(state, "v2:daily:gm_price_cache:", &tokens).await;
    let gm_pool_ref = (!gm_pool.is_empty()).then_some(&gm_pool);
    let glv_token_list: Vec<String> = glv_pairs.iter().map(|(g, _)| g.clone()).collect();
    let glv_pool =
        read_pool_price_override(state, "v2:daily:glv_price_cache:", &glv_token_list).await;
    let glv_pool_ref = (!glv_pool.is_empty()).then_some(&glv_pool);
    let mut fetched = Vec::with_capacity(DURATIONS.len());
    for &days in &DURATIONS {
        fetched.push((
            days,
            state
                .sqd
                .ann_performance(
                    &tokens,
                    &glv_pairs,
                    days,
                    override_ref,
                    gm_pool_ref,
                    glv_pool_ref,
                )
                .await,
        ));
    }
    ds.ann_performance = merge_keep_previous(&ds.ann_performance, fetched);
}

/// Refresh feeApy for every duration over the snapshot's market-token universe plus the GLV universe.
async fn refresh_fee_apy(state: &AppState, ds: &mut DatasetState) {
    let tokens = snapshot_market_tokens(state);
    let glv_tokens: Vec<String> = state
        .glvs
        .load()
        .iter()
        .map(|g| g.glv_token_address.clone())
        .collect();
    if tokens.is_empty() && glv_tokens.is_empty() {
        tracing::debug!("daily: fee_apy skipped (empty market+glv universe)");
        return;
    }
    // Full daily-apy history from the accumulated zsets; empty falls back to a live sqd fetch.
    let override_map = read_apy_override(state, &tokens, &glv_tokens).await;
    let override_ref = (!override_map.is_empty()).then_some(&override_map);
    let mut fetched = Vec::with_capacity(DURATIONS.len());
    for &days in &DURATIONS {
        fetched.push((
            days,
            state
                .sqd
                .fee_apy(&tokens, &glv_tokens, days, override_ref)
                .await,
        ));
    }
    ds.fee_apy = merge_keep_previous(&ds.fee_apy, fetched);
}

/// Refresh gmPrices and glvPrices per `(token, duration)`, each via [`merge_keep_previous`].
async fn refresh_prices(state: &AppState, ds: &mut DatasetState) {
    let market_tokens = snapshot_market_tokens(state);
    let mut gm_fetched = Vec::with_capacity(market_tokens.len() * DURATIONS.len());
    for token in &market_tokens {
        for &days in &DURATIONS {
            let series = state.sqd.gm_prices(token, days).await;
            gm_fetched.push(((token.clone(), days), series));
        }
    }
    // Only rebuild gmPrices when we have a universe, else an empty snapshot wipes the warm cache.
    if !market_tokens.is_empty() {
        ds.gm_prices = merge_keep_previous(&ds.gm_prices, gm_fetched);
    }

    let glvs = state.glvs.load();
    let mut glv_fetched = Vec::with_capacity(glvs.len() * DURATIONS.len());
    for glv in glvs.iter() {
        for &days in &DURATIONS {
            let series = state.sqd.glv_prices(&glv.glv_token_address, days).await;
            glv_fetched.push(((glv.glv_token_address.clone(), days), series));
        }
    }
    if !glvs.is_empty() {
        ds.glv_prices = merge_keep_previous(&ds.glv_prices, glv_fetched);
    }
}

/// Refresh the global gtUpdates feed at the pre-warm default limit, keep-previous-on-empty.
async fn refresh_gt_updates(state: &AppState, ds: &mut DatasetState) {
    let fetched = state.sqd.gt_updates(GT_UPDATES_PREWARM_LIMIT).await;
    ds.gt_updates = merge_keep_previous_gt(&ds.gt_updates, fetched);
}

/// Day count at which the gt zset is considered already backfilled (skip the backfill).
const GT_BACKFILL_HAVE_DAYS: isize = 14;

/// One-time backfill of the full `gtUpdates` daily history into the accumulating zset, returning whether it is complete.
async fn backfill_gt_history(state: &AppState) -> bool {
    let Some(redis) = &state.redis else {
        return true;
    };
    let existing = redis
        .zrevrange("v2:daily:gt_updates_cache", 0, GT_BACKFILL_HAVE_DAYS - 1)
        .await
        .unwrap_or_default();
    if existing.len() >= GT_BACKFILL_HAVE_DAYS as usize {
        return true;
    }
    let history = state.sqd.gt_updates_backfill().await;
    if history.is_empty() {
        return false;
    }
    write_gt_to_redis(state, &history).await;
    tracing::info!(days = history.len(), "gtUpdates history backfill complete");
    true
}

// annPerformance long/short accumulation: accumulate one freshest-per-day row per token into a zset and read the full series back.

// Per-token backfill row limit, concurrency, and timeout are config-driven so they can be retuned without a rebuild.
const MTP_BACKFILL_RETRIES: usize = 3;
/// Max convergence rounds per backfill call (each round re-fetches not-yet-done tokens).
const MTP_BACKFILL_MAX_ROUNDS: usize = 6;
/// Consecutive "reached no earlier" fetches required before a token is marked done.
const MTP_BACKFILL_CONFIRMS: u32 = 2;
/// Incremental hourly rows per token (~4 days) to keep today + recent days fresh.
const MTP_INCREMENTAL_HOURS_PER_TOKEN: i64 = 96;
/// Upper bound when reading a token's accumulated daily series (well above ~470 days).
const MTP_READ_MAX: isize = 100_000;

/// OLD `market_token_price:` zset member format (`dayTimestamp` is the score).
#[derive(serde::Serialize, serde::Deserialize)]
struct MarketTokenPriceDay {
    #[serde(rename = "longTokenPrice")]
    long_token_price: String,
    #[serde(rename = "shortTokenPrice")]
    short_token_price: String,
    #[serde(rename = "marketToken")]
    market_token: String,
    timestamp: String,
    #[serde(rename = "dayTimestamp")]
    day_timestamp: i64,
}

/// Market tokens whose long/short we accumulate: every market token plus each GLV's representative market.
fn ann_market_universe(state: &AppState) -> Vec<String> {
    let mut set: BTreeSet<String> = snapshot_market_tokens(state).into_iter().collect();
    for g in state.glvs.load().iter() {
        if let Some(m) = &g.representative_market {
            set.insert(m.clone());
        }
    }
    set.into_iter().collect()
}

/// One reduced daily long/short row: `(market_token, day_timestamp, long, short, timestamp)`.
type MtpRow = (String, i64, String, String, String);

/// Upsert reduced daily long/short rows into `v2:daily:market_token_price:{token}`.
async fn write_mtp_to_redis(state: &AppState, rows: &[MtpRow]) {
    let Some(redis) = &state.redis else {
        return;
    };
    let batch: Vec<_> = rows
        .iter()
        .filter_map(|(token, day, long, short, ts)| {
            let member = MarketTokenPriceDay {
                long_token_price: long.clone(),
                short_token_price: short.clone(),
                market_token: token.clone(),
                timestamp: ts.clone(),
                day_timestamp: *day,
            };
            serde_json::to_string(&member).ok().map(|s| {
                (
                    format!("v2:daily:market_token_price:{token}"),
                    *day as f64,
                    s,
                )
            })
        })
        .collect();
    if let Err(e) = redis.zadd_upsert_many(&batch).await {
        tracing::warn!(error = %e, count = batch.len(), "redis market_token_price write failed");
    }
}

/// Convergence step for one fetched token, returning the new confirm count and whether it is now complete.
fn mtp_convergence(before: Option<i64>, fetch_min: i64, confirms: u32) -> (u32, bool) {
    if before.is_none_or(|b| fetch_min < b) {
        (0, false) // extended history (or first fetch) -> not yet converged
    } else {
        let c = confirms + 1;
        (c, c >= MTP_BACKFILL_CONFIRMS)
    }
}

/// Full-history backfill of the long/short zsets by convergence (merge-never-wipe, looping until done).
async fn backfill_market_token_prices(state: &AppState, done: &mut HashSet<String>) {
    use futures_util::StreamExt;

    if state.redis.is_none() {
        return;
    }
    let limit = state.config.daily_mtp_backfill_limit;
    let concurrency = state.config.daily_mtp_backfill_concurrency.max(1);
    let timeout = Duration::from_secs(state.config.daily_mtp_fetch_timeout_secs.max(1));
    // Per-token convergence state for THIS call (driven by fetch results, no Redis reads).
    let mut earliest_seen: HashMap<String, i64> = HashMap::new();
    let mut confirms: HashMap<String, u32> = HashMap::new();

    for round in 0..MTP_BACKFILL_MAX_ROUNDS {
        let todo: Vec<String> = ann_market_universe(state)
            .into_iter()
            .filter(|t| !done.contains(t))
            .collect();
        if todo.is_empty() {
            break;
        }

        let results: Vec<(String, Vec<MtpRow>)> = futures_util::stream::iter(todo)
            .map(|token| async move {
                let mut rows = Vec::new();
                for _ in 0..MTP_BACKFILL_RETRIES {
                    // Hard timeout so one stalled upstream query can never wedge the daily loop.
                    rows = tokio::time::timeout(
                        timeout,
                        state
                            .sqd
                            .market_token_prices_daily(std::slice::from_ref(&token), limit),
                    )
                    .await
                    .unwrap_or_default();
                    if !rows.is_empty() {
                        break;
                    }
                }
                (token, rows)
            })
            .buffer_unordered(concurrency)
            .collect()
            .await;

        let mut all_rows = Vec::new();
        let mut progressed = false;
        let mut newly_done = 0;
        for (token, rows) in results {
            if rows.is_empty() {
                continue; // hard failure; left un-done -> retried next round
            }
            progressed = true;
            let fetch_min = rows.iter().map(|r| r.1).min().unwrap_or(i64::MAX);
            all_rows.extend(rows);
            let before = earliest_seen.get(&token).copied();
            let prior = confirms.get(&token).copied().unwrap_or(0);
            let (new_confirms, is_done) = mtp_convergence(before, fetch_min, prior);
            confirms.insert(token.clone(), new_confirms);
            if before.is_none_or(|b| fetch_min < b) {
                earliest_seen.insert(token.clone(), fetch_min); // track the earliest ever seen
            }
            if is_done {
                done.insert(token);
                newly_done += 1;
            }
        }
        if !all_rows.is_empty() {
            write_mtp_to_redis(state, &all_rows).await;
        }
        tracing::info!(
            round,
            newly_done,
            tokens_done = done.len(),
            rows = all_rows.len(),
            "market_token_price backfill round"
        );
        if !progressed {
            break; // every remaining token failed this round -> bail, retry next ann tick
        }
    }
}

/// Incremental: refresh the last few days of long/short into the zsets each ann cadence.
async fn refresh_market_token_prices(state: &AppState) {
    if state.redis.is_none() {
        return;
    }
    let tokens = ann_market_universe(state);
    if tokens.is_empty() {
        return;
    }
    let limit = tokens.len() as i64 * MTP_INCREMENTAL_HOURS_PER_TOKEN;
    let rows = state.sqd.market_token_prices_daily(&tokens, limit).await;
    write_mtp_to_redis(state, &rows).await;
}

/// Read each token's accumulated daily zset under `key_prefix` into `token -> (day -> V)`, parsing each member via `parse` and dropping tokens with no rows.
async fn read_token_zset<V>(
    redis: &crate::redis_store::RedisStore,
    key_prefix: &str,
    tokens: &[String],
    parse: impl Fn(&str) -> Option<(i64, V)>,
) -> HashMap<String, BTreeMap<i64, V>> {
    let mut map = HashMap::new();
    for token in tokens {
        let members = redis
            .zrangebyscore_limit(
                &format!("{key_prefix}{token}"),
                "-inf",
                "+inf",
                0,
                MTP_READ_MAX,
            )
            .await
            .unwrap_or_default();
        let mut by_day: BTreeMap<i64, V> = BTreeMap::new();
        for m in members {
            if let Some((day, v)) = parse(&m) {
                by_day.insert(day, v);
            }
        }
        if !by_day.is_empty() {
            map.insert(token.clone(), by_day);
        }
    }
    map
}

/// Read each token's accumulated daily long/short series from Redis into the map `annPerformance` consumes.
async fn read_mtp_override(
    state: &AppState,
    tokens: &[String],
) -> HashMap<String, BTreeMap<i64, (String, String)>> {
    let Some(redis) = &state.redis else {
        return HashMap::new();
    };
    read_token_zset(redis, "v2:daily:market_token_price:", tokens, |m| {
        serde_json::from_str::<MarketTokenPriceDay>(m)
            .ok()
            .map(|p| (p.day_timestamp, (p.long_token_price, p.short_token_price)))
    })
    .await
}

/// Read each token's accumulated daily pool-price series from the `gm_price_cache`/`glv_price_cache` zsets
/// into `token -> (day -> price)` — the GM/GLV leg of annPerformance, so ann reads it from Redis instead of live sqd.
async fn read_pool_price_override(
    state: &AppState,
    key_prefix: &str,
    tokens: &[String],
) -> HashMap<String, BTreeMap<i64, String>> {
    let Some(redis) = &state.redis else {
        return HashMap::new();
    };
    read_token_zset(redis, key_prefix, tokens, |m| {
        serde_json::from_str::<PriceLineData>(m)
            .ok()
            .map(|p| (p.time_stamp, p.ydata))
    })
    .await
}

// feeApy daily-apy accumulation: accumulate one freshest-per-day apy row per token into per-token zsets and read the full series back.

/// Recent daily-apy rows per token to upsert each feeApy cadence (one row ~= one day).
const APY_INCREMENTAL_ROWS_PER_TOKEN: i64 = 8;

/// Day count at which a token's apy zset is treated as fully backfilled and skipped (sqd revises spike-day apy).
const APY_BACKFILL_HAVE_DAYS: isize = 30;

/// One reduced daily apy row: `(token, day_timestamp, apy, timestamp)`.
type ApyDayRow = (String, i64, String, String);

/// OLD `gm_apy_cache:` zset member (`dayTimestamp` is the score).
#[derive(serde::Serialize, serde::Deserialize)]
struct GmApyDay {
    #[serde(rename = "marketToken")]
    market_token: String,
    apy: String,
    timestamp: String,
    #[serde(rename = "dayTimestamp")]
    day_timestamp: i64,
}

/// OLD `glv_apy_cache:` zset member (GLV uses `glvToken`, not `marketToken`).
#[derive(serde::Serialize, serde::Deserialize)]
struct GlvApyDay {
    #[serde(rename = "glvToken")]
    glv_token: String,
    apy: String,
    timestamp: String,
    #[serde(rename = "dayTimestamp")]
    day_timestamp: i64,
}

/// The feeApy token universe tagged by feed: market tokens (`false`) plus each GLV token (`true`).
fn apy_universe(state: &AppState) -> Vec<(String, bool)> {
    let mut v: Vec<(String, bool)> = snapshot_market_tokens(state)
        .into_iter()
        .map(|t| (t, false))
        .collect();
    for g in state.glvs.load().iter() {
        v.push((g.glv_token_address.clone(), true));
    }
    v
}

/// Upsert reduced daily apy rows into per-token zsets under `key_prefix` (score = day), serializing each via `make_member`.
async fn upsert_apy_rows<M: serde::Serialize>(
    redis: &crate::redis_store::RedisStore,
    key_prefix: &str,
    rows: &[ApyDayRow],
    make_member: impl Fn(&str, &str, &str, i64) -> M,
    fail_msg: &str,
) {
    let batch: Vec<_> = rows
        .iter()
        .filter_map(|(token, day, apy, ts)| {
            let member = make_member(token, apy, ts, *day);
            serde_json::to_string(&member)
                .ok()
                .map(|s| (format!("{key_prefix}{token}"), *day as f64, s))
        })
        .collect();
    if let Err(e) = redis.zadd_upsert_many(&batch).await {
        tracing::warn!(error = %e, count = batch.len(), "{}", fail_msg);
    }
}

/// Upsert reduced daily apy rows into the per-token zsets (market vs GLV, score = day).
async fn write_apy_to_redis(state: &AppState, market_rows: &[ApyDayRow], glv_rows: &[ApyDayRow]) {
    let Some(redis) = &state.redis else {
        return;
    };
    upsert_apy_rows(
        redis,
        "v2:daily:gm_apy_cache:",
        market_rows,
        |token, apy, ts, day| GmApyDay {
            market_token: token.to_string(),
            apy: apy.to_string(),
            timestamp: ts.to_string(),
            day_timestamp: day,
        },
        "redis gm_apy write failed",
    )
    .await;
    upsert_apy_rows(
        redis,
        "v2:daily:glv_apy_cache:",
        glv_rows,
        |token, apy, ts, day| GlvApyDay {
            glv_token: token.to_string(),
            apy: apy.to_string(),
            timestamp: ts.to_string(),
            day_timestamp: day,
        },
        "redis glv_apy write failed",
    )
    .await;
}

/// Full-history backfill of the daily-apy zsets by convergence, the feeApy twin of [`backfill_market_token_prices`].
async fn backfill_apy(state: &AppState, done: &mut HashSet<String>) {
    use futures_util::StreamExt;

    if state.redis.is_none() {
        return;
    }
    let limit = state.config.daily_mtp_backfill_limit;
    let concurrency = state.config.daily_mtp_backfill_concurrency.max(1);
    let timeout = Duration::from_secs(state.config.daily_mtp_fetch_timeout_secs.max(1));
    let mut earliest_seen: HashMap<String, i64> = HashMap::new();
    let mut confirms: HashMap<String, u32> = HashMap::new();

    // Freeze guard: mark already-full tokens done so their frozen per-day apy is never overwritten.
    if let Some(redis) = &state.redis {
        for (token, is_glv) in apy_universe(state) {
            if done.contains(&token) {
                continue;
            }
            let key = if is_glv {
                format!("v2:daily:glv_apy_cache:{token}")
            } else {
                format!("v2:daily:gm_apy_cache:{token}")
            };
            let have = redis
                .zrevrange(&key, 0, APY_BACKFILL_HAVE_DAYS - 1)
                .await
                .unwrap_or_default();
            if have.len() >= APY_BACKFILL_HAVE_DAYS as usize {
                done.insert(token);
            }
        }
    }

    for round in 0..MTP_BACKFILL_MAX_ROUNDS {
        let todo: Vec<(String, bool)> = apy_universe(state)
            .into_iter()
            .filter(|(t, _)| !done.contains(t))
            .collect();
        if todo.is_empty() {
            break;
        }

        let results: Vec<(String, bool, Vec<ApyDayRow>)> = futures_util::stream::iter(todo)
            .map(|(token, is_glv)| async move {
                let mut rows = Vec::new();
                for _ in 0..MTP_BACKFILL_RETRIES {
                    let fetch = async {
                        if is_glv {
                            state
                                .sqd
                                .glv_info_dailies_reduced(std::slice::from_ref(&token), limit)
                                .await
                        } else {
                            state
                                .sqd
                                .gm_info_dailies_reduced(std::slice::from_ref(&token), limit)
                                .await
                        }
                    };
                    rows = tokio::time::timeout(timeout, fetch)
                        .await
                        .unwrap_or_default();
                    if !rows.is_empty() {
                        break;
                    }
                }
                (token, is_glv, rows)
            })
            .buffer_unordered(concurrency)
            .collect()
            .await;

        let mut market_rows = Vec::new();
        let mut glv_rows = Vec::new();
        let mut progressed = false;
        let mut newly_done = 0;
        for (token, is_glv, rows) in results {
            if rows.is_empty() {
                continue; // hard failure; left un-done -> retried next round
            }
            progressed = true;
            let fetch_min = rows.iter().map(|r| r.1).min().unwrap_or(i64::MAX);
            if is_glv {
                glv_rows.extend(rows);
            } else {
                market_rows.extend(rows);
            }
            let before = earliest_seen.get(&token).copied();
            let prior = confirms.get(&token).copied().unwrap_or(0);
            let (new_confirms, is_done) = mtp_convergence(before, fetch_min, prior);
            confirms.insert(token.clone(), new_confirms);
            if before.is_none_or(|b| fetch_min < b) {
                earliest_seen.insert(token.clone(), fetch_min);
            }
            if is_done {
                done.insert(token);
                newly_done += 1;
            }
        }
        if !market_rows.is_empty() || !glv_rows.is_empty() {
            write_apy_to_redis(state, &market_rows, &glv_rows).await;
        }
        tracing::info!(
            round,
            newly_done,
            tokens_done = done.len(),
            rows = market_rows.len() + glv_rows.len(),
            "gm/glv apy backfill round"
        );
        if !progressed {
            break;
        }
    }
}

/// Incremental: upsert the last few days of apy into the zsets each feeApy cadence.
async fn refresh_apy_incremental(state: &AppState) {
    if state.redis.is_none() {
        return;
    }
    let market = snapshot_market_tokens(state);
    let glv: Vec<String> = state
        .glvs
        .load()
        .iter()
        .map(|g| g.glv_token_address.clone())
        .collect();
    if market.is_empty() && glv.is_empty() {
        return;
    }
    let mut market_rows = Vec::new();
    if !market.is_empty() {
        let limit = market.len() as i64 * APY_INCREMENTAL_ROWS_PER_TOKEN;
        market_rows = state.sqd.gm_info_dailies_reduced(&market, limit).await;
    }
    let mut glv_rows = Vec::new();
    if !glv.is_empty() {
        let limit = glv.len() as i64 * APY_INCREMENTAL_ROWS_PER_TOKEN;
        glv_rows = state.sqd.glv_info_dailies_reduced(&glv, limit).await;
    }
    write_apy_to_redis(state, &market_rows, &glv_rows).await;
}

/// Read each token's accumulated daily-apy series from Redis into the map `feeApy` consumes (`token -> day -> apy`).
async fn read_apy_override(
    state: &AppState,
    market_tokens: &[String],
    glv_tokens: &[String],
) -> crate::sources::sqd::TokenDailyApy {
    let Some(redis) = &state.redis else {
        return HashMap::new();
    };
    let mut map = read_token_zset(redis, "v2:daily:gm_apy_cache:", market_tokens, |m| {
        serde_json::from_str::<GmApyDay>(m)
            .ok()
            .and_then(|d| d.apy.parse::<f64>().ok().map(|v| (d.day_timestamp, v)))
    })
    .await;
    let glv = read_token_zset(redis, "v2:daily:glv_apy_cache:", glv_tokens, |m| {
        serde_json::from_str::<GlvApyDay>(m)
            .ok()
            .and_then(|d| d.apy.parse::<f64>().ok().map(|v| (d.day_timestamp, v)))
    })
    .await;
    map.extend(glv);
    map
}

/// Suffix for duration-keyed daily keys: `-1` → `all`, else the day count.
pub(crate) fn dur_suffix(days: i64) -> String {
    if days < 0 {
        "all".to_string()
    } else {
        days.to_string()
    }
}

// Per-dataset Redis writers (best-effort, no-op when Redis is disabled, split so a skipped dataset is never overwritten empty).

/// annPerformance: SET per duration = JSON array of `PoolLineData`.
async fn write_ann_to_redis(state: &AppState, ds: &DatasetState) {
    let Some(redis) = &state.redis else {
        return;
    };
    for (days, pools) in &ds.ann_performance {
        if let Ok(json) = serde_json::to_string(pools) {
            let suffix = format!("v2:daily:ann_performance_cache:{}", dur_suffix(*days));
            if let Err(e) = redis.set_string(&suffix, &json).await {
                tracing::warn!(error = %e, %suffix, "redis daily write failed");
            }
        }
    }
}

/// feeApy: SET per duration = JSON array of `PoolLineData`.
async fn write_fee_apy_to_redis(state: &AppState, ds: &DatasetState) {
    let Some(redis) = &state.redis else {
        return;
    };
    for (days, pools) in &ds.fee_apy {
        if let Ok(json) = serde_json::to_string(pools) {
            let suffix = format!("v2:daily:fee_apy_cache:{}", dur_suffix(*days));
            if let Err(e) = redis.set_string(&suffix, &json).await {
                tracing::warn!(error = %e, %suffix, "redis daily write failed");
            }
        }
    }
}

/// gmPrices + glvPrices: per-token zset, day-keyed upsert (deepest window).
async fn write_prices_to_redis(state: &AppState, ds: &DatasetState) {
    let Some(redis) = &state.redis else {
        return;
    };
    write_price_zsets(redis, &ds.gm_prices, "v2:daily:gm_price_cache:").await;
    write_price_zsets(redis, &ds.glv_prices, "v2:daily:glv_price_cache:").await;
}

/// gtUpdates: single global zset, upsert by `dayTimestamp`.
async fn write_gt_to_redis(state: &AppState, gt_updates: &[GtUpdate]) {
    let Some(redis) = &state.redis else {
        return;
    };
    let batch: Vec<_> = gt_updates
        .iter()
        .filter_map(|gt| {
            serde_json::to_string(gt).ok().map(|member| {
                (
                    "v2:daily:gt_updates_cache".to_string(),
                    gt.day_timestamp as f64,
                    member,
                )
            })
        })
        .collect();
    if let Err(e) = redis.zadd_upsert_many(&batch).await {
        tracing::warn!(error = %e, count = batch.len(), "redis gtUpdates write failed");
    }
}

/// Upsert each token's deepest price series into its per-token zset (score = `timeStamp`).
async fn write_price_zsets(
    redis: &crate::redis_store::RedisStore,
    map: &HashMap<(String, i64), Vec<PriceLineData>>,
    key_prefix: &str,
) {
    let mut deepest: HashMap<&str, &Vec<PriceLineData>> = HashMap::new();
    for ((token, _days), series) in map {
        deepest
            .entry(token.as_str())
            .and_modify(|cur| {
                if series.len() > cur.len() {
                    *cur = series;
                }
            })
            .or_insert(series);
    }
    let mut batch = Vec::new();
    for (token, series) in deepest {
        let suffix = format!("{key_prefix}{token}");
        for row in series {
            if let Ok(member) = serde_json::to_string(row) {
                batch.push((suffix.clone(), row.time_stamp as f64, member));
            }
        }
    }
    if let Err(e) = redis.zadd_upsert_many(&batch).await {
        tracing::warn!(error = %e, count = batch.len(), "redis price write failed");
    }
}

// Keep the metric boundary in the production control flow. The runtime guard
// skips metric-specific work when critical-path metrics are disabled.
macro_rules! run_daily_cadence_attempt {
    ($worker:ident, before = $before:block, body = $body:block $(,)?) => {{
        $before
        let refresh = metrics::RefreshGuard::start(metrics::Worker::$worker);
        let changed = $body;
        refresh.finish_with(|| {
            if changed {
                metrics::RefreshResult::Completed
            } else {
                metrics::RefreshResult::Skipped
            }
        });
        changed
    }};
}

/// The daily-refresh loop: a 1s base ticker gates each dataset on its cadence, rebuilding+storing the blob when any changed.
pub async fn run_daily_refresh(state: AppState) {
    let cfg = &state.config;
    let mut ann = Cadence::new(cfg.daily_ann_secs);
    let mut fee_apy = Cadence::new(cfg.daily_fee_apy_secs);
    let mut gt_updates = Cadence::new(cfg.daily_gt_updates_secs);
    let mut prices = Cadence::new(cfg.daily_prices_secs);

    let mut ds = DatasetState::default();
    // One-shot history backfills (retried until they succeed, then never again).
    let mut gt_backfilled = false;
    // Per-token annPerformance long/short backfill progress (tokens fetched this process).
    let mut mtp_done: HashSet<String> = HashSet::new();
    // Per-token feeApy daily-apy backfill progress (tokens fetched this process).
    let mut apy_done: HashSet<String> = HashSet::new();

    let mut base = crate::ticker::interval(1);

    // Wait for the market list to be discovered before ticking, else the first tick runs over an empty universe.
    if snapshot_market_tokens(&state).is_empty() {
        tracing::info!("daily: waiting for market list discovery before first tick");
        while snapshot_market_tokens(&state).is_empty() {
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    }

    tracing::info!(
        daily_ann_secs = cfg.daily_ann_secs,
        daily_fee_apy_secs = cfg.daily_fee_apy_secs,
        daily_gt_updates_secs = cfg.daily_gt_updates_secs,
        daily_prices_secs = cfg.daily_prices_secs,
        markets = snapshot_market_tokens(&state).len(),
        "daily refresh loop started"
    );

    loop {
        base.tick().await;
        let now = Instant::now();
        let mut changed = false;

        // Each dataset: skip the sqd query when Redis already holds fresh data, else query, write its keys, and stamp freshness.
        if ann.due(now) {
            ann.mark(now);
            changed |= run_daily_cadence_attempt!(
                DailyAnn,
                // One-time full-history backfill of the long/short zsets annPerformance reads.
                before = {
                    backfill_market_token_prices(&state, &mut mtp_done).await;
                },
                body = {
                    if redis_already_fresh(&state, ANN_MARKER, state.config.daily_ann_secs).await {
                        false
                    } else {
                        refresh_market_token_prices(&state).await; // incremental upsert before compute
                        refresh_ann_performance(&state, &mut ds).await;
                        write_ann_to_redis(&state, &ds).await;
                        mark_fresh(&state, ANN_MARKER).await;
                        true
                    }
                },
            );
        }
        if fee_apy.due(now) {
            fee_apy.mark(now);
            changed |= run_daily_cadence_attempt!(
                DailyFeeApy,
                // One-time full-history backfill of the daily-apy zsets feeApy reads.
                before = {
                    backfill_apy(&state, &mut apy_done).await;
                },
                body = {
                    if redis_already_fresh(&state, FEE_APY_MARKER, state.config.daily_fee_apy_secs)
                        .await
                    {
                        false
                    } else {
                        refresh_apy_incremental(&state).await; // incremental upsert before compute
                        refresh_fee_apy(&state, &mut ds).await;
                        write_fee_apy_to_redis(&state, &ds).await;
                        mark_fresh(&state, FEE_APY_MARKER).await;
                        true
                    }
                },
            );
        }
        if gt_updates.due(now) {
            gt_updates.mark(now);
            changed |= run_daily_cadence_attempt!(
                DailyGtUpdates,
                // One-time full-history backfill into the accumulating zset; incremental below keeps today fresh.
                before = {
                    if !gt_backfilled {
                        gt_backfilled = backfill_gt_history(&state).await;
                    }
                },
                body = {
                    if redis_already_fresh(&state, GT_MARKER, state.config.daily_gt_updates_secs)
                        .await
                    {
                        false
                    } else {
                        refresh_gt_updates(&state, &mut ds).await;
                        write_gt_to_redis(&state, &ds.gt_updates).await;
                        mark_fresh(&state, GT_MARKER).await;
                        true
                    }
                },
            );
        }
        if prices.due(now) {
            prices.mark(now);
            changed |= run_daily_cadence_attempt!(
                DailyPrices,
                before = {},
                body = {
                    if redis_already_fresh(&state, PRICES_MARKER, state.config.daily_prices_secs)
                        .await
                    {
                        false
                    } else {
                        refresh_prices(&state, &mut ds).await;
                        write_prices_to_redis(&state, &ds).await;
                        mark_fresh(&state, PRICES_MARKER).await;
                        true
                    }
                },
            );
        }

        // Republish the in-memory cache (the Redis-disabled fallback path).
        if changed {
            state.daily_cache.store(Arc::new(build_daily_cache(&ds)));
        }
    }
}

/// Daily-dataset freshness markers (Redis): a `unix-ts` string stamped after each successful sqd refresh.
const ANN_MARKER: &str = "v2:daily:fresh:ann";
const FEE_APY_MARKER: &str = "v2:daily:fresh:fee_apy";
const GT_MARKER: &str = "v2:daily:fresh:gt";
const PRICES_MARKER: &str = "v2:daily:fresh:prices";

/// `true` when Redis is enabled and a fresh `marker` was written within `cadence_secs` (so the sqd query can be skipped).
async fn redis_already_fresh(state: &AppState, marker: &str, cadence_secs: u64) -> bool {
    let Some(redis) = &state.redis else {
        return false;
    };
    match redis.get_string(marker).await {
        Ok(Some(s)) => {
            let ts: i64 = s.parse().unwrap_or(0);
            now_unix() - ts < cadence_secs as i64
        }
        _ => false,
    }
}

/// Stamp a dataset's freshness marker with the current time (best-effort).
async fn mark_fresh(state: &AppState, marker: &str) {
    if let Some(redis) = &state.redis {
        if let Err(e) = redis.set_string(marker, &now_unix().to_string()).await {
            tracing::warn!(error = %e, marker, "redis daily freshness marker write failed");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::{LineChartData, PoolLineData, PriceLineData};

    #[tokio::test(start_paused = true)]
    async fn metrics_exclude_backfill_and_publish_before_a_later_worker_blocks() {
        use crate::metrics::{self, testing::Enabled, testing::RecordingRecorder};

        let _enabled = Enabled::new(true);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);

        let changed = run_daily_cadence_attempt!(
            DailyAnn,
            before = {
                let backfill =
                    metrics::UpstreamGuard::start(metrics::UpstreamOperation::SqdGtUpdatesBackfill);
                tokio::time::advance(Duration::from_secs(5)).await;
                backfill.finish(metrics::UpstreamResult::Success);
            },
            body = {
                tokio::time::advance(Duration::from_secs(2)).await;
                true
            },
        );
        assert!(changed);

        let events = recorder.take();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].name, metrics::UPSTREAM_DURATION);
        assert_eq!(events[0].value, 5.0);
        assert_eq!(events[1].name, metrics::REFRESH_DURATION);
        assert_eq!(events[1].value, 2.0);
        assert!(events[1]
            .labels
            .contains(&("worker".into(), "daily_ann".into())));
        assert!(events[1]
            .labels
            .contains(&("result".into(), "completed".into())));

        let mut later_worker = Box::pin(async {
            run_daily_cadence_attempt!(
                DailyFeeApy,
                before = {},
                body = {
                    std::future::pending::<()>().await;
                    true
                },
            )
        });
        assert!(futures_util::poll!(&mut later_worker).is_pending());
        tokio::time::advance(Duration::from_secs(30)).await;
        assert!(recorder.take().is_empty());
        drop(later_worker);
        assert!(recorder.take().is_empty());
    }

    #[test]
    fn market_token_price_member_matches_old_format() {
        // The zset member must serialize to OLD's exact JSON so prod can inherit OLD's zsets.
        let m = MarketTokenPriceDay {
            long_token_price: "1.5".to_string(),
            short_token_price: "1.0".to_string(),
            market_token: "MT1".to_string(),
            timestamp: "2025-03-09T23:00:00.000000Z".to_string(),
            day_timestamp: 1_741_478_400,
        };
        let json = serde_json::to_string(&m).unwrap();
        assert_eq!(
            json,
            r#"{"longTokenPrice":"1.5","shortTokenPrice":"1.0","marketToken":"MT1","timestamp":"2025-03-09T23:00:00.000000Z","dayTimestamp":1741478400}"#
        );
        // And an OLD-shaped member deserializes back (the inherit path).
        let back: MarketTokenPriceDay = serde_json::from_str(&json).unwrap();
        assert_eq!(back.long_token_price, "1.5");
        assert_eq!(back.day_timestamp, 1_741_478_400);
    }

    #[test]
    fn pool_price_zset_member_round_trips_for_ann_override() {
        // ann's GM/GLV pool-price override reads the `gm_price_cache`/`glv_price_cache` zsets, whose members
        // are `PriceLineData`; the read must parse a member back to the `(day, price)` ann joins on.
        let row = PriceLineData {
            time_stamp: 1_741_478_400,
            ydata: "1.5".to_string(),
        };
        let member = serde_json::to_string(&row).unwrap();
        let parsed = serde_json::from_str::<PriceLineData>(&member)
            .ok()
            .map(|p| (p.time_stamp, p.ydata));
        assert_eq!(parsed, Some((1_741_478_400, "1.5".to_string())));
    }

    #[test]
    fn mtp_convergence_extends_then_confirms_twice() {
        // CONFIRMS=2: needs two consecutive "no earlier" fetches to finish.
        let poisoned = 1_760_000_000; // a false floor already stored
        let truth = 1_745_000_000; // earlier (true inception)

        // Healthy fetch reaches earlier than the poisoned floor -> resets, not done.
        assert_eq!(mtp_convergence(Some(poisoned), truth, 0), (0, false));
        // Next fetch reaches no earlier than the now-stored truth -> confirm 1, not done.
        assert_eq!(mtp_convergence(Some(truth), truth, 0), (1, false));
        // Second consecutive confirm -> done.
        assert_eq!(mtp_convergence(Some(truth), truth, 1), (2, true));
        // A single non-earlier fetch alone never completes (guards against one bad floor).
        assert_eq!(mtp_convergence(Some(poisoned), poisoned, 0), (1, false));
        // Fresh token (nothing stored) is treated as "extended" -> never done on first sight.
        assert_eq!(mtp_convergence(None, truth, 0), (0, false));
    }

    fn pool(token: &str) -> PoolLineData {
        PoolLineData {
            token_address: token.to_string(),
            annualized: 0.1,
            line_charts: vec![LineChartData {
                time_stamp: 0,
                ydata: 0.0,
            }],
        }
    }

    fn price(ts: i64, y: &str) -> PriceLineData {
        PriceLineData {
            time_stamp: ts,
            ydata: y.to_string(),
        }
    }

    fn gt(ts: &str) -> GtUpdate {
        GtUpdate {
            total_minted: "1".to_string(),
            timestamp: ts.to_string(),
            day_timestamp: 0,
        }
    }

    #[test]
    fn build_daily_cache_copies_every_dataset() {
        let mut ds = DatasetState::default();
        ds.ann_performance.insert(30, vec![pool("MT1")]);
        ds.fee_apy.insert(-1, vec![pool("MT2")]);
        ds.gm_prices
            .insert(("MT1".to_string(), 90), vec![price(86_400, "1.5")]);
        ds.glv_prices
            .insert(("GLV1".to_string(), 180), vec![price(86_400, "0.9")]);
        ds.gt_updates = vec![gt("2026-02-05T00:00:00Z")];

        let cache = build_daily_cache(&ds);

        assert_eq!(
            cache.ann_performance.get(&30).unwrap()[0].token_address,
            "MT1"
        );
        assert_eq!(cache.fee_apy.get(&-1).unwrap()[0].token_address, "MT2");
        assert_eq!(
            cache.gm_prices.get(&("MT1".to_string(), 90)).unwrap()[0].ydata,
            "1.5"
        );
        assert_eq!(
            cache.glv_prices.get(&("GLV1".to_string(), 180)).unwrap()[0].ydata,
            "0.9"
        );
        assert_eq!(cache.gt_updates.len(), 1);
    }

    #[test]
    fn cadence_due_on_first_check_then_gates_on_interval() {
        let mut c = Cadence::new(10);
        let t0 = Instant::now();
        // First check: due immediately (warm right away).
        assert!(c.due(t0));
        c.mark(t0);
        assert!(!c.due(t0 + Duration::from_secs(5)));
        assert!(c.due(t0 + Duration::from_secs(10)));
    }

    #[test]
    fn merge_keeps_previous_when_fetch_empty_but_fresh_wins_otherwise() {
        let mut prev: HashMap<i64, Vec<PoolLineData>> = HashMap::new();
        prev.insert(30, vec![pool("X")]);
        // Empty fetch keeps prev; non-empty fetch overwrites.
        let kept = merge_keep_previous(&prev, vec![(30, Vec::<PoolLineData>::new())]);
        assert_eq!(kept.get(&30).unwrap()[0].token_address, "X");
        let fresh = merge_keep_previous(&prev, vec![(30, vec![pool("Y")])]);
        assert_eq!(fresh.get(&30).unwrap()[0].token_address, "Y");
    }
}
