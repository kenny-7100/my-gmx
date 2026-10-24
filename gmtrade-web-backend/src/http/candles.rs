//! HTTP `GET /v2/cache/prices/candles` on-demand candle endpoint.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde_json::Value;

use crate::dto::CandlesResp;
use crate::sources::candles::{clamp_limit, query_symbol_for};
use crate::state::AppState;

/// Query params for `GET /v2/cache/prices/candles`; `tokenSymbol`/`period` required (missing → 400).
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandlesQuery {
    token_symbol: String,
    period: String,
    #[serde(default)]
    limit: Option<u32>,
    // `direction`/`timestamp` query params are accepted but ignored (serde drops unknown params).
}

/// `GET /v2/cache/prices/candles` — on-demand candle window from Redis, falling back to the in-memory cache.
pub async fn candles(
    State(state): State<AppState>,
    Query(q): Query<CandlesQuery>,
) -> Result<Json<CandlesResp>, StatusCode> {
    let max = state.config.limits.max_param_len;
    crate::http::check_symbol(&q.token_symbol, max)?;
    crate::http::check_param_len(&q.period, max)?;
    // `0` → clamp to the Go default of 1000.
    let limit = q.limit.unwrap_or(0);
    #[cfg(feature = "nightly-candles-read-pool")]
    let candles = read_candle_rows_for_http(&state, &q.token_symbol, &q.period, limit).await;
    #[cfg(not(feature = "nightly-candles-read-pool"))]
    let candles = read_candle_rows(&state, &q.token_symbol, &q.period, limit).await;
    Ok(Json(CandlesResp {
        candles,
        period: q.period,
        token_symbol: q.token_symbol,
    }))
}

/// Read a candle window Redis-first, falling back to the in-memory cache only when Redis is disabled or empty.
pub async fn read_candle_rows(
    state: &AppState,
    base_symbol: &str,
    period: &str,
    limit: u32,
) -> Vec<Vec<Value>> {
    if let Some(resp) = candles_from_redis(state, base_symbol, period, limit).await {
        return resp.candles;
    }
    state
        .candles
        .candles(base_symbol, period, limit)
        .await
        .candles
}

/// Read the candle window from Redis, returning `None` when Redis is disabled or the key is empty.
#[async_trait::async_trait]
trait CandleRedisReader {
    async fn read_candle_members(
        &self,
        suffix: &str,
        start: isize,
        stop: isize,
    ) -> eyre::Result<Vec<String>>;
}

#[async_trait::async_trait]
impl CandleRedisReader for crate::redis_store::RedisStore {
    async fn read_candle_members(
        &self,
        suffix: &str,
        start: isize,
        stop: isize,
    ) -> eyre::Result<Vec<String>> {
        self.zrevrange(suffix, start, stop).await
    }
}

#[cfg(feature = "nightly-candles-read-pool")]
struct PooledCandleReader<'a>(&'a crate::redis_store::RedisStore);

#[cfg(feature = "nightly-candles-read-pool")]
#[async_trait::async_trait]
impl CandleRedisReader for PooledCandleReader<'_> {
    async fn read_candle_members(
        &self,
        suffix: &str,
        start: isize,
        stop: isize,
    ) -> eyre::Result<Vec<String>> {
        self.0.zrevrange_http_candles(suffix, start, stop).await
    }
}

#[cfg(feature = "nightly-candles-read-pool")]
async fn read_candle_rows_for_http(
    state: &AppState,
    base_symbol: &str,
    period: &str,
    limit: u32,
) -> Vec<Vec<Value>> {
    if state
        .redis
        .as_ref()
        .is_some_and(|redis| redis.has_candles_read_pool())
    {
        read_candle_rows_http_pooled(state, base_symbol, period, limit).await
    } else {
        read_candle_rows(state, base_symbol, period, limit).await
    }
}

#[cfg(feature = "nightly-candles-read-pool")]
async fn read_candle_rows_http_pooled(
    state: &AppState,
    base_symbol: &str,
    period: &str,
    limit: u32,
) -> Vec<Vec<Value>> {
    if let Some(redis) = state.redis.as_ref() {
        let reader = PooledCandleReader(redis);
        if let Some(response) = candles_from_redis_reader(
            &reader,
            &state.config,
            &state.candle_tip,
            base_symbol,
            period,
            limit,
        )
        .await
        {
            return response.candles;
        }
    }
    state
        .candles
        .candles(base_symbol, period, limit)
        .await
        .candles
}

async fn candles_from_redis_reader<R: CandleRedisReader + Sync>(
    reader: &R,
    config: &crate::config::Config,
    candle_tip: &crate::state::CandleTip,
    base_symbol: &str,
    period: &str,
    limit: u32,
) -> Option<CandlesResp> {
    let query_symbol = query_symbol_for(base_symbol);
    let suffix = crate::candle_source_refresh::candle_redis_suffix(config, &query_symbol, period);
    let stop = clamp_limit(limit) as isize - 1;
    let members = reader
        .read_candle_members(&suffix, 0, stop)
        .await
        .unwrap_or_default();
    if members.is_empty() {
        return None;
    }
    let candles: Vec<Vec<Value>> = members
        .iter()
        .filter_map(|member| serde_json::from_str::<Vec<Value>>(member).ok())
        .collect();
    let tip = candle_tip
        .lock()
        .ok()
        .and_then(|tips| tips.get(&(query_symbol, period.to_string())).copied());
    let mut candles = merge_tip_values(candles, tip);
    candles.truncate(clamp_limit(limit) as usize);

    Some(CandlesResp {
        candles,
        period: period.to_string(),
        token_symbol: base_symbol.to_string(),
    })
}

#[cfg(test)]
static EXTRA_HTTP_READER_ENTRY_COUNT: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);

#[cfg(test)]
static EXTRA_HTTP_READER_TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn candles_from_redis(
    state: &AppState,
    base_symbol: &str,
    period: &str,
    limit: u32,
) -> Option<CandlesResp> {
    if state.config.extra_token_candles.enabled {
        #[cfg(test)]
        EXTRA_HTTP_READER_ENTRY_COUNT.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let redis = state.redis.as_ref()?;
        return candles_from_redis_reader(
            redis,
            &state.config,
            &state.candle_tip,
            base_symbol,
            period,
            limit,
        )
        .await;
    }

    let redis = state.redis.as_ref()?;
    let query_symbol = query_symbol_for(base_symbol);
    let suffix = format!("v2:candlestick:{query_symbol}:{period}");
    let stop = clamp_limit(limit) as isize - 1;
    let members = redis.zrevrange(&suffix, 0, stop).await.unwrap_or_default();
    if members.is_empty() {
        return None;
    }
    let candles: Vec<Vec<Value>> = members
        .iter()
        .filter_map(|m| serde_json::from_str::<Vec<Value>>(m).ok())
        .collect();

    // Merge the live forming-candle tip so the HTTP path matches the WS path, then re-clamp.
    let tip = state
        .candle_tip
        .lock()
        .ok()
        .and_then(|t| t.get(&(query_symbol, period.to_string())).copied());
    let mut candles = merge_tip_values(candles, tip);
    candles.truncate(clamp_limit(limit) as usize);

    Some(CandlesResp {
        candles,
        period: period.to_string(),
        token_symbol: base_symbol.to_string(),
    })
}

/// Merge the live tip into newest-first Redis rows: replace newest on matching ts, prepend when newer, ignore when stale.
fn merge_tip_values(mut rows: Vec<Vec<Value>>, tip: Option<[f64; 5]>) -> Vec<Vec<Value>> {
    let Some(t) = tip else {
        return rows;
    };
    let tip_ts = t[0] as i64;
    let tip_row = vec![
        Value::from(tip_ts),
        Value::from(t[1]),
        Value::from(t[2]),
        Value::from(t[3]),
        Value::from(t[4]),
    ];
    match rows.first().and_then(|r| r.first()).and_then(Value::as_i64) {
        None => vec![tip_row],
        Some(newest_ts) if tip_ts == newest_ts => {
            rows[0] = tip_row;
            rows
        }
        Some(newest_ts) if tip_ts > newest_ts => {
            rows.insert(0, tip_row);
            rows
        }
        _ => rows,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::atomic::Ordering;
    #[cfg(feature = "nightly-candles-read-pool")]
    use std::sync::Arc;
    use std::sync::Mutex;

    use super::*;
    #[cfg(feature = "nightly-candles-read-pool")]
    use crate::redis_store::testing::{Failure, RedisFixture};

    #[derive(Default)]
    struct FakeCandleRedis {
        members: Mutex<HashMap<String, Vec<String>>>,
        reads: Mutex<Vec<String>>,
    }

    #[async_trait::async_trait]
    impl CandleRedisReader for FakeCandleRedis {
        async fn read_candle_members(
            &self,
            suffix: &str,
            _start: isize,
            _stop: isize,
        ) -> eyre::Result<Vec<String>> {
            self.reads.lock().unwrap().push(suffix.to_string());
            Ok(self
                .members
                .lock()
                .unwrap()
                .get(suffix)
                .cloned()
                .unwrap_or_default())
        }
    }

    fn config_with_extra(enabled: bool) -> crate::config::Config {
        crate::config::Config::from_figment(figment::Figment::new().merge(
            figment::providers::Serialized::defaults(serde_json::json!({
                "extra_token_candles": {
                    "enabled": enabled,
                    "symbols": ["USDC"],
                }
            })),
        ))
        .unwrap()
    }

    #[tokio::test]
    async fn http_reader_uses_extra_namespace_only_while_runtime_is_enabled() {
        let reader = FakeCandleRedis::default();
        let extra_key = "v2:extra-candlestick:USDC:1h".to_string();
        reader.members.lock().unwrap().insert(
            extra_key.clone(),
            vec!["[1700000000,1.0,1.01,0.99,1.0]".to_string()],
        );
        let tip = crate::state::new_candle_tip();

        let enabled =
            candles_from_redis_reader(&reader, &config_with_extra(true), &tip, "USDC", "1h", 24)
                .await
                .expect("enabled extra history");
        assert_eq!(enabled.candles.len(), 1);
        assert_eq!(
            reader.reads.lock().unwrap().last().map(String::as_str),
            Some(extra_key.as_str())
        );

        let disabled =
            candles_from_redis_reader(&reader, &config_with_extra(false), &tip, "USDC", "1h", 24)
                .await;
        assert!(disabled.is_none());
        assert_eq!(
            reader.reads.lock().unwrap().last().map(String::as_str),
            Some("v2:candlestick:USDC:1h")
        );
        assert!(reader.members.lock().unwrap().contains_key(&extra_key));
    }

    #[tokio::test]
    async fn http_reader_keeps_displayable_symbols_in_the_standard_namespace() {
        let reader = FakeCandleRedis::default();
        reader.members.lock().unwrap().insert(
            "v2:candlestick:SOLUSD:1h".to_string(),
            vec!["[1700000000,10.0,11.0,9.0,10.5]".to_string()],
        );

        let response = candles_from_redis_reader(
            &reader,
            &config_with_extra(true),
            &crate::state::new_candle_tip(),
            "SOL",
            "1h",
            24,
        )
        .await
        .expect("displayable history");

        assert_eq!(response.candles.len(), 1);
        assert_eq!(
            reader.reads.lock().unwrap().last().map(String::as_str),
            Some("v2:candlestick:SOLUSD:1h")
        );
    }

    #[tokio::test]
    async fn production_entry_selects_extra_reader_only_when_runtime_is_enabled() {
        let _test_lock = EXTRA_HTTP_READER_TEST_LOCK.lock().await;
        EXTRA_HTTP_READER_ENTRY_COUNT.store(0, Ordering::SeqCst);

        let disabled = crate::state::extra_candle_test_state(config_with_extra(false));
        assert!(candles_from_redis(&disabled, "USDC", "1h", 24)
            .await
            .is_none());
        assert_eq!(EXTRA_HTTP_READER_ENTRY_COUNT.load(Ordering::SeqCst), 0);

        let enabled = crate::state::extra_candle_test_state(config_with_extra(true));
        assert!(candles_from_redis(&enabled, "USDC", "1h", 24)
            .await
            .is_none());
        assert_eq!(EXTRA_HTTP_READER_ENTRY_COUNT.load(Ordering::SeqCst), 1);
    }

    #[cfg(feature = "nightly-candles-read-pool")]
    #[tokio::test]
    async fn pooled_http_keeps_legacy_keys_content_tip_and_fallback() {
        let _test_lock = EXTRA_HTTP_READER_TEST_LOCK.lock().await;
        let fixture = RedisFixture::start().await;
        let store = fixture.store_with_candles_read_pool(2);
        for extra_enabled in [false, true] {
            let key = if extra_enabled {
                "v2:extra-candlestick:USDC:1h"
            } else {
                "v2:candlestick:USDC:1h"
            };
            store
                .zadd_upsert(key, 1_700_000_000.0, "[1700000000,1.0,2.0,0.5,1.5]")
                .await
                .unwrap();
            store
                .zadd_upsert(key, 1_700_000_002.0, "bad-json")
                .await
                .unwrap();
            let mut state = crate::state::extra_candle_test_state(config_with_extra(extra_enabled));
            state.redis = Some(store.clone());
            let mut cache = HashMap::new();
            cache.insert(
                ("USDC".to_string(), "1h".to_string()),
                vec![[1_699_999_999.0, 9.0, 9.0, 9.0, 9.0]],
            );
            state
                .candle_cache
                .store(Arc::new(crate::state::CandleCache { candles: cache }));
            state.candle_tip.lock().unwrap().insert(
                ("USDC".to_string(), "1h".to_string()),
                [1_700_000_001.0, 3.0, 4.0, 2.0, 3.5],
            );
            fixture.commands();
            let legacy = read_candle_rows(&state, "USDC", "1h", 3).await;
            let pooled = read_candle_rows_http_pooled(&state, "USDC", "1h", 3).await;
            assert_eq!(pooled, legacy);
            assert_eq!(pooled.len(), 2);
            assert_eq!(pooled[0][0], 1_700_000_001);
            let read_keys: Vec<_> = fixture
                .commands()
                .into_iter()
                .filter(|command| command.first().is_some_and(|name| name == "ZREVRANGE"))
                .map(|command| command[1].clone())
                .collect();
            assert_eq!(read_keys, [key, key]);

            let response = candles(
                State(state.clone()),
                Query(CandlesQuery {
                    token_symbol: "USDC".to_string(),
                    period: "1h".to_string(),
                    limit: Some(3),
                }),
            )
            .await
            .unwrap()
            .0;
            assert_eq!(response.candles, pooled);
            assert_eq!(response.token_symbol, "USDC");
            assert_eq!(response.period, "1h");

            fixture.fail("ZREVRANGE", key, Failure::Error);
            let legacy_fallback = read_candle_rows(&state, "USDC", "1h", 3).await;
            fixture.fail("ZREVRANGE", key, Failure::Error);
            let pooled_fallback = read_candle_rows_http_pooled(&state, "USDC", "1h", 3).await;
            assert_eq!(pooled_fallback, legacy_fallback);
            assert_eq!(pooled_fallback.len(), 2);
            assert_eq!(pooled_fallback[1][0], 1_699_999_999);
        }
    }

    #[cfg(feature = "nightly-candles-read-pool")]
    #[tokio::test]
    async fn http_handler_uses_pool_while_legacy_read_slot_is_locked() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store_with_candles_read_pool(2);
        let key = "v2:candlestick:USDC:1h";
        store
            .zadd_upsert(key, 1_700_000_000.0, "[1700000000,1.0,2.0,0.5,1.5]")
            .await
            .unwrap();
        fixture.commands();

        let mut state = crate::state::extra_candle_test_state(config_with_extra(false));
        state.redis = Some(store.clone());
        let legacy_guard = store.lock_legacy_read_for_test().await;
        let response = tokio::time::timeout(
            std::time::Duration::from_secs(1),
            candles(
                State(state),
                Query(CandlesQuery {
                    token_symbol: "USDC".to_string(),
                    period: "1h".to_string(),
                    limit: Some(1),
                }),
            ),
        )
        .await
        .expect("HTTP candles should not wait for the legacy read slot")
        .unwrap()
        .0;
        drop(legacy_guard);

        assert_eq!(response.candles.len(), 1);
        assert_eq!(response.candles[0][0], 1_700_000_000);
        let commands = fixture.commands();
        assert!(commands.iter().any(|command| {
            command.first().is_some_and(|name| name == "ZREVRANGE")
                && command.get(1).is_some_and(|suffix| suffix == key)
        }));
    }

    #[cfg(feature = "nightly-candles-read-pool")]
    #[tokio::test]
    async fn pooled_http_matches_legacy_limits_symbol_mapping_and_live_tip() {
        let _test_lock = EXTRA_HTTP_READER_TEST_LOCK.lock().await;
        let fixture = RedisFixture::start().await;
        let store = fixture.store_with_candles_read_pool(2);
        let key = "v2:candlestick:SOLUSD:1h";
        for timestamp in [1_700_000_001, 1_700_000_002, 1_700_000_003] {
            store
                .zadd_upsert(
                    key,
                    timestamp as f64,
                    &format!("[{timestamp},1.0,2.0,0.5,1.5]"),
                )
                .await
                .unwrap();
        }
        let mut state = crate::state::extra_candle_test_state(config_with_extra(true));
        state.redis = Some(store);
        fixture.commands();
        for (tip_timestamp, expected_newest) in [
            (1_700_000_003, 1_700_000_003),
            (1_700_000_004, 1_700_000_004),
            (1_700_000_001, 1_700_000_003),
        ] {
            state.candle_tip.lock().unwrap().insert(
                ("SOLUSD".to_string(), "1h".to_string()),
                [tip_timestamp as f64, 3.0, 4.0, 2.0, 3.5],
            );
            for limit in [0, 1, 1000, 1001] {
                let legacy = read_candle_rows(&state, "SOL", "1h", limit).await;
                let pooled = read_candle_rows_http_pooled(&state, "SOL", "1h", limit).await;
                assert_eq!(pooled, legacy);
                assert_eq!(pooled[0][0], expected_newest);
                assert_eq!(
                    pooled.len(),
                    if limit == 1 {
                        1
                    } else if tip_timestamp == 1_700_000_004 {
                        4
                    } else {
                        3
                    }
                );
            }
        }
        let keys: Vec<_> = fixture
            .commands()
            .into_iter()
            .filter(|command| command.first().is_some_and(|name| name == "ZREVRANGE"))
            .map(|command| command[1].clone())
            .collect();
        assert_eq!(keys.len(), 24);
        assert!(keys.iter().all(|read_key| read_key == key));

        state.redis = None;
        assert_eq!(
            read_candle_rows_http_pooled(&state, "SOL", "1h", 1).await,
            read_candle_rows(&state, "SOL", "1h", 1).await
        );
        state.redis = Some(fixture.store());
        assert!(!state.redis.as_ref().unwrap().has_candles_read_pool());
        let response = candles(
            State(state.clone()),
            Query(CandlesQuery {
                token_symbol: "SOL".to_string(),
                period: "1h".to_string(),
                limit: Some(1),
            }),
        )
        .await
        .unwrap()
        .0;
        assert_eq!(
            response.candles,
            read_candle_rows(&state, "SOL", "1h", 1).await
        );
    }
}
