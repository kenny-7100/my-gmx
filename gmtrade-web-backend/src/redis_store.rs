//! Redis (MemoryDB cluster) history store backing the web backend's served series, falling back to in-memory when disabled.

use std::collections::HashMap;
#[cfg(feature = "nightly-candles-read-pool")]
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use redis::cluster::ClusterClient;
use redis::AsyncCommands;
use serde::Deserialize;
use tokio::sync::Mutex;
#[cfg(feature = "nightly-candles-read-pool")]
use tokio::sync::{MutexGuard, Semaphore};

use crate::metrics;

#[cfg(test)]
pub(crate) mod testing;

#[cfg(feature = "nightly-candles-read-pool")]
const fn default_candles_read_pool_connections() -> usize {
    2
}

#[cfg(feature = "nightly-candles-read-pool")]
#[derive(Debug, Clone, Deserialize)]
pub struct CandlesReadPoolConfig {
    #[serde(default)]
    pub enabled: bool,
    /// Maximum additional logical cluster connections for HTTP candles.
    /// Each handle may open a TCP socket to every node it contacts, so N pool
    /// handles can add roughly N times the contacted node count in sockets,
    /// on top of the existing read and write handles. Check the actual count.
    #[serde(default = "default_candles_read_pool_connections")]
    pub connections: usize,
}

#[cfg(feature = "nightly-candles-read-pool")]
impl Default for CandlesReadPoolConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            connections: default_candles_read_pool_connections(),
        }
    }
}

/// Redis store configuration (figment-loaded sub-config).
#[derive(Debug, Clone, Default, Deserialize)]
pub struct RedisConfig {
    /// When false, the store is absent so the backend runs purely in-memory.
    #[serde(default)]
    pub enable: bool,
    /// MemoryDB cluster configuration endpoints.
    #[serde(default)]
    pub cluster_nodes: Vec<String>,
    /// Namespace prefix prepended to every key, e.g. `mainnet:`.
    #[serde(default)]
    pub key_prefix: String,
    #[cfg(feature = "nightly-candles-read-pool")]
    #[serde(default)]
    pub candles_read_pool: CandlesReadPoolConfig,
}

/// One candlestick window to bulk-write: `(key suffix, [(score, member JSON)], retention cutoff)`.
pub type CandleWindowEntry = (String, Vec<(f64, String)>, Option<f64>);

/// One idempotent zset bucket upsert: `(key suffix, score, member JSON)`.
pub type ZaddUpsertRow = (String, f64, String);

type ClusterConnection = redis::cluster_async::ClusterConnection;

/// Reused TLS cluster connection; lazily opened and transparently re-established on I/O failure.
/// `RedisStore` holds separate read and write slots so background writes do not block HTTP reads.
struct ConnectionSlot {
    client: Arc<ClusterClient>,
    conn: Mutex<Option<ClusterConnection>>,
}

impl ConnectionSlot {
    fn new(client: Arc<ClusterClient>) -> Self {
        Self {
            client,
            conn: Mutex::new(None),
        }
    }

    async fn ensure_conn<'a>(
        &self,
        guard: &'a mut Option<ClusterConnection>,
    ) -> eyre::Result<&'a mut ClusterConnection> {
        if guard.is_none() {
            *guard = Some(self.client.get_async_connection().await?);
        }
        Ok(guard.as_mut().expect("redis connection slot populated"))
    }
}

fn should_reconnect(err: &redis::RedisError) -> bool {
    err.is_connection_dropped() || err.is_io_error() || err.is_timeout()
}

#[cfg(feature = "nightly-candles-read-pool")]
struct CandlesReadPool {
    // Each permit holder uses at most one slot. The permit count matches slots.len().
    slots: Vec<ConnectionSlot>,
    permits: Semaphore,
    next_slot: AtomicUsize,
}

#[cfg(feature = "nightly-candles-read-pool")]
impl CandlesReadPool {
    fn new(client: Arc<ClusterClient>, connections: usize) -> Self {
        // Redis 0.29.5, local single-node Cluster: 240 reads of a warmed
        // ~56 KiB / 1,000-member window, three runs per concurrency limit.
        // Median wall time for one cloned handle vs independent connections:
        // N=2: 402 vs 243 ms; N=4: 347 vs 155 ms. Separate connections avoid
        // sharing node response queues; topology and network can change this.
        let slots: Vec<_> = (0..connections)
            .map(|_| ConnectionSlot::new(client.clone()))
            .collect();
        Self {
            permits: Semaphore::new(slots.len()),
            slots,
            next_slot: AtomicUsize::new(0),
        }
    }

    async fn lock_free_slot(&self) -> (usize, MutexGuard<'_, Option<ClusterConnection>>) {
        loop {
            let start = self.next_slot.fetch_add(1, Ordering::Relaxed) % self.slots.len();
            if let Some(slot) = (0..self.slots.len()).find_map(|offset| {
                let index = (start + offset) % self.slots.len();
                self.slots[index]
                    .conn
                    .try_lock()
                    .ok()
                    .map(|guard| (index, guard))
            }) {
                return slot;
            }
            tokio::task::yield_now().await;
        }
    }
}

/// Cluster-backed Redis store with a fixed key prefix.
#[derive(Clone)]
pub struct RedisStore {
    read: Arc<ConnectionSlot>,
    write: Arc<ConnectionSlot>,
    prefix: String,
    #[cfg(feature = "nightly-candles-read-pool")]
    candles_read_pool: Option<Arc<CandlesReadPool>>,
}

impl RedisStore {
    /// Build the store, returning `Ok(None)` when disabled or no nodes are configured.
    pub fn connect(cfg: &RedisConfig) -> eyre::Result<Option<Self>> {
        if !cfg.enable || cfg.cluster_nodes.is_empty() {
            return Ok(None);
        }
        #[cfg(feature = "nightly-candles-read-pool")]
        if cfg.candles_read_pool.enabled && !(1..=8).contains(&cfg.candles_read_pool.connections) {
            eyre::bail!("candles read pool connections must be between 1 and 8");
        }
        let client = Arc::new(ClusterClient::new(cfg.cluster_nodes.clone())?);
        #[cfg(feature = "nightly-candles-read-pool")]
        let candles_read_pool = cfg.candles_read_pool.enabled.then(|| {
            Arc::new(CandlesReadPool::new(
                client.clone(),
                cfg.candles_read_pool.connections,
            ))
        });
        Ok(Some(Self {
            read: Arc::new(ConnectionSlot::new(client.clone())),
            write: Arc::new(ConnectionSlot::new(client)),
            prefix: cfg.key_prefix.clone(),
            #[cfg(feature = "nightly-candles-read-pool")]
            candles_read_pool,
        }))
    }

    #[cfg(feature = "nightly-candles-read-pool")]
    pub(crate) fn has_candles_read_pool(&self) -> bool {
        self.candles_read_pool.is_some()
    }

    /// Full key = `{prefix}{suffix}`.
    pub fn k(&self, suffix: &str) -> String {
        format!("{}{}", self.prefix, suffix)
    }

    // ---- writes (best-effort; caller logs on error) ----

    /// `SET key value` (no TTL, matching the legacy store).
    pub async fn set_string(&self, suffix: &str, value: &str) -> eyre::Result<()> {
        let operation = metrics::RedisOperationGuard::start(
            metrics::RedisSlot::Write,
            metrics::RedisOperation::SetString,
        );
        let key = self.k(suffix);
        let slot_wait = metrics::RedisSlotWaitGuard::start(metrics::RedisSlot::Write);
        let mut guard = self.write.conn.lock().await;
        slot_wait.acquired();
        for attempt in 0..2 {
            let conn = self.write.ensure_conn(&mut guard).await?;
            match conn.set::<_, _, ()>(key.clone(), value).await {
                Ok(()) => {
                    operation.finish(metrics::RedisResult::Success);
                    return Ok(());
                }
                Err(err) if attempt == 0 && should_reconnect(&err) => {
                    tracing::warn!(error = %err, "redis cluster connection dropped; reconnecting");
                    *guard = None;
                }
                Err(err) => return Err(err.into()),
            }
        }
        eyre::bail!("redis cluster connection failed after reconnect")
    }

    /// Idempotent bucket upsert: replace any member at `score`, then add the fresh member at `score`.
    pub async fn zadd_upsert(&self, suffix: &str, score: f64, member: &str) -> eyre::Result<()> {
        self.zadd_upsert_many(&[(suffix.to_string(), score, member.to_string())])
            .await
    }

    /// Batch idempotent zset upserts on ONE reused connection (one pipeline round-trip per row).
    pub async fn zadd_upsert_many(&self, rows: &[ZaddUpsertRow]) -> eyre::Result<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let operation = metrics::RedisOperationGuard::start(
            metrics::RedisSlot::Write,
            metrics::RedisOperation::ZaddUpsertMany,
        );
        let rows = rows.to_vec();
        let prefix = self.prefix.clone();
        let slot_wait = metrics::RedisSlotWaitGuard::start(metrics::RedisSlot::Write);
        let mut guard = self.write.conn.lock().await;
        slot_wait.acquired();
        for attempt in 0..2 {
            let conn = self.write.ensure_conn(&mut guard).await?;
            let mut last_err = None;
            for (suffix, score, member) in &rows {
                let key = format!("{prefix}{suffix}");
                let mut pipe = redis::pipe();
                pipe.cmd("ZREMRANGEBYSCORE")
                    .arg(&key)
                    .arg(*score)
                    .arg(*score)
                    .ignore();
                pipe.cmd("ZADD").arg(&key).arg(*score).arg(member).ignore();
                if let Err(err) = pipe.query_async::<()>(conn).await {
                    last_err = Some(err);
                }
            }
            match last_err {
                None => {
                    operation.finish(metrics::RedisResult::Success);
                    return Ok(());
                }
                Some(err) if attempt == 0 && should_reconnect(&err) => {
                    tracing::warn!(error = %err, "redis cluster connection dropped; reconnecting");
                    *guard = None;
                }
                Some(err) => return Err(err.into()),
            }
        }
        eyre::bail!("redis cluster connection failed after reconnect")
    }

    /// Bulk candle-window upsert: ONE connection, ONE pipeline per key (per-row replace + retention trim).
    pub async fn write_candle_windows(&self, entries: &[CandleWindowEntry]) -> eyre::Result<()> {
        if entries.is_empty() {
            return Ok(());
        }
        let operation = metrics::RedisOperationGuard::start(
            metrics::RedisSlot::Write,
            metrics::RedisOperation::WriteCandleWindows,
        );
        let entries = entries.to_vec();
        let prefix = self.prefix.clone();
        let slot_wait = metrics::RedisSlotWaitGuard::start(metrics::RedisSlot::Write);
        let mut guard = self.write.conn.lock().await;
        slot_wait.acquired();
        for attempt in 0..2 {
            let conn = self.write.ensure_conn(&mut guard).await?;
            let mut last_err = None;
            for (suffix, rows, trim_below) in &entries {
                let key = format!("{prefix}{suffix}");
                let mut pipe = redis::pipe();
                for (score, member) in rows {
                    pipe.cmd("ZREMRANGEBYSCORE")
                        .arg(&key)
                        .arg(*score)
                        .arg(*score)
                        .ignore();
                    pipe.cmd("ZADD").arg(&key).arg(*score).arg(member).ignore();
                }
                if let Some(cutoff) = trim_below {
                    pipe.cmd("ZREMRANGEBYSCORE")
                        .arg(&key)
                        .arg("-inf")
                        .arg(format!("({cutoff}"))
                        .ignore();
                }
                if let Err(err) = pipe.query_async::<()>(conn).await {
                    last_err = Some(err);
                }
            }
            match last_err {
                None => {
                    operation.finish(metrics::RedisResult::Success);
                    return Ok(());
                }
                Some(err) if attempt == 0 && should_reconnect(&err) => {
                    tracing::warn!(error = %err, "redis cluster connection dropped; reconnecting");
                    *guard = None;
                }
                Some(err) => return Err(err.into()),
            }
        }
        eyre::bail!("redis cluster connection failed after reconnect")
    }

    /// Retention trim: idempotently remove members with score strictly below `cutoff`.
    pub async fn ztrim_below(&self, suffix: &str, cutoff: f64) -> eyre::Result<()> {
        let operation = metrics::RedisOperationGuard::start(
            metrics::RedisSlot::Write,
            metrics::RedisOperation::ZtrimBelow,
        );
        let key = self.k(suffix);
        let slot_wait = metrics::RedisSlotWaitGuard::start(metrics::RedisSlot::Write);
        let mut guard = self.write.conn.lock().await;
        slot_wait.acquired();
        for attempt in 0..2 {
            let conn = self.write.ensure_conn(&mut guard).await?;
            match conn.zrembyscore(&key, "-inf", format!("({cutoff}")).await {
                Ok(()) => {
                    operation.finish(metrics::RedisResult::Success);
                    return Ok(());
                }
                Err(err) if attempt == 0 && should_reconnect(&err) => {
                    tracing::warn!(error = %err, "redis cluster connection dropped; reconnecting");
                    *guard = None;
                }
                Err(err) => return Err(err.into()),
            }
        }
        eyre::bail!("redis cluster connection failed after reconnect")
    }

    // ---- reads (caller maps Err/None to empty per graceful-read policy) ----

    /// `GET key` → `None` on miss.
    pub async fn get_string(&self, suffix: &str) -> eyre::Result<Option<String>> {
        let operation = metrics::RedisOperationGuard::start(
            metrics::RedisSlot::Read,
            metrics::RedisOperation::GetString,
        );
        let key = self.k(suffix);
        let slot_wait = metrics::RedisSlotWaitGuard::start(metrics::RedisSlot::Read);
        let mut guard = self.read.conn.lock().await;
        slot_wait.acquired();
        for attempt in 0..2 {
            let conn = self.read.ensure_conn(&mut guard).await?;
            match conn.get(key.clone()).await {
                Ok(value) => {
                    {
                        let value: &Option<String> = &value;
                        operation.finish_with(|| {
                            if value.is_none() {
                                metrics::RedisResult::Miss
                            } else {
                                metrics::RedisResult::Success
                            }
                        });
                    }
                    return Ok(value);
                }
                Err(err) if attempt == 0 && should_reconnect(&err) => {
                    tracing::warn!(error = %err, "redis cluster connection dropped; reconnecting");
                    *guard = None;
                }
                Err(err) => return Err(err.into()),
            }
        }
        eyre::bail!("redis cluster connection failed after reconnect")
    }

    /// `HGETALL key` → empty map on miss.
    pub async fn hgetall(&self, suffix: &str) -> eyre::Result<HashMap<String, String>> {
        let operation = metrics::RedisOperationGuard::start(
            metrics::RedisSlot::Read,
            metrics::RedisOperation::Hgetall,
        );
        let key = self.k(suffix);
        let slot_wait = metrics::RedisSlotWaitGuard::start(metrics::RedisSlot::Read);
        let mut guard = self.read.conn.lock().await;
        slot_wait.acquired();
        for attempt in 0..2 {
            let conn = self.read.ensure_conn(&mut guard).await?;
            match conn.hgetall(key.clone()).await {
                Ok(value) => {
                    {
                        let value: &HashMap<String, String> = &value;
                        operation.finish_with(|| {
                            if value.is_empty() {
                                metrics::RedisResult::Miss
                            } else {
                                metrics::RedisResult::Success
                            }
                        });
                    }
                    return Ok(value);
                }
                Err(err) if attempt == 0 && should_reconnect(&err) => {
                    tracing::warn!(error = %err, "redis cluster connection dropped; reconnecting");
                    *guard = None;
                }
                Err(err) => return Err(err.into()),
            }
        }
        eyre::bail!("redis cluster connection failed after reconnect")
    }

    /// `ZREVRANGE key start stop` (highest score first) → member strings.
    pub async fn zrevrange(
        &self,
        suffix: &str,
        start: isize,
        stop: isize,
    ) -> eyre::Result<Vec<String>> {
        let operation = metrics::RedisOperationGuard::start(
            metrics::RedisSlot::Read,
            metrics::RedisOperation::Zrevrange,
        );
        let key = self.k(suffix);
        let slot_wait = metrics::RedisSlotWaitGuard::start(metrics::RedisSlot::Read);
        let mut guard = self.read.conn.lock().await;
        slot_wait.acquired();
        for attempt in 0..2 {
            let conn = self.read.ensure_conn(&mut guard).await?;
            match conn.zrevrange(key.clone(), start, stop).await {
                Ok(value) => {
                    {
                        let value: &Vec<String> = &value;
                        operation.finish_with(|| {
                            if value.is_empty() {
                                metrics::RedisResult::Miss
                            } else {
                                metrics::RedisResult::Success
                            }
                        });
                    }
                    return Ok(value);
                }
                Err(err) if attempt == 0 && should_reconnect(&err) => {
                    tracing::warn!(error = %err, "redis cluster connection dropped; reconnecting");
                    *guard = None;
                }
                Err(err) => return Err(err.into()),
            }
        }
        eyre::bail!("redis cluster connection failed after reconnect")
    }

    #[cfg(feature = "nightly-candles-read-pool")]
    pub(crate) async fn zrevrange_http_candles(
        &self,
        suffix: &str,
        start: isize,
        stop: isize,
    ) -> eyre::Result<Vec<String>> {
        let pool = self
            .candles_read_pool
            .as_ref()
            .expect("HTTP candles pool checked before pooled read");
        let operation = metrics::RedisOperationGuard::start(
            metrics::RedisSlot::Read,
            metrics::RedisOperation::Zrevrange,
        );
        let slot_wait = metrics::RedisSlotWaitGuard::start(metrics::RedisSlot::CandlesPool);
        let permit = pool.permits.acquire().await?;
        let (index, mut guard) = pool.lock_free_slot().await;
        slot_wait.acquired();
        let slot = &pool.slots[index];
        let key = self.k(suffix);
        let result: eyre::Result<Vec<String>> = async {
            for attempt in 0..2 {
                let conn = slot.ensure_conn(&mut guard).await?;
                match conn.zrevrange(key.clone(), start, stop).await {
                    Ok(value) => return Ok(value),
                    Err(err) if attempt == 0 && should_reconnect(&err) => {
                        tracing::warn!(error = %err, slot = index, "redis cluster connection dropped; reconnecting");
                        *guard = None;
                    }
                    Err(err) => return Err(err.into()),
                }
            }
            eyre::bail!("redis cluster connection failed after reconnect")
        }
        .await;
        drop(guard);
        drop(permit);
        operation.finish_with(|| match &result {
            Ok(rows) if rows.is_empty() => metrics::RedisResult::Miss,
            Ok(_) => metrics::RedisResult::Success,
            Err(_) => metrics::RedisResult::Error,
        });
        result
    }

    /// `ZREVRANGE` for many suffixes on ONE reused connection.
    /// Per-key failures (WRONGTYPE, etc.) yield an empty vec for that key only; connection
    /// errors trigger one reconnect and a full-batch retry, matching the old per-key
    /// `unwrap_or_default()` semantics without abandoning keys that already read OK.
    pub async fn zrevrange_many(
        &self,
        queries: &[(String, isize, isize)],
    ) -> eyre::Result<Vec<Vec<String>>> {
        if queries.is_empty() {
            return Ok(Vec::new());
        }
        let operation = metrics::RedisOperationGuard::start(
            metrics::RedisSlot::Read,
            metrics::RedisOperation::ZrevrangeMany,
        );
        let queries = queries.to_vec();
        let prefix = self.prefix.clone();
        let slot_wait = metrics::RedisSlotWaitGuard::start(metrics::RedisSlot::Read);
        let mut guard = self.read.conn.lock().await;
        slot_wait.acquired();
        for attempt in 0..2 {
            let conn = self.read.ensure_conn(&mut guard).await?;
            let mut out = Vec::with_capacity(queries.len());
            let mut connection_err = None;
            let mut result_state = operation.is_enabled().then_some((false, false));
            for (suffix, start, stop) in &queries {
                let key = format!("{prefix}{suffix}");
                match conn.zrevrange(&key, *start, *stop).await {
                    Ok(members) => {
                        let members: Vec<String> = members;
                        if let Some((_, any_non_empty)) = result_state.as_mut() {
                            *any_non_empty |= !members.is_empty();
                        }
                        out.push(members);
                    }
                    Err(err) if should_reconnect(&err) => {
                        connection_err = Some(err);
                        break;
                    }
                    Err(err) => {
                        tracing::warn!(error = %err, %suffix, "redis zrevrange failed; skipping key");
                        if let Some((partial, _)) = result_state.as_mut() {
                            *partial = true;
                        }
                        out.push(Vec::new());
                    }
                }
            }
            match connection_err {
                None => {
                    debug_assert_eq!(out.len(), queries.len());
                    operation.finish_with(|| {
                        let (partial, any_non_empty) = result_state
                            .expect("enabled Redis operation must track batch result state");
                        if partial {
                            metrics::RedisResult::Partial
                        } else if any_non_empty {
                            metrics::RedisResult::Success
                        } else {
                            metrics::RedisResult::Miss
                        }
                    });
                    return Ok(out);
                }
                Some(err) if attempt == 0 => {
                    tracing::warn!(error = %err, "redis cluster connection dropped; reconnecting");
                    *guard = None;
                }
                Some(err) => return Err(err.into()),
            }
        }
        eyre::bail!("redis cluster connection failed after reconnect")
    }

    /// `ZRANGEBYSCORE key min max LIMIT offset count` (ascending) → members.
    pub async fn zrangebyscore_limit(
        &self,
        suffix: &str,
        min: &str,
        max: &str,
        offset: isize,
        count: isize,
    ) -> eyre::Result<Vec<String>> {
        let operation = metrics::RedisOperationGuard::start(
            metrics::RedisSlot::Read,
            metrics::RedisOperation::ZrangebyscoreLimit,
        );
        let key = self.k(suffix);
        let slot_wait = metrics::RedisSlotWaitGuard::start(metrics::RedisSlot::Read);
        let mut guard = self.read.conn.lock().await;
        slot_wait.acquired();
        for attempt in 0..2 {
            let conn = self.read.ensure_conn(&mut guard).await?;
            match conn
                .zrangebyscore_limit(key.clone(), min, max, offset, count)
                .await
            {
                Ok(value) => {
                    {
                        let value: &Vec<String> = &value;
                        operation.finish_with(|| {
                            if value.is_empty() {
                                metrics::RedisResult::Miss
                            } else {
                                metrics::RedisResult::Success
                            }
                        });
                    }
                    return Ok(value);
                }
                Err(err) if attempt == 0 && should_reconnect(&err) => {
                    tracing::warn!(error = %err, "redis cluster connection dropped; reconnecting");
                    *guard = None;
                }
                Err(err) => return Err(err.into()),
            }
        }
        eyre::bail!("redis cluster connection failed after reconnect")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_prefixes_suffix() {
        let client = Arc::new(ClusterClient::new(vec!["redis://127.0.0.1:6379"]).unwrap());
        let store = RedisStore {
            read: Arc::new(ConnectionSlot::new(client.clone())),
            write: Arc::new(ConnectionSlot::new(client)),
            prefix: "mainnet:".to_string(),
            #[cfg(feature = "nightly-candles-read-pool")]
            candles_read_pool: None,
        };
        assert_eq!(
            store.k("v2:candlestick:BTC:1m"),
            "mainnet:v2:candlestick:BTC:1m"
        );
        assert_eq!(
            store.k("v2:daily:fee_apy_cache:30"),
            "mainnet:v2:daily:fee_apy_cache:30"
        );
    }
}

#[cfg(all(test, feature = "nightly-candles-read-pool"))]
mod candles_pool_tests {
    use super::testing::{Failure, RedisFixture};
    use super::*;
    use std::time::Duration;

    #[test]
    fn pool_config_is_disabled_by_default_and_validated_only_when_used() {
        let mut cfg = RedisConfig {
            enable: true,
            cluster_nodes: vec!["redis://127.0.0.1:6379".to_string()],
            ..RedisConfig::default()
        };
        assert!(!cfg.candles_read_pool.enabled);
        assert_eq!(cfg.candles_read_pool.connections, 2);
        let decoded: RedisConfig = serde_json::from_value(serde_json::json!({
            "enable": true,
            "cluster_nodes": ["redis://127.0.0.1:6379"],
            "candles_read_pool": { "enabled": true, "connections": 4 }
        }))
        .unwrap();
        assert!(decoded.candles_read_pool.enabled);
        assert_eq!(decoded.candles_read_pool.connections, 4);
        assert!(!RedisStore::connect(&cfg)
            .unwrap()
            .unwrap()
            .has_candles_read_pool());

        cfg.candles_read_pool.enabled = true;
        for connections in [0, 9] {
            cfg.candles_read_pool.connections = connections;
            assert!(RedisStore::connect(&cfg).is_err());
        }
        for connections in [1, 2, 4, 8] {
            cfg.candles_read_pool.connections = connections;
            assert!(RedisStore::connect(&cfg)
                .unwrap()
                .unwrap()
                .has_candles_read_pool());
        }
        cfg.candles_read_pool.connections = 0;
        cfg.enable = false;
        assert!(RedisStore::connect(&cfg).unwrap().is_none());
        cfg.enable = true;
        cfg.cluster_nodes.clear();
        assert!(RedisStore::connect(&cfg).unwrap().is_none());
    }

    #[tokio::test]
    async fn pooled_read_does_not_wait_for_a_busy_pool_slot_or_legacy_read_slot() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store_with_candles_read_pool(2);
        store.zadd_upsert("slow", 1.0, "one").await.unwrap();
        store.zadd_upsert("fast", 1.0, "two").await.unwrap();
        fixture.commands();
        fixture.fail("ZREVRANGE", "slow", Failure::Delay(Duration::from_secs(1)));
        let legacy_guard = store.read.conn.lock().await;
        let slow_store = store.clone();
        let slow =
            tokio::spawn(async move { slow_store.zrevrange_http_candles("slow", 0, -1).await });
        tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                if fixture.commands().iter().any(|command| {
                    command.first().is_some_and(|name| name == "ZREVRANGE")
                        && command.get(1).is_some_and(|key| key == "slow")
                }) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap();
        let fast = tokio::time::timeout(
            Duration::from_millis(700),
            store.zrevrange_http_candles("fast", 0, -1),
        )
        .await
        .unwrap()
        .unwrap();
        assert_eq!(fast, ["two"]);
        assert!(!slow.is_finished());
        drop(legacy_guard);
        assert_eq!(slow.await.unwrap().unwrap(), ["one"]);
    }

    #[tokio::test]
    async fn a_third_read_waits_until_one_of_two_pool_slots_is_free() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store_with_candles_read_pool(2);
        fixture.fail(
            "ZREVRANGE",
            "first",
            Failure::Delay(Duration::from_millis(500)),
        );
        fixture.fail(
            "ZREVRANGE",
            "second",
            Failure::Delay(Duration::from_millis(500)),
        );
        let first_store = store.clone();
        let first =
            tokio::spawn(async move { first_store.zrevrange_http_candles("first", 0, -1).await });
        let second_store = store.clone();
        let second =
            tokio::spawn(async move { second_store.zrevrange_http_candles("second", 0, -1).await });
        tokio::time::timeout(Duration::from_secs(3), async {
            while fixture.delayed_in_flight() != 2 {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap();
        fixture.commands();
        let mut third = Box::pin(store.zrevrange_http_candles("third", 0, -1));
        assert!(futures_util::poll!(&mut third).is_pending());
        assert!(fixture.commands().is_empty());
        assert!(first.await.unwrap().unwrap().is_empty());
        assert!(second.await.unwrap().unwrap().is_empty());
        assert!(third.await.unwrap().is_empty());
        assert_eq!(
            store
                .candles_read_pool
                .as_ref()
                .unwrap()
                .permits
                .available_permits(),
            2
        );
    }

    #[tokio::test]
    async fn failed_slot_scan_retries_and_releases_permit_on_cancellation() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store_with_candles_read_pool(2);
        let pool = store.candles_read_pool.as_ref().unwrap();
        let first_guard = pool.slots[0].conn.lock().await;
        let second_guard = pool.slots[1].conn.lock().await;

        let mut cancelled = Box::pin(store.zrevrange_http_candles("missing", 0, -1));
        assert!(futures_util::poll!(&mut cancelled).is_pending());
        assert_eq!(pool.permits.available_permits(), 1);
        drop(cancelled);
        assert_eq!(pool.permits.available_permits(), 2);

        let mut retried = Box::pin(store.zrevrange_http_candles("missing", 0, -1));
        assert!(futures_util::poll!(&mut retried).is_pending());
        drop(first_guard);
        assert!(tokio::time::timeout(Duration::from_secs(3), retried)
            .await
            .unwrap()
            .unwrap()
            .is_empty());
        drop(second_guard);
        assert_eq!(pool.permits.available_permits(), 2);
    }

    #[tokio::test]
    async fn pooled_read_retries_once_per_connection_error() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store_with_candles_read_pool(2);
        store.zadd_upsert("first", 1.0, "one").await.unwrap();
        store.zadd_upsert("second", 1.0, "two").await.unwrap();
        fixture.fail("ZREVRANGE", "first", Failure::Disconnect);
        fixture.fail("ZREVRANGE", "second", Failure::Disconnect);
        let (first, second) = tokio::time::timeout(Duration::from_secs(10), async {
            tokio::join!(
                store.zrevrange_http_candles("first", 0, -1),
                store.zrevrange_http_candles("second", 0, -1)
            )
        })
        .await
        .unwrap();
        assert_eq!(first.unwrap(), ["one"]);
        assert_eq!(second.unwrap(), ["two"]);

        fixture.fail("ZREVRANGE", "first", Failure::Disconnect);
        fixture.fail("ZREVRANGE", "first", Failure::Disconnect);
        assert!(tokio::time::timeout(
            Duration::from_secs(10),
            store.zrevrange_http_candles("first", 0, -1)
        )
        .await
        .unwrap()
        .is_err());
        fixture.fail("ZREVRANGE", "second", Failure::Error);
        assert!(store.zrevrange_http_candles("second", 0, -1).await.is_err());
        assert_eq!(
            store.zrevrange_http_candles("first", 0, -1).await.unwrap(),
            ["one"]
        );
        assert_eq!(
            store
                .candles_read_pool
                .as_ref()
                .unwrap()
                .permits
                .available_permits(),
            2
        );
    }

    #[tokio::test]
    async fn cancellation_after_send_releases_slot_while_server_finishes_command() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store_with_candles_read_pool(1);
        store.zadd_upsert("fast", 1.0, "two").await.unwrap();
        fixture.commands();
        fixture.fail(
            "ZREVRANGE",
            "slow",
            Failure::Delay(Duration::from_millis(500)),
        );
        let slow_store = store.clone();
        let slow =
            tokio::spawn(async move { slow_store.zrevrange_http_candles("slow", 0, -1).await });
        tokio::time::timeout(Duration::from_secs(3), async {
            while fixture.delayed_in_flight() == 0 {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap();
        slow.abort();
        assert!(slow.await.unwrap_err().is_cancelled());
        assert_eq!(
            store
                .candles_read_pool
                .as_ref()
                .unwrap()
                .permits
                .available_permits(),
            1
        );
        assert_eq!(fixture.delayed_in_flight(), 1);
        let fast = tokio::time::timeout(
            Duration::from_secs(3),
            store.zrevrange_http_candles("fast", 0, -1),
        )
        .await
        .unwrap()
        .unwrap();
        assert_eq!(fast, ["two"]);
        tokio::time::timeout(Duration::from_secs(3), async {
            while fixture.delayed_in_flight() != 0 {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap();
        assert_eq!(fixture.delayed_in_flight(), 0);
    }

    #[tokio::test]
    async fn pooled_result_keeps_read_direction_and_uses_pool_wait_label() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store_with_candles_read_pool(2);
        let _enabled = crate::metrics::testing::Enabled::new(true);
        let recorder = crate::metrics::testing::RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        assert!(store
            .zrevrange_http_candles("missing", 0, -1)
            .await
            .unwrap()
            .is_empty());
        let events = recorder.take();
        let operations: Vec<_> = events
            .iter()
            .filter(|event| event.name == crate::metrics::REDIS_DURATION)
            .collect();
        assert_eq!(operations.len(), 1);
        assert_eq!(operations[0].labels[0].1, "read");
        assert_eq!(operations[0].labels[1].1, "zrevrange");
        assert_eq!(operations[0].labels[2].1, "miss");
        let waits: Vec<_> = events
            .iter()
            .filter(|event| event.name == crate::metrics::REDIS_SLOT_WAIT)
            .collect();
        assert_eq!(waits.len(), 1);
        assert_eq!(waits[0].labels[0].1, "candles_pool");
        assert!(events
            .iter()
            .filter(|event| event.name == crate::metrics::REDIS_WAITERS)
            .all(|event| event.labels[0].1 == "candles_pool"));
    }

    #[tokio::test(start_paused = true)]
    async fn cancelled_pool_wait_releases_metrics_and_does_not_send_a_command() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store_with_candles_read_pool(2);
        let pool = store.candles_read_pool.as_ref().unwrap();
        let permits = pool.permits.acquire_many(2).await.unwrap();
        let _enabled = crate::metrics::testing::Enabled::new(true);
        let recorder = crate::metrics::testing::RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        let mut waiting = Box::pin(store.zrevrange_http_candles("missing", 0, -1));
        assert!(futures_util::poll!(&mut waiting).is_pending());
        tokio::time::advance(Duration::from_secs(3)).await;
        drop(waiting);
        drop(permits);
        assert_eq!(pool.permits.available_permits(), 2);
        assert!(fixture.commands().is_empty());
        {
            let events = recorder.take();
            assert_eq!(
                events
                    .iter()
                    .filter(|event| event.name == crate::metrics::REDIS_WAITERS)
                    .map(|event| event.value)
                    .sum::<f64>(),
                0.0
            );
            assert!(events.iter().any(|event| {
                event.name == crate::metrics::REDIS_SLOT_WAIT
                    && event.labels[0].1 == "candles_pool"
                    && event.value == 3.0
            }));
            assert!(events.iter().any(|event| {
                event.name == crate::metrics::REDIS_DURATION
                    && event.labels[0].1 == "read"
                    && event.labels[2].1 == "error"
            }));
        }
    }
}

#[cfg(test)]
mod metrics_tests {
    use super::testing::{Failure, RedisFixture};
    use super::*;
    use crate::metrics::testing::{Enabled, RecordingRecorder};

    fn results(recorder: &RecordingRecorder) -> Vec<(String, String)> {
        let events = recorder.take();
        assert!(events
            .iter()
            .flat_map(|event| &event.labels)
            .all(|(_, value)| !value.contains("private")));
        events
            .into_iter()
            .filter(|event| event.name == metrics::REDIS_DURATION)
            .map(|event| (event.labels[1].1.clone(), event.labels[2].1.clone()))
            .collect()
    }

    #[tokio::test]
    async fn shared_entries_report_one_final_result_without_wrapper_double_counting() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store();
        let _enabled = Enabled::new(true);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        tokio::time::timeout(std::time::Duration::from_secs(10), async {
            assert_eq!(store.get_string("private").await.unwrap(), None);
            store.set_string("private", "value").await.unwrap();
            assert_eq!(
                store.get_string("private").await.unwrap().as_deref(),
                Some("value")
            );
            assert!(store.hgetall("private-hash").await.unwrap().is_empty());
            store.zadd_upsert("private-zset", 1.0, "one").await.unwrap();
            assert_eq!(
                store.zrevrange("private-zset", 0, -1).await.unwrap(),
                ["one"]
            );
            assert_eq!(
                store
                    .zrangebyscore_limit("private-zset", "-inf", "+inf", 0, 10)
                    .await
                    .unwrap(),
                ["one"]
            );
            store.ztrim_below("private-zset", 0.0).await.unwrap();
            store
                .write_candle_windows(&[(
                    "private-candles".into(),
                    vec![(2.0, "two".into())],
                    None,
                )])
                .await
                .unwrap();
            fixture.fail("ZREVRANGE", "private-error", Failure::Error);
            let rows = store
                .zrevrange_many(&[
                    ("private-error".into(), 0, -1),
                    ("private-zset".into(), 0, -1),
                ])
                .await
                .unwrap();
            assert_eq!(rows, [vec![], vec!["one".to_string()]]);
            assert_eq!(
                store
                    .zrevrange_many(&[
                        ("private-missing-a".into(), 0, -1),
                        ("private-missing-b".into(), 0, -1),
                    ])
                    .await
                    .unwrap(),
                [Vec::<String>::new(), Vec::new()]
            );
            assert_eq!(
                store
                    .zrevrange_many(&[
                        ("private-missing-a".into(), 0, -1),
                        ("private-zset".into(), 0, -1),
                    ])
                    .await
                    .unwrap(),
                [vec![], vec!["one".to_string()]]
            );
            fixture.fail("GET", "private", Failure::Error);
            assert!(store.get_string("private").await.is_err());
        })
        .await
        .unwrap();
        assert_eq!(
            results(&recorder),
            [
                ("get_string", "miss"),
                ("set_string", "success"),
                ("get_string", "success"),
                ("hgetall", "miss"),
                ("zadd_upsert_many", "success"),
                ("zrevrange", "success"),
                ("zrangebyscore_limit", "success"),
                ("ztrim_below", "success"),
                ("write_candle_windows", "success"),
                ("zrevrange_many", "partial"),
                ("zrevrange_many", "miss"),
                ("zrevrange_many", "success"),
                ("get_string", "error"),
            ]
            .map(|(op, result)| (op.to_string(), result.to_string()))
        );
        store.zadd_upsert_many(&[]).await.unwrap();
        store.write_candle_windows(&[]).await.unwrap();
        store.zrevrange_many(&[]).await.unwrap();
        assert!(recorder.take().is_empty());
    }

    #[tokio::test]
    async fn reconnect_is_reported_as_one_store_operation_without_a_dedicated_family() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store();
        store.get_string("private").await.unwrap();
        let _enabled = Enabled::new(true);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        for (failures, result) in [(1, "miss"), (2, "error")] {
            for _ in 0..failures {
                fixture.fail("GET", "private", Failure::Disconnect);
            }
            let fetched = tokio::time::timeout(
                std::time::Duration::from_secs(10),
                store.get_string("private"),
            )
            .await
            .unwrap();
            assert_eq!(fetched.is_ok(), failures == 1);
            let events = recorder.take();
            assert_eq!(
                events
                    .iter()
                    .filter(|event| event.name == metrics::REDIS_DURATION)
                    .count(),
                1
            );
            assert_eq!(
                events
                    .iter()
                    .find(|event| event.name == metrics::REDIS_DURATION)
                    .unwrap()
                    .labels[2]
                    .1,
                result
            );
            assert!(events.iter().all(|event| !event.name.contains("reconnect")));
        }
    }

    #[tokio::test(start_paused = true)]
    async fn cancelled_slot_wait_is_balanced_and_write_slot_does_not_block_reads() {
        let fixture = RedisFixture::start().await;
        let store = fixture.store();
        let _enabled = Enabled::new(true);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        let write_lock = store.write.conn.lock().await;
        let mut write = Box::pin(store.set_string("private", "value"));
        assert!(futures_util::poll!(&mut write).is_pending());
        assert!(store.read.conn.try_lock().is_ok());
        tokio::time::advance(std::time::Duration::from_secs(3)).await;
        drop(write);
        drop(write_lock);
        let events = recorder.take();
        assert_eq!(
            events
                .iter()
                .filter(|event| event.name == metrics::REDIS_WAITERS)
                .map(|event| event.value)
                .sum::<f64>(),
            0.0
        );
        assert_eq!(
            events
                .iter()
                .find(|event| event.name == metrics::REDIS_SLOT_WAIT)
                .unwrap()
                .value,
            3.0
        );
        let operation = events
            .iter()
            .find(|event| event.name == metrics::REDIS_DURATION)
            .unwrap();
        assert_eq!(operation.labels[2].1, "error");
        assert_eq!(operation.value, 3.0);
        assert!(fixture.commands().is_empty());
    }
}
