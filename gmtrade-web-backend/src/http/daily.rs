//! HTTP daily-data endpoints serving Redis-primary, falling back to the in-memory [`DailyCache`].

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::de::DeserializeOwned;

use crate::daily_refresh::dur_suffix;
use crate::dto::{GtUpdate, PoolLineData, PriceLineData};
use crate::state::{AppState, DailyCache};

/// Read a `SET`-stored daily series, `None` when Redis is disabled, missing, empty, or unparseable.
async fn read_string_series(state: &AppState, suffix: &str) -> Option<Vec<PoolLineData>> {
    let redis = state.redis.as_ref()?;
    let s = redis.get_string(suffix).await.ok()??;
    let v: Vec<PoolLineData> = serde_json::from_str(&s).ok()?;
    (!v.is_empty()).then_some(v)
}

/// Read a ZSet-stored daily series and return it ascending, `None` when Redis is disabled or empty.
async fn read_zset_asc<T: DeserializeOwned>(
    state: &AppState,
    suffix: &str,
    stop: isize,
) -> Option<Vec<T>> {
    let redis = state.redis.as_ref()?;
    let members = redis.zrevrange(suffix, 0, stop).await.ok()?;
    if members.is_empty() {
        return None;
    }
    let mut out: Vec<T> = members
        .iter()
        .filter_map(|m| serde_json::from_str(m).ok())
        .collect();
    out.reverse(); // ZREVRANGE is newest-first; the endpoints serve ascending.
    (!out.is_empty()).then_some(out)
}

/// Default duration window when `duration` is missing or not one of `30|90|180|all`.
const DEFAULT_DAYS: i64 = 30;

const GT_UPDATES_DEFAULT_LIMIT: i64 = 1000;
const GT_UPDATES_MAX_LIMIT: i64 = 5000;

/// Map `duration` to `days`: `"30"/"90"/"180"` → int, `"all"` → `-1`, else [`DEFAULT_DAYS`].
pub(crate) fn duration_to_days(duration: Option<&str>) -> i64 {
    match duration {
        Some("all") => -1,
        Some(s) => s.parse::<i64>().unwrap_or(DEFAULT_DAYS),
        None => DEFAULT_DAYS,
    }
}

/// Clamp a `gtUpdates` limit: `1..=5000` verbatim, else [`GT_UPDATES_DEFAULT_LIMIT`].
pub(crate) fn clamp_gt_limit(limit: Option<i64>) -> i64 {
    match limit {
        Some(l) if l > 0 && l <= GT_UPDATES_MAX_LIMIT => l,
        _ => GT_UPDATES_DEFAULT_LIMIT,
    }
}

/// Query params for `annPerformance` / `feeApy`; `duration` REQUIRED (missing → `400`).
#[derive(serde::Deserialize)]
pub struct DurationQuery {
    duration: String,
}

/// Query params for `gmPrices` / `glvPrices`; `token` and `duration` REQUIRED (missing → `400`).
#[derive(serde::Deserialize)]
pub struct PricesQuery {
    token: String,
    duration: String,
}

/// Query params for `gtUpdates` (`GtUpdatesReq`). `limit` is optional.
#[derive(serde::Deserialize)]
pub struct GtUpdatesQuery {
    #[serde(default)]
    limit: Option<i64>,
}

/// Serve a duration-keyed `PoolLineData` series: Redis SET primary, in-memory [`DailyCache`] fallback.
async fn duration_pool_series(
    state: &AppState,
    duration: &str,
    redis_prefix: &str,
    pick: impl Fn(&DailyCache, i64) -> Vec<PoolLineData>,
) -> Json<Vec<PoolLineData>> {
    let days = duration_to_days(Some(duration));
    let suffix = format!("{redis_prefix}{}", dur_suffix(days));
    if let Some(v) = read_string_series(state, &suffix).await {
        return Json(v);
    }
    Json(pick(&state.daily_cache(), days))
}

/// Serve a per-token `PriceLineData` series: Redis ZSet primary (newest `days + 1`), in-memory fallback.
async fn token_price_series(
    state: &AppState,
    q: &PricesQuery,
    redis_prefix: &str,
    pick: impl Fn(&DailyCache, &str, i64) -> Vec<PriceLineData>,
) -> Json<Vec<PriceLineData>> {
    let days = duration_to_days(Some(&q.duration));
    // `stop = days` slices the newest `days + 1` points (`-1` = the whole set).
    let stop = if days < 0 { -1 } else { days as isize };
    let suffix = format!("{redis_prefix}{}", q.token);
    if let Some(v) = read_zset_asc::<PriceLineData>(state, &suffix, stop).await {
        return Json(v);
    }
    Json(pick(&state.daily_cache(), &q.token, days))
}

/// `GET /v2/cache/daily/annPerformance` — cumulative-performance `PoolLineData`.
pub async fn ann_performance(
    State(state): State<AppState>,
    Query(q): Query<DurationQuery>,
) -> Result<Json<Vec<PoolLineData>>, StatusCode> {
    crate::http::check_param_len(&q.duration, state.config.limits.max_param_len)?;
    Ok(duration_pool_series(
        &state,
        &q.duration,
        "v2:daily:ann_performance_cache:",
        |c, days| c.ann_performance.get(&days).cloned().unwrap_or_default(),
    )
    .await)
}

/// `GET /v2/cache/daily/feeApy` — mean-annualized fee-APY `PoolLineData`.
pub async fn fee_apy(
    State(state): State<AppState>,
    Query(q): Query<DurationQuery>,
) -> Result<Json<Vec<PoolLineData>>, StatusCode> {
    crate::http::check_param_len(&q.duration, state.config.limits.max_param_len)?;
    Ok(
        duration_pool_series(&state, &q.duration, "v2:daily:fee_apy_cache:", |c, days| {
            c.fee_apy.get(&days).cloned().unwrap_or_default()
        })
        .await,
    )
}

/// `GET /v2/cache/daily/gmPrices` — GM-price daily series, keyed on `(token, days)`.
pub async fn gm_prices(
    State(state): State<AppState>,
    Query(q): Query<PricesQuery>,
) -> Result<Json<Vec<PriceLineData>>, StatusCode> {
    crate::http::check_pubkey(&q.token, state.config.limits.max_param_len)?;
    crate::http::check_param_len(&q.duration, state.config.limits.max_param_len)?;
    Ok(
        token_price_series(&state, &q, "v2:daily:gm_price_cache:", |c, token, days| {
            c.gm_prices
                .get(&(token.to_string(), days))
                .cloned()
                .unwrap_or_default()
        })
        .await,
    )
}

/// `GET /v2/cache/daily/glvPrices` — GLV-price daily series, keyed on `(token, days)`.
pub async fn glv_prices(
    State(state): State<AppState>,
    Query(q): Query<PricesQuery>,
) -> Result<Json<Vec<PriceLineData>>, StatusCode> {
    crate::http::check_pubkey(&q.token, state.config.limits.max_param_len)?;
    crate::http::check_param_len(&q.duration, state.config.limits.max_param_len)?;
    Ok(
        token_price_series(&state, &q, "v2:daily:glv_price_cache:", |c, token, days| {
            c.glv_prices
                .get(&(token.to_string(), days))
                .cloned()
                .unwrap_or_default()
        })
        .await,
    )
}

/// `GET /v2/cache/daily/gtUpdates` — GT-mint daily series, truncated to newest `limit` rows.
pub async fn gt_updates(
    State(state): State<AppState>,
    Query(q): Query<GtUpdatesQuery>,
) -> Json<Vec<GtUpdate>> {
    let limit = clamp_gt_limit(q.limit) as usize;
    // Newest `limit` rows from the global zset, returned ascending by day.
    if let Some(v) =
        read_zset_asc::<GtUpdate>(&state, "v2:daily:gt_updates_cache", limit as isize - 1).await
    {
        return Json(v);
    }
    let cache = state.daily_cache();
    let all = &cache.gt_updates;
    // Memory fallback: keep the newest `limit` rows (tail; series ascending by day).
    let start = all.len().saturating_sub(limit);
    Json(all[start..].to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duration_to_days_maps_known_durations() {
        assert_eq!(duration_to_days(Some("30")), 30);
        assert_eq!(duration_to_days(Some("90")), 90);
        assert_eq!(duration_to_days(Some("180")), 180);
        assert_eq!(duration_to_days(Some("all")), -1);
        assert_eq!(duration_to_days(None), 30);
    }

    #[test]
    fn clamp_gt_limit_falls_back_for_zero_negative_or_over_cap() {
        // Negative, zero, or over-cap limits clamp to the default 1000.
        assert_eq!(clamp_gt_limit(Some(0)), 1000);
        assert_eq!(clamp_gt_limit(Some(-1)), 1000);
        assert_eq!(clamp_gt_limit(Some(5001)), 1000);
    }
}
