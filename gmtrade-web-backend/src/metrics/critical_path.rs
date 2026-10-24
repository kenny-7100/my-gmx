//! Bounded-label, opt-in observations. No helper changes a business result.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use axum::{extract::MatchedPath, extract::Request, middleware::Next, response::Response};
use tokio::time::Instant;

pub(crate) const HTTP_DURATION: &str = "gmtrade_web_backend.http.request_duration_seconds";
pub(crate) const HTTP_IN_FLIGHT: &str = "gmtrade_web_backend.http.requests_in_flight";
pub(crate) const REFRESH_DURATION: &str = "gmtrade_web_backend.refresh.duration_seconds";
pub(crate) const UPSTREAM_DURATION: &str = "gmtrade_web_backend.upstream.duration_seconds";
pub(crate) const REDIS_DURATION: &str = "gmtrade_web_backend.redis.operation_duration_seconds";
pub(crate) const REDIS_SLOT_WAIT: &str = "gmtrade_web_backend.redis.slot_wait_duration_seconds";
pub(crate) const REDIS_WAITERS: &str = "gmtrade_web_backend.redis.slot_waiters";
pub(crate) const WS_LAGGED: &str = "gmtrade_web_backend.websocket.broadcast_lagged_messages_total";
pub(crate) const WS_LAST_PUSH: &str =
    "gmtrade_web_backend.websocket.last_successful_push_timestamp_seconds";
pub(crate) const EVENT_LOOP_LAG: &str = "gmtrade_web_backend.runtime.event_loop_lag_seconds";

static CRITICAL_PATH_ENABLED: AtomicBool = AtomicBool::new(false);

pub(crate) fn critical_path_enabled() -> bool {
    #[cfg(test)]
    if let Some(enabled) = testing::ENABLED.get() {
        return enabled;
    }
    CRITICAL_PATH_ENABLED.load(Ordering::Relaxed)
}

pub(super) fn enable_critical_path() {
    CRITICAL_PATH_ENABLED.store(true, Ordering::Relaxed);
}

macro_rules! labels {
    ($name:ident { $($variant:ident => $label:literal),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
        pub enum $name { $($variant),+ }
        impl $name {
            pub(crate) const fn label(self) -> &'static str {
                match self { $(Self::$variant => $label),+ }
            }
        }
    };
}

labels!(Worker {
    Snapshot => "snapshot", CandlePrefetch => "candle_prefetch", CandleRefresh => "candle_refresh",
    DailyAnn => "daily_ann", DailyFeeApy => "daily_fee_apy", DailyGtUpdates => "daily_gt_updates",
    DailyPrices => "daily_prices",
});
labels!(RefreshResult {
    Completed => "completed", Failure => "failure", Skipped => "skipped",
});
labels!(UpstreamResult { Success => "success", Empty => "empty", Error => "error" });
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RedisSlot {
    Read,
    Write,
    #[cfg(feature = "nightly-candles-read-pool")]
    CandlesPool,
}

impl RedisSlot {
    pub(crate) const fn label(self) -> &'static str {
        match self {
            Self::Read => "read",
            Self::Write => "write",
            #[cfg(feature = "nightly-candles-read-pool")]
            Self::CandlesPool => "candles_pool",
        }
    }
}
labels!(RedisOperation {
    SetString => "set_string", ZaddUpsertMany => "zadd_upsert_many", WriteCandleWindows => "write_candle_windows",
    ZtrimBelow => "ztrim_below", GetString => "get_string", Hgetall => "hgetall", Zrevrange => "zrevrange",
    ZrevrangeMany => "zrevrange_many", ZrangebyscoreLimit => "zrangebyscore_limit",
});
labels!(RedisResult { Success => "success", Miss => "miss", Partial => "partial", Error => "error" });
labels!(WsTopic {
    Heartbeat => "heartbeat", IndexTokens => "indexTokens", Tickers => "tickers", SwapList => "swapList",
    Candles => "candles", StoreBalances => "storeBalances", TokenMints => "tokenMints", Glvs => "glvs",
});

impl From<&crate::ws_protocol::Topic> for WsTopic {
    fn from(topic: &crate::ws_protocol::Topic) -> Self {
        use crate::ws_protocol::Topic;
        match topic {
            Topic::Heartbeat => Self::Heartbeat,
            Topic::IndexTokens => Self::IndexTokens,
            Topic::Tickers => Self::Tickers,
            Topic::SwapList => Self::SwapList,
            Topic::Candles { .. } => Self::Candles,
            Topic::StoreBalances => Self::StoreBalances,
            Topic::TokenMints(_) => Self::TokenMints,
            Topic::Glvs { .. } => Self::Glvs,
        }
    }
}

/// Encoding the pair in one enum prevents invalid dependency/operation combinations.
#[derive(Debug, Clone, Copy)]
pub(crate) enum UpstreamOperation {
    DiscoverMarkets,
    FetchMarketAccounts,
    ArbitrumTickers,
    ArbitrumCandles,
    DataEngineCandles,
    PriceCandleWindow,
    PriceCandleBatch,
    SqdVolumes,
    SqdAnnPerformance,
    SqdFeeApy,
    SqdGmPrices,
    SqdGlvPrices,
    SqdGtUpdates,
    SqdGtUpdatesBackfill,
}

impl UpstreamOperation {
    pub(crate) const fn labels(self) -> (&'static str, &'static str) {
        match self {
            Self::DiscoverMarkets => ("solana_rpc", "discover_markets"),
            Self::FetchMarketAccounts => ("solana_rpc", "fetch_market_accounts"),
            Self::ArbitrumTickers => ("arbitrum", "fetch_tickers"),
            Self::ArbitrumCandles => ("arbitrum", "fetch_candles"),
            Self::DataEngineCandles => ("data_engine", "fetch_candles"),
            Self::PriceCandleWindow => ("price_candle", "fetch_window"),
            Self::PriceCandleBatch => ("price_candle", "fetch_batch"),
            Self::SqdVolumes => ("sqd", "volumes"),
            Self::SqdAnnPerformance => ("sqd", "ann_performance"),
            Self::SqdFeeApy => ("sqd", "fee_apy"),
            Self::SqdGmPrices => ("sqd", "gm_prices"),
            Self::SqdGlvPrices => ("sqd", "glv_prices"),
            Self::SqdGtUpdates => ("sqd", "gt_updates"),
            Self::SqdGtUpdatesBackfill => ("sqd", "gt_updates_backfill"),
        }
    }
}

fn upstream_result<T, E>(result: &Result<T, E>, empty: impl FnOnce(&T) -> bool) -> UpstreamResult {
    match result {
        Ok(value) if empty(value) => UpstreamResult::Empty,
        Ok(_) => UpstreamResult::Success,
        Err(_) => UpstreamResult::Error,
    }
}

pub(crate) struct UpstreamGuard {
    started: Option<Instant>,
    operation: UpstreamOperation,
}

impl UpstreamGuard {
    pub(crate) fn start(operation: UpstreamOperation) -> Self {
        Self {
            started: critical_path_enabled().then(Instant::now),
            operation,
        }
    }

    pub(crate) fn start_if(operation: UpstreamOperation, condition: impl FnOnce() -> bool) -> Self {
        let started = if critical_path_enabled() && condition() {
            Some(Instant::now())
        } else {
            None
        };
        Self { started, operation }
    }

    #[cfg(test)]
    pub(crate) fn finish(mut self, result: UpstreamResult) {
        self.record(result);
    }

    pub(crate) fn finish_result<T, E>(
        mut self,
        result: &Result<T, E>,
        empty: impl FnOnce(&T) -> bool,
    ) {
        if self.started.is_none() {
            return;
        }
        self.record(upstream_result(result, empty));
    }

    fn record(&mut self, result: UpstreamResult) {
        let Some(started) = self.started.take() else {
            return;
        };
        let (dependency, operation) = self.operation.labels();
        ::metrics::histogram!(UPSTREAM_DURATION, "dependency" => dependency, "operation" => operation, "result" => result.label())
            .record(started.elapsed().as_secs_f64());
    }
}

impl Drop for UpstreamGuard {
    fn drop(&mut self) {
        self.record(UpstreamResult::Error);
    }
}

pub(crate) struct RefreshGuard {
    started: Option<Instant>,
    worker: Worker,
}

impl RefreshGuard {
    pub(crate) fn start(worker: Worker) -> Self {
        Self {
            started: critical_path_enabled().then(Instant::now),
            worker,
        }
    }

    pub(crate) fn finish(self, result: RefreshResult) {
        let Some(started) = self.started else { return };
        ::metrics::histogram!(REFRESH_DURATION, "worker" => self.worker.label(), "result" => result.label())
            .record(started.elapsed().as_secs_f64());
    }

    pub(crate) fn finish_with(self, result: impl FnOnce() -> RefreshResult) {
        if self.started.is_none() {
            return;
        }
        self.finish(result());
    }
}

pub(crate) struct RedisOperationGuard {
    started: Option<Instant>,
    operation: RedisOperation,
    slot: RedisSlot,
}

impl RedisOperationGuard {
    pub(crate) fn start(slot: RedisSlot, operation: RedisOperation) -> Self {
        Self {
            started: critical_path_enabled().then(Instant::now),
            operation,
            slot,
        }
    }

    pub(crate) fn finish(mut self, result: RedisResult) {
        self.record(result);
    }

    pub(crate) fn is_enabled(&self) -> bool {
        self.started.is_some()
    }

    pub(crate) fn finish_with(mut self, result: impl FnOnce() -> RedisResult) {
        if self.started.is_none() {
            return;
        }
        self.record(result());
    }

    fn record(&mut self, result: RedisResult) {
        let Some(started) = self.started.take() else {
            return;
        };
        ::metrics::histogram!(REDIS_DURATION, "direction" => self.slot.label(), "operation" => self.operation.label(), "result" => result.label())
            .record(started.elapsed().as_secs_f64());
    }
}

impl Drop for RedisOperationGuard {
    fn drop(&mut self) {
        self.record(RedisResult::Error);
    }
}

pub(crate) struct RedisSlotWaitGuard {
    started: Option<Instant>,
    slot: RedisSlot,
}

impl RedisSlotWaitGuard {
    pub(crate) fn start(slot: RedisSlot) -> Self {
        let started = critical_path_enabled().then(Instant::now);
        if started.is_some() {
            ::metrics::gauge!(REDIS_WAITERS, "slot" => slot.label()).increment(1.0);
        }
        Self { started, slot }
    }

    pub(crate) fn acquired(self) {}
}

impl Drop for RedisSlotWaitGuard {
    fn drop(&mut self) {
        if let Some(started) = self.started.take() {
            ::metrics::histogram!(REDIS_SLOT_WAIT, "slot" => self.slot.label())
                .record(started.elapsed().as_secs_f64());
            ::metrics::gauge!(REDIS_WAITERS, "slot" => self.slot.label()).decrement(1.0);
        }
    }
}

pub(crate) fn record_ws_lag(topic: WsTopic, lost: u64) {
    if !critical_path_enabled() {
        return;
    }
    ::metrics::counter!(WS_LAGGED, "topic" => topic.label()).increment(lost);
}

pub(crate) fn record_ws_lag_with(lost: u64, topic: impl FnOnce() -> WsTopic) {
    if !critical_path_enabled() {
        return;
    }
    let topic = topic();
    ::metrics::counter!(WS_LAGGED, "topic" => topic.label()).increment(lost);
}

#[cfg(test)]
pub(crate) fn record_ws_push(topic: WsTopic) {
    record_ws_push_if(topic, || true);
}

pub(crate) fn record_ws_push_if(topic: WsTopic, sent: impl FnOnce() -> bool) {
    if !critical_path_enabled() || !sent() {
        return;
    }
    ::metrics::gauge!(WS_LAST_PUSH, "topic" => topic.label()).set(crate::util::now_unix() as f64);
}

fn route_label(route: Option<&str>) -> &'static str {
    match route {
        Some("/healthz") => "/healthz",
        Some("/healthz/active") => "/healthz/active",
        Some("/ws") => "/ws",
        Some("/cache/prices/tickers") => "/cache/prices/tickers",
        Some("/v2/cache/prices/tickers") => "/v2/cache/prices/tickers",
        Some("/v2/cache/prices/indexData") => "/v2/cache/prices/indexData",
        Some("/v2/cache/prices/candles") => "/v2/cache/prices/candles",
        Some("/v2/cache/daily/annPerformance") => "/v2/cache/daily/annPerformance",
        Some("/v2/cache/daily/feeApy") => "/v2/cache/daily/feeApy",
        Some("/v2/cache/daily/gmPrices") => "/v2/cache/daily/gmPrices",
        Some("/v2/cache/daily/glvPrices") => "/v2/cache/daily/glvPrices",
        Some("/v2/cache/daily/gtUpdates") => "/v2/cache/daily/gtUpdates",
        Some("/log/p") => "/log/p",
        Some("/api/s") => "/api/s",
        Some("/v2/upload") => "/v2/upload",
        Some("/v2/cache/store/balances") => "/v2/cache/store/balances",
        Some("/v2/cache/store/tokenMints") => "/v2/cache/store/tokenMints",
        Some("/v2/cache/glvs") => "/v2/cache/glvs",
        Some("/v2/cache/keeper/metrics") => "/v2/cache/keeper/metrics",
        _ => "unmatched",
    }
}

fn status_label(status: axum::http::StatusCode) -> &'static str {
    match status.as_u16() {
        101 => "101",
        200 => "200",
        400 => "400",
        404 => "404",
        405 => "405",
        413 => "413",
        422 => "422",
        500 => "500",
        503 => "503",
        _ => "other",
    }
}

struct HttpGuard {
    started: Option<Instant>,
    route: &'static str,
}

impl HttpGuard {
    fn start(route: &'static str) -> Self {
        let started = critical_path_enabled().then(Instant::now);
        if started.is_some() {
            ::metrics::gauge!(HTTP_IN_FLIGHT, "route" => route).increment(1.0);
        }
        Self { started, route }
    }

    fn finish(mut self, status: axum::http::StatusCode) {
        if self.started.is_none() {
            return;
        }
        self.record(status_label(status));
    }

    fn record(&mut self, status: &'static str) {
        let Some(started) = self.started.take() else {
            return;
        };
        ::metrics::histogram!(HTTP_DURATION, "route" => self.route, "status" => status)
            .record(started.elapsed().as_secs_f64());
        ::metrics::gauge!(HTTP_IN_FLIGHT, "route" => self.route).decrement(1.0);
    }
}

impl Drop for HttpGuard {
    fn drop(&mut self) {
        self.record("cancelled");
    }
}

#[cfg(test)]
pub(crate) fn emit_http_smoke_sample() {
    HttpGuard::start("/healthz").finish(axum::http::StatusCode::OK);
}

pub(crate) async fn http_middleware(request: Request, next: Next) -> Response {
    if !critical_path_enabled() {
        return next.run(request).await;
    }
    let route = route_label(
        request
            .extensions()
            .get::<MatchedPath>()
            .map(MatchedPath::as_str),
    );
    let guard = HttpGuard::start(route);
    let response = next.run(request).await;
    guard.finish(response.status());
    response
}

fn next_deadline(deadline: Instant, now: Instant, period: Duration) -> Instant {
    let next = deadline + period;
    if next <= now {
        now + period
    } else {
        next
    }
}

pub(crate) async fn run_event_loop_lag() {
    if !critical_path_enabled() {
        return;
    }
    let period = Duration::from_secs(1);
    let mut deadline = Instant::now() + period;
    loop {
        tokio::time::sleep_until(deadline).await;
        let now = Instant::now();
        ::metrics::histogram!(EVENT_LOOP_LAG)
            .record(now.saturating_duration_since(deadline).as_secs_f64());
        deadline = next_deadline(deadline, now, period);
    }
}

#[cfg(test)]
pub(crate) mod testing {
    use ::metrics::{
        Counter, CounterFn, Gauge, GaugeFn, Histogram, HistogramFn, Key, KeyName, Metadata,
        Recorder, SharedString, Unit,
    };
    use std::{
        cell::Cell,
        sync::{Arc, Mutex},
    };

    thread_local! { pub(super) static ENABLED: Cell<Option<bool>> = const { Cell::new(None) }; }

    pub(crate) struct Enabled(Option<bool>);
    impl Enabled {
        pub(crate) fn new(enabled: bool) -> Self {
            Self(ENABLED.replace(Some(enabled)))
        }
    }
    impl Drop for Enabled {
        fn drop(&mut self) {
            ENABLED.set(self.0);
        }
    }

    #[derive(Debug, Clone, PartialEq)]
    pub(crate) struct MetricEvent {
        pub(crate) kind: &'static str,
        pub(crate) name: String,
        pub(crate) labels: Vec<(String, String)>,
        pub(crate) value: f64,
    }

    #[derive(Default)]
    pub(crate) struct RecordingRecorder {
        pub(crate) events: Arc<Mutex<Vec<MetricEvent>>>,
    }

    struct Handle {
        kind: &'static str,
        key: Key,
        events: Arc<Mutex<Vec<MetricEvent>>>,
    }
    impl Handle {
        fn record(&self, value: f64) {
            self.events.lock().unwrap().push(MetricEvent {
                kind: self.kind,
                name: self.key.name().into(),
                labels: self
                    .key
                    .labels()
                    .map(|l| (l.key().into(), l.value().into()))
                    .collect(),
                value,
            });
        }
    }
    impl CounterFn for Handle {
        fn increment(&self, value: u64) {
            self.record(value as f64);
        }
        fn absolute(&self, value: u64) {
            self.record(value as f64);
        }
    }
    impl GaugeFn for Handle {
        fn increment(&self, value: f64) {
            self.record(value);
        }
        fn decrement(&self, value: f64) {
            self.record(-value);
        }
        fn set(&self, value: f64) {
            self.record(value);
        }
    }
    impl HistogramFn for Handle {
        fn record(&self, value: f64) {
            self.record(value);
        }
    }
    impl RecordingRecorder {
        fn handle(&self, key: &Key, kind: &'static str) -> Arc<Handle> {
            Arc::new(Handle {
                kind,
                key: key.clone(),
                events: self.events.clone(),
            })
        }
        pub(crate) fn take(&self) -> Vec<MetricEvent> {
            std::mem::take(&mut *self.events.lock().unwrap())
        }
    }
    impl Recorder for RecordingRecorder {
        fn describe_counter(&self, _: KeyName, _: Option<Unit>, _: SharedString) {}
        fn describe_gauge(&self, _: KeyName, _: Option<Unit>, _: SharedString) {}
        fn describe_histogram(&self, _: KeyName, _: Option<Unit>, _: SharedString) {}
        fn register_counter(&self, key: &Key, _: &Metadata<'_>) -> Counter {
            Counter::from_arc(self.handle(key, "counter"))
        }
        fn register_gauge(&self, key: &Key, _: &Metadata<'_>) -> Gauge {
            Gauge::from_arc(self.handle(key, "gauge"))
        }
        fn register_histogram(&self, key: &Key, _: &Metadata<'_>) -> Histogram {
            Histogram::from_arc(self.handle(key, "histogram"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::testing::{Enabled, RecordingRecorder};
    use super::*;
    use axum::{body::Body, http::StatusCode, routing::get, Router};
    use tower::ServiceExt;

    #[tokio::test(start_paused = true)]
    async fn catalog_emits_exactly_ten_families_with_the_declared_types() {
        let _enabled = Enabled::new(true);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        HttpGuard::start("/healthz").finish(StatusCode::OK);
        RefreshGuard::start(Worker::Snapshot).finish(RefreshResult::Completed);
        UpstreamGuard::start(UpstreamOperation::FetchMarketAccounts)
            .finish(UpstreamResult::Success);
        let operation = RedisOperationGuard::start(RedisSlot::Write, RedisOperation::SetString);
        operation.finish(RedisResult::Success);
        RedisSlotWaitGuard::start(RedisSlot::Write).acquired();
        record_ws_lag(WsTopic::Tickers, 3);
        record_ws_push(WsTopic::Heartbeat);
        let mut lag = Box::pin(run_event_loop_lag());
        assert!(futures_util::poll!(&mut lag).is_pending());
        tokio::time::advance(Duration::from_secs(1)).await;
        assert!(futures_util::poll!(&mut lag).is_pending());
        let actual: std::collections::BTreeMap<_, _> = recorder
            .take()
            .into_iter()
            .map(|event| (event.name, event.kind))
            .collect();
        let expected: std::collections::BTreeMap<_, _> = [
            (HTTP_DURATION, "histogram"),
            (HTTP_IN_FLIGHT, "gauge"),
            (REFRESH_DURATION, "histogram"),
            (UPSTREAM_DURATION, "histogram"),
            (REDIS_DURATION, "histogram"),
            (REDIS_SLOT_WAIT, "histogram"),
            (REDIS_WAITERS, "gauge"),
            (WS_LAGGED, "counter"),
            (WS_LAST_PUSH, "gauge"),
            (EVENT_LOOP_LAG, "histogram"),
        ]
        .map(|(name, kind)| (name.to_string(), kind))
        .into_iter()
        .collect();
        assert_eq!(actual, expected);
        assert_eq!(actual.len(), 10);
    }

    #[tokio::test(start_paused = true)]
    async fn http_completion_and_unmatched_routes_use_only_fixed_labels() {
        let _enabled = Enabled::new(true);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        let router = Router::new()
            .route("/healthz", get(|| async { StatusCode::OK }))
            .layer(axum::middleware::from_fn(http_middleware));
        for (uri, route, status) in [
            ("/healthz?token=private", "/healthz", "200"),
            ("/private-token", "unmatched", "404"),
        ] {
            let response = router
                .clone()
                .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status().as_str(), status);
            let events = recorder.take();
            assert_eq!(events.len(), 3);
            assert_eq!(events[0].name, HTTP_IN_FLIGHT);
            assert_eq!(events[0].value, 1.0);
            assert_eq!(events[1].name, HTTP_DURATION);
            assert_eq!(
                events[1].labels,
                [
                    ("route".into(), route.into()),
                    ("status".into(), status.into())
                ]
            );
            assert_eq!(events[1].kind, "histogram");
            assert_eq!(events[2].value, -1.0);
            assert!(events
                .iter()
                .all(|e| !format!("{:?}", e.labels).contains("private")));
        }
        for code in [101, 200, 400, 404, 405, 413, 422, 500, 503] {
            assert_eq!(
                status_label(StatusCode::from_u16(code).unwrap()),
                code.to_string()
            );
        }
        assert_eq!(status_label(StatusCode::CREATED), "other");
        assert_eq!(route_label(Some("/future/{token}")), "unmatched");
    }

    #[tokio::test(start_paused = true)]
    async fn polled_http_cancellation_records_waited_duration_once_and_cleans_gauge() {
        let _enabled = Enabled::new(true);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        let router = Router::new()
            .route(
                "/healthz",
                get(|| async { std::future::pending::<StatusCode>().await }),
            )
            .layer(axum::middleware::from_fn(http_middleware));
        let mut request = Box::pin(
            router.oneshot(
                Request::builder()
                    .uri("/healthz")
                    .body(Body::empty())
                    .unwrap(),
            ),
        );
        assert!(futures_util::poll!(&mut request).is_pending());
        let events = recorder.take();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].value, 1.0);
        tokio::time::advance(Duration::from_secs(7)).await;
        drop(request);
        let events = recorder.take();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].labels[1].1, "cancelled");
        assert_eq!(events[0].name, HTTP_DURATION);
        assert_eq!(events[0].value, 7.0);
        assert_eq!(events[1].name, HTTP_IN_FLIGHT);
        assert_eq!(events[1].value, -1.0);
    }

    #[tokio::test(start_paused = true)]
    async fn upstream_timeout_records_once() {
        let _enabled = Enabled::new(true);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        let result = tokio::time::timeout(Duration::from_secs(3), async {
            let _guard = UpstreamGuard::start(UpstreamOperation::SqdGtUpdatesBackfill);
            std::future::pending::<()>().await;
        })
        .await;
        assert!(result.is_err());
        let events = recorder.take();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].value, 3.0);
        assert_eq!(
            events[0].labels,
            [
                ("dependency".into(), "sqd".into()),
                ("operation".into(), "gt_updates_backfill".into()),
                ("result".into(), "error".into())
            ]
        );
        let guard = UpstreamGuard::start(UpstreamOperation::SqdGmPrices);
        tokio::time::advance(Duration::from_secs(5)).await;
        guard.finish(UpstreamResult::Success);
        assert_eq!(recorder.take().len(), 1);
    }

    #[tokio::test(start_paused = true)]
    async fn runtime_disabled_helpers_do_not_emit_events() {
        let _enabled = Enabled::new(false);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        HttpGuard::start("/healthz").finish(StatusCode::OK);
        RefreshGuard::start(Worker::Snapshot).finish(RefreshResult::Completed);
        UpstreamGuard::start(UpstreamOperation::SqdVolumes).finish(UpstreamResult::Success);
        RedisOperationGuard::start(RedisSlot::Read, RedisOperation::GetString)
            .finish(RedisResult::Success);
        RedisSlotWaitGuard::start(RedisSlot::Read).acquired();
        record_ws_lag(WsTopic::Tickers, 2);
        record_ws_push(WsTopic::Tickers);
        run_event_loop_lag().await;
        assert!(recorder.take().is_empty());
    }

    #[test]
    fn runtime_disabled_guards_do_not_run_metric_classifiers() {
        let _enabled = Enabled::new(false);
        let classifications = std::cell::Cell::new(0);
        let fetched: Result<Vec<()>, ()> = Ok(Vec::new());

        UpstreamGuard::start_if(UpstreamOperation::SqdVolumes, || {
            classifications.set(classifications.get() + 1);
            true
        })
        .finish_result(&fetched, |_| {
            classifications.set(classifications.get() + 1);
            true
        });
        RedisOperationGuard::start(RedisSlot::Read, RedisOperation::GetString).finish_with(|| {
            classifications.set(classifications.get() + 1);
            RedisResult::Miss
        });
        RefreshGuard::start(Worker::Snapshot).finish_with(|| {
            classifications.set(classifications.get() + 1);
            RefreshResult::Completed
        });
        record_ws_lag_with(1, || {
            classifications.set(classifications.get() + 1);
            WsTopic::Tickers
        });
        record_ws_push_if(WsTopic::Tickers, || {
            classifications.set(classifications.get() + 1);
            true
        });

        assert_eq!(classifications.get(), 0);
    }

    #[tokio::test(start_paused = true)]
    async fn slot_cancellation_cleanup_is_balanced() {
        let _enabled = Enabled::new(true);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        let slot = RedisSlotWaitGuard::start(RedisSlot::Write);
        tokio::time::advance(Duration::from_secs(2)).await;
        drop(slot);
        let events = recorder.take();
        assert_eq!(events.len(), 3);
        assert_eq!(events[1].value, 2.0);
        assert_eq!(events[0].value + events[2].value, 0.0);
    }

    #[tokio::test(start_paused = true)]
    async fn event_loop_skips_missed_deadlines_without_catch_up_burst() {
        let _enabled = Enabled::new(true);
        let recorder = RecordingRecorder::default();
        let _recorder = ::metrics::set_default_local_recorder(&recorder);
        let mut worker = Box::pin(run_event_loop_lag());
        assert!(futures_util::poll!(&mut worker).is_pending());
        tokio::time::advance(Duration::from_secs(5)).await;
        assert!(futures_util::poll!(&mut worker).is_pending());
        let events = recorder.take();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, EVENT_LOOP_LAG);
        assert_eq!(events[0].value, 4.0);
        assert!(events[0].labels.is_empty());
        assert!(futures_util::poll!(&mut worker).is_pending());
        assert!(recorder.take().is_empty());
        tokio::time::advance(Duration::from_secs(1)).await;
        assert!(futures_util::poll!(&mut worker).is_pending());
        assert_eq!(recorder.take()[0].value, 0.0);
    }
}
