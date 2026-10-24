//! Keeper market-order execution-time subscriptions and in-memory aggregate cache.

use std::{error::Error, future::Future, sync::Arc, time::Duration};

use arc_swap::ArcSwap;
use eyre::{eyre, WrapErr};
use futures_util::{Sink, SinkExt, StreamExt};
use serde::Serialize;
use tokio::time::Instant;
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, http::HeaderValue, Message};

use crate::config::{
    resolve_keeper_execution_time_endpoints, KeeperExecutionTimeConfig,
    KeeperExecutionTimeEndpointError, ResolvedKeeperExecutionTimeEndpoint,
};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const WRITE_TIMEOUT: Duration = Duration::from_secs(10);
const FRAME_IDLE_TIMEOUT: Duration = Duration::from_secs(60);
const SNAPSHOT_WATCHDOG_TIMEOUT: Duration = Duration::from_secs(75);
const RECONNECT_DELAY: Duration = Duration::from_secs(2);
const GRAPHQL_INT_MAX: u64 = i32::MAX as u64;
const SUBSCRIPTION_QUERY: &str = "subscription { ticks { windowSeconds sampleCount avgMs maxMs } }";

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperMetricsResponse {
    pub estimated_execution_time_seconds: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum KeeperExecutionTimeUnavailableReason {
    RuntimeDisabled,
    EndpointMissing,
    EndpointInvalid,
    WaitingForFirstSnapshot,
    EmptySnapshot,
    ContractIncompatible,
    TransportUnavailable,
    SnapshotStale,
    SnapshotMisaligned,
}

impl KeeperExecutionTimeUnavailableReason {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::RuntimeDisabled => "runtime disabled",
            Self::EndpointMissing => "endpoint missing",
            Self::EndpointInvalid => "endpoint invalid",
            Self::WaitingForFirstSnapshot => "waiting for first snapshot",
            Self::EmptySnapshot => "empty snapshot",
            Self::ContractIncompatible => "contract incompatible",
            Self::TransportUnavailable => "transport unavailable",
            Self::SnapshotStale => "snapshot stale",
            Self::SnapshotMisaligned => "snapshot misaligned",
        }
    }
}

impl From<KeeperExecutionTimeEndpointError> for KeeperExecutionTimeUnavailableReason {
    fn from(value: KeeperExecutionTimeEndpointError) -> Self {
        match value {
            KeeperExecutionTimeEndpointError::RuntimeDisabled => Self::RuntimeDisabled,
            KeeperExecutionTimeEndpointError::EndpointMissing => Self::EndpointMissing,
            KeeperExecutionTimeEndpointError::EndpointInvalid => Self::EndpointInvalid,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
enum KeeperExecutionTimeSourceState {
    WaitingForFirstSnapshot,
    Unavailable {
        reason: KeeperExecutionTimeUnavailableReason,
    },
    Snapshot {
        window_seconds: u64,
        sample_count: u64,
        avg_ms: u64,
        received_at: Instant,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ValidatedSnapshot {
    window_seconds: u64,
    sample_count: u64,
    avg_ms: u64,
}

#[derive(Clone)]
struct KeeperExecutionTimeSourceHandle {
    source_index: usize,
    inner: Arc<ArcSwap<KeeperExecutionTimeSourceState>>,
}

impl KeeperExecutionTimeSourceHandle {
    fn waiting(source_index: usize) -> Self {
        Self {
            source_index,
            inner: Arc::new(ArcSwap::from_pointee(
                KeeperExecutionTimeSourceState::WaitingForFirstSnapshot,
            )),
        }
    }

    fn state(&self) -> Arc<KeeperExecutionTimeSourceState> {
        self.inner.load_full()
    }

    fn update_snapshot(&self, snapshot: ValidatedSnapshot, received_at: Instant) {
        self.inner
            .store(Arc::new(KeeperExecutionTimeSourceState::Snapshot {
                window_seconds: snapshot.window_seconds,
                sample_count: snapshot.sample_count,
                avg_ms: snapshot.avg_ms,
                received_at,
            }));
    }

    fn set_contract_unavailable(&self) {
        self.inner
            .store(Arc::new(KeeperExecutionTimeSourceState::Unavailable {
                reason: KeeperExecutionTimeUnavailableReason::ContractIncompatible,
            }));
    }

    fn note_transport_failure(&self) {
        if !matches!(
            &*self.state(),
            KeeperExecutionTimeSourceState::Snapshot { .. }
        ) {
            self.inner
                .store(Arc::new(KeeperExecutionTimeSourceState::Unavailable {
                    reason: KeeperExecutionTimeUnavailableReason::TransportUnavailable,
                }));
        }
    }
}

#[derive(Clone)]
pub struct KeeperExecutionTimeHandle {
    global_reason: Option<KeeperExecutionTimeUnavailableReason>,
    sources: Arc<Vec<KeeperExecutionTimeSourceHandle>>,
    resolved_sources: Arc<Vec<ResolvedKeeperExecutionTimeEndpoint>>,
}

impl KeeperExecutionTimeHandle {
    pub fn disabled(reason: KeeperExecutionTimeUnavailableReason) -> Self {
        Self {
            global_reason: Some(reason),
            sources: Arc::new(Vec::new()),
            resolved_sources: Arc::new(Vec::new()),
        }
    }

    pub fn from_config(config: &KeeperExecutionTimeConfig, shared_keeper_endpoint: &str) -> Self {
        match resolve_keeper_execution_time_endpoints(config, shared_keeper_endpoint) {
            Ok(resolved_sources) => Self::from_resolved_sources(resolved_sources),
            Err(error) => Self::disabled(error.into()),
        }
    }

    fn from_resolved_sources(resolved_sources: Vec<ResolvedKeeperExecutionTimeEndpoint>) -> Self {
        let sources = resolved_sources
            .iter()
            .map(|source| KeeperExecutionTimeSourceHandle::waiting(source.source_index))
            .collect();
        Self {
            global_reason: None,
            sources: Arc::new(sources),
            resolved_sources: Arc::new(resolved_sources),
        }
    }

    #[cfg(test)]
    pub(crate) fn for_source_count(source_count: usize) -> Self {
        Self {
            global_reason: None,
            sources: Arc::new(
                (0..source_count)
                    .map(KeeperExecutionTimeSourceHandle::waiting)
                    .collect(),
            ),
            resolved_sources: Arc::new(Vec::new()),
        }
    }

    pub fn resolved_sources(&self) -> Option<Arc<Vec<ResolvedKeeperExecutionTimeEndpoint>>> {
        if self.global_reason.is_some() || self.resolved_sources.is_empty() {
            None
        } else {
            Some(self.resolved_sources.clone())
        }
    }

    fn source_handle(&self, source_index: usize) -> Option<KeeperExecutionTimeSourceHandle> {
        self.sources.get(source_index).cloned()
    }

    #[cfg(test)]
    pub fn update_snapshot(
        &self,
        source_index: usize,
        window_seconds: u64,
        sample_count: u64,
        avg_ms: u64,
        received_at: Instant,
    ) {
        if let Some(source) = self.source_handle(source_index) {
            source.update_snapshot(
                ValidatedSnapshot {
                    window_seconds,
                    sample_count,
                    avg_ms,
                },
                received_at,
            );
        }
    }

    pub fn set_contract_unavailable(&self, source_index: usize) {
        if let Some(source) = self.source_handle(source_index) {
            source.set_contract_unavailable();
        }
    }

    pub fn note_transport_failure(&self, source_index: usize) {
        if let Some(source) = self.source_handle(source_index) {
            source.note_transport_failure();
        }
    }

    pub fn read_at(
        &self,
        now: Instant,
        max_age: Duration,
    ) -> Result<KeeperMetricsResponse, KeeperExecutionTimeUnavailableReason> {
        if let Some(reason) = self.global_reason {
            return Err(reason);
        }
        if self.sources.is_empty() {
            return Err(KeeperExecutionTimeUnavailableReason::EndpointMissing);
        }

        let states: Vec<_> = self
            .sources
            .iter()
            .map(|source| (*source.state()).clone())
            .collect();

        if states.iter().any(|state| {
            matches!(
                state,
                KeeperExecutionTimeSourceState::Unavailable {
                    reason: KeeperExecutionTimeUnavailableReason::ContractIncompatible
                }
            )
        }) {
            return Err(KeeperExecutionTimeUnavailableReason::ContractIncompatible);
        }

        let common_window = states.iter().find_map(|state| match state {
            KeeperExecutionTimeSourceState::Snapshot { window_seconds, .. } => {
                Some(*window_seconds)
            }
            _ => None,
        });
        if let Some(common_window) = common_window {
            if states.iter().any(|state| {
                matches!(
                    state,
                    KeeperExecutionTimeSourceState::Snapshot { window_seconds, .. }
                        if *window_seconds != common_window
                )
            }) {
                return Err(KeeperExecutionTimeUnavailableReason::ContractIncompatible);
            }
        }

        if states.iter().any(|state| {
            matches!(
                state,
                KeeperExecutionTimeSourceState::WaitingForFirstSnapshot
            )
        }) {
            return Err(KeeperExecutionTimeUnavailableReason::WaitingForFirstSnapshot);
        }

        if states.iter().any(|state| {
            matches!(
                state,
                KeeperExecutionTimeSourceState::Snapshot { received_at, .. }
                    if now.saturating_duration_since(*received_at) > max_age
            )
        }) {
            return Err(KeeperExecutionTimeUnavailableReason::SnapshotStale);
        }

        if states.iter().any(|state| {
            matches!(
                state,
                KeeperExecutionTimeSourceState::Unavailable {
                    reason: KeeperExecutionTimeUnavailableReason::TransportUnavailable
                }
            )
        }) {
            return Err(KeeperExecutionTimeUnavailableReason::TransportUnavailable);
        }

        let snapshots: Vec<_> = states
            .iter()
            .filter_map(|state| match state {
                KeeperExecutionTimeSourceState::Snapshot {
                    window_seconds,
                    sample_count,
                    avg_ms,
                    received_at,
                } => Some((*window_seconds, *sample_count, *avg_ms, *received_at)),
                _ => None,
            })
            .collect();
        if snapshots.len() != states.len() {
            return Err(KeeperExecutionTimeUnavailableReason::TransportUnavailable);
        }

        if snapshots.len() > 1 {
            let min_received_at = snapshots
                .iter()
                .map(|snapshot| snapshot.3)
                .min()
                .expect("snapshots are non-empty");
            let max_received_at = snapshots
                .iter()
                .map(|snapshot| snapshot.3)
                .max()
                .expect("snapshots are non-empty");
            if max_received_at.saturating_duration_since(min_received_at)
                >= Duration::from_secs(snapshots[0].0)
            {
                return Err(KeeperExecutionTimeUnavailableReason::SnapshotMisaligned);
            }
        }

        let mut total_sample_count = 0_u128;
        let mut weighted_sum_ms = 0_u128;
        for (_, sample_count, avg_ms, _) in snapshots {
            total_sample_count = total_sample_count
                .checked_add(u128::from(sample_count))
                .ok_or(KeeperExecutionTimeUnavailableReason::ContractIncompatible)?;
            let weighted_ms = u128::from(avg_ms)
                .checked_mul(u128::from(sample_count))
                .ok_or(KeeperExecutionTimeUnavailableReason::ContractIncompatible)?;
            weighted_sum_ms = weighted_sum_ms
                .checked_add(weighted_ms)
                .ok_or(KeeperExecutionTimeUnavailableReason::ContractIncompatible)?;
        }
        if total_sample_count == 0 {
            return Err(KeeperExecutionTimeUnavailableReason::EmptySnapshot);
        }

        Ok(KeeperMetricsResponse {
            estimated_execution_time_seconds: weighted_sum_ms as f64
                / total_sample_count as f64
                / 1000.0,
        })
    }
}

impl Default for KeeperExecutionTimeHandle {
    fn default() -> Self {
        Self::disabled(KeeperExecutionTimeUnavailableReason::RuntimeDisabled)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ContractErrorKind {
    GraphqlErrorFrame,
    GraphqlPayloadErrors,
    TicksMissing,
    TicksInvalid,
}

impl ContractErrorKind {
    const fn as_str(self) -> &'static str {
        match self {
            Self::GraphqlErrorFrame => "graphql_error_frame",
            Self::GraphqlPayloadErrors => "graphql_payload_errors",
            Self::TicksMissing => "ticks_missing",
            Self::TicksInvalid => "ticks_invalid",
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
enum FrameAction {
    Snapshot(ValidatedSnapshot),
    ContractError(ContractErrorKind),
    ReplyPong,
    Complete,
    Ignore,
}

fn parse_text_frame(text: &str) -> eyre::Result<FrameAction> {
    let value: serde_json::Value =
        serde_json::from_str(text).wrap_err("invalid GraphQL WebSocket JSON frame")?;
    let Some(frame_type) = value.get("type").and_then(serde_json::Value::as_str) else {
        return Err(eyre!("GraphQL WebSocket frame missing type"));
    };

    match frame_type {
        "ping" => Ok(FrameAction::ReplyPong),
        "connection_ack" | "pong" => Ok(FrameAction::Ignore),
        "complete" => Ok(FrameAction::Complete),
        "error" => Ok(FrameAction::ContractError(
            ContractErrorKind::GraphqlErrorFrame,
        )),
        "next" => {
            if value
                .pointer("/payload/errors")
                .is_some_and(|errors| match errors.as_array() {
                    Some(errors) => !errors.is_empty(),
                    None => !errors.is_null(),
                })
            {
                return Ok(FrameAction::ContractError(
                    ContractErrorKind::GraphqlPayloadErrors,
                ));
            }
            let Some(ticks) = value.pointer("/payload/data/ticks") else {
                return Ok(FrameAction::ContractError(ContractErrorKind::TicksMissing));
            };
            if !ticks.is_object() {
                return Ok(FrameAction::ContractError(ContractErrorKind::TicksInvalid));
            }
            let (Some(window_seconds), Some(sample_count), Some(avg_ms), Some(max_ms)) = (
                ticks
                    .get("windowSeconds")
                    .and_then(serde_json::Value::as_u64),
                ticks.get("sampleCount").and_then(serde_json::Value::as_u64),
                ticks.get("avgMs").and_then(serde_json::Value::as_u64),
                ticks.get("maxMs").and_then(serde_json::Value::as_u64),
            ) else {
                return Ok(FrameAction::ContractError(ContractErrorKind::TicksInvalid));
            };
            if window_seconds == 0
                || [window_seconds, sample_count, avg_ms, max_ms]
                    .into_iter()
                    .any(|value| value > GRAPHQL_INT_MAX)
                || (sample_count == 0 && (avg_ms != 0 || max_ms != 0))
                || (sample_count > 0 && avg_ms > max_ms)
                || avg_ms == GRAPHQL_INT_MAX
            {
                return Ok(FrameAction::ContractError(ContractErrorKind::TicksInvalid));
            }
            Ok(FrameAction::Snapshot(ValidatedSnapshot {
                window_seconds,
                sample_count,
                avg_ms,
            }))
        }
        _ => Ok(FrameAction::Ignore),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ConnectionOutcome {
    Ended,
    ContractError(ContractErrorKind),
}

#[derive(Clone, Copy)]
struct ConnectionTimeouts {
    connect: Duration,
    write: Duration,
    frame_idle: Duration,
    snapshot_watchdog: Duration,
}

impl Default for ConnectionTimeouts {
    fn default() -> Self {
        Self {
            connect: CONNECT_TIMEOUT,
            write: WRITE_TIMEOUT,
            frame_idle: FRAME_IDLE_TIMEOUT,
            snapshot_watchdog: SNAPSHOT_WATCHDOG_TIMEOUT,
        }
    }
}

async fn send_with_timeout<S>(
    sink: &mut S,
    message: Message,
    write_timeout: Duration,
) -> eyre::Result<()>
where
    S: Sink<Message> + Unpin,
    S::Error: Error + Send + Sync + 'static,
{
    tokio::time::timeout(write_timeout, sink.send(message))
        .await
        .map_err(|_| eyre!("outbound write timeout"))??;
    Ok(())
}

async fn subscribe_once(
    source: &KeeperExecutionTimeSourceHandle,
    endpoint: &url::Url,
) -> eyre::Result<ConnectionOutcome> {
    subscribe_once_with_timeouts(source, endpoint, ConnectionTimeouts::default()).await
}

async fn subscribe_once_with_timeouts(
    source: &KeeperExecutionTimeSourceHandle,
    endpoint: &url::Url,
    timeouts: ConnectionTimeouts,
) -> eyre::Result<ConnectionOutcome> {
    let mut request = endpoint.as_str().into_client_request()?;
    request.headers_mut().insert(
        "Sec-WebSocket-Protocol",
        HeaderValue::from_static("graphql-transport-ws"),
    );

    let (mut socket, _) =
        tokio::time::timeout(timeouts.connect, tokio_tungstenite::connect_async(request))
            .await
            .map_err(|_| eyre!("connection timeout"))??;

    let now = Instant::now();
    let mut frame_idle_deadline = now + timeouts.frame_idle;
    let mut snapshot_deadline = now + timeouts.snapshot_watchdog;

    send_with_timeout(
        &mut socket,
        Message::text(r#"{"type":"connection_init"}"#),
        timeouts.write,
    )
    .await?;
    let subscribe = serde_json::json!({
        "id": "1",
        "type": "subscribe",
        "payload": { "query": SUBSCRIPTION_QUERY },
    })
    .to_string();
    send_with_timeout(&mut socket, Message::text(subscribe), timeouts.write).await?;

    loop {
        tokio::select! {
            _ = tokio::time::sleep_until(frame_idle_deadline) => {
                return Err(eyre!("frame idle timeout"));
            }
            _ = tokio::time::sleep_until(snapshot_deadline) => {
                return Err(eyre!("snapshot watchdog timeout"));
            }
            next = socket.next() => {
                let Some(next) = next else {
                    return Ok(ConnectionOutcome::Ended);
                };
                let message = next?;
                frame_idle_deadline = Instant::now() + timeouts.frame_idle;

                match message {
                    Message::Text(text) => match parse_text_frame(text.as_str())? {
                        FrameAction::Snapshot(snapshot) => {
                            let received_at = Instant::now();
                            source.update_snapshot(snapshot, received_at);
                            snapshot_deadline = received_at + timeouts.snapshot_watchdog;
                            tracing::debug!(
                                source_index = source.source_index,
                                window_seconds = snapshot.window_seconds,
                                sample_count = snapshot.sample_count,
                                avg_ms = snapshot.avg_ms,
                                "keeper execution time snapshot received"
                            );
                        }
                        FrameAction::ContractError(kind) => {
                            source.set_contract_unavailable();
                            return Ok(ConnectionOutcome::ContractError(kind));
                        }
                        FrameAction::ReplyPong => {
                            send_with_timeout(
                                &mut socket,
                                Message::text(r#"{"type":"pong"}"#),
                                timeouts.write,
                            )
                            .await?;
                        }
                        FrameAction::Complete => return Ok(ConnectionOutcome::Ended),
                        FrameAction::Ignore => {}
                    },
                    Message::Ping(payload) => {
                        send_with_timeout(&mut socket, Message::Pong(payload), timeouts.write)
                            .await?;
                    }
                    Message::Pong(_) => {}
                    Message::Close(_) => return Ok(ConnectionOutcome::Ended),
                    Message::Binary(_) => {
                        return Err(eyre!("unsupported binary GraphQL WebSocket frame"));
                    }
                    Message::Frame(_) => {
                        return Err(eyre!("unsupported raw GraphQL WebSocket frame"));
                    }
                }
            }
        }
    }
}

fn sanitized_error(error: &eyre::Report, resolved: &ResolvedKeeperExecutionTimeEndpoint) -> String {
    error
        .to_string()
        .replace(resolved.url.as_str(), &resolved.log_target)
}

async fn run_source_subscription_loop_with<F, Fut>(
    source: KeeperExecutionTimeSourceHandle,
    resolved: ResolvedKeeperExecutionTimeEndpoint,
    reconnect_delay: Duration,
    mut subscribe: F,
) where
    F: FnMut(KeeperExecutionTimeSourceHandle, url::Url) -> Fut,
    Fut: Future<Output = eyre::Result<ConnectionOutcome>>,
{
    loop {
        match subscribe(source.clone(), resolved.url.clone()).await {
            Ok(ConnectionOutcome::ContractError(kind)) => {
                tracing::warn!(
                    source_index = resolved.source_index,
                    endpoint_source = resolved.source.as_str(),
                    endpoint = %resolved.log_target,
                    contract_error = kind.as_str(),
                    "keeper execution time contract incompatible; reconnecting"
                );
            }
            Ok(ConnectionOutcome::Ended) => {
                source.note_transport_failure();
                tracing::warn!(
                    source_index = resolved.source_index,
                    endpoint_source = resolved.source.as_str(),
                    endpoint = %resolved.log_target,
                    "keeper execution time subscription ended; reconnecting"
                );
            }
            Err(error) => {
                source.note_transport_failure();
                let error = sanitized_error(&error, &resolved);
                tracing::warn!(
                    source_index = resolved.source_index,
                    endpoint_source = resolved.source.as_str(),
                    endpoint = %resolved.log_target,
                    error,
                    "keeper execution time subscription disconnected; reconnecting"
                );
            }
        }
        tokio::time::sleep(reconnect_delay).await;
    }
}

async fn run_source_subscription_loop(
    source: KeeperExecutionTimeSourceHandle,
    resolved: ResolvedKeeperExecutionTimeEndpoint,
) {
    run_source_subscription_loop_with(
        source,
        resolved,
        RECONNECT_DELAY,
        |source, endpoint| async move { subscribe_once(&source, &endpoint).await },
    )
    .await;
}

#[cfg(test)]
async fn run_source_subscription_loop_with_timeouts(
    source: KeeperExecutionTimeSourceHandle,
    resolved: ResolvedKeeperExecutionTimeEndpoint,
    reconnect_delay: Duration,
    timeouts: ConnectionTimeouts,
) {
    run_source_subscription_loop_with(
        source,
        resolved,
        reconnect_delay,
        move |source, endpoint| async move {
            subscribe_once_with_timeouts(&source, &endpoint, timeouts).await
        },
    )
    .await;
}

/// Run one independent subscription worker for every resolved Keeper source.
pub async fn run_keeper_execution_time_subscriptions(handle: KeeperExecutionTimeHandle) {
    let Some(resolved_sources) = handle.resolved_sources() else {
        return;
    };
    tracing::info!(
        source_count = resolved_sources.len(),
        "keeper execution time subscriptions starting"
    );

    let mut workers = tokio::task::JoinSet::new();
    for resolved in resolved_sources.iter().cloned() {
        let Some(source) = handle.source_handle(resolved.source_index) else {
            tracing::error!(
                source_index = resolved.source_index,
                "keeper execution time source handle missing"
            );
            continue;
        };
        tracing::info!(
            source_index = resolved.source_index,
            endpoint_source = resolved.source.as_str(),
            endpoint = %resolved.log_target,
            "keeper execution time source starting"
        );
        workers.spawn(run_source_subscription_loop(source, resolved));
    }

    while let Some(result) = workers.join_next().await {
        if let Err(error) = result {
            tracing::error!(error = %error, "keeper execution time source worker failed");
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::pending,
        pin::Pin,
        sync::{
            atomic::{AtomicUsize, Ordering},
            Arc, Mutex,
        },
        task::{Context, Poll},
    };

    use futures_util::{Sink, SinkExt, StreamExt};
    use tokio::net::{TcpListener, TcpStream};
    use tokio::sync::{Barrier, Notify};
    use tokio_tungstenite::{
        accept_hdr_async,
        tungstenite::{
            handshake::server::{Request, Response},
            http::header::SEC_WEBSOCKET_PROTOCOL,
            Message,
        },
        WebSocketStream,
    };

    use crate::config::KeeperExecutionTimeEndpointSource;

    use super::*;

    fn enabled_config(endpoints: &[&str]) -> KeeperExecutionTimeConfig {
        KeeperExecutionTimeConfig {
            enabled: true,
            graphql_ws_endpoints: endpoints
                .iter()
                .map(|endpoint| (*endpoint).into())
                .collect(),
            stale_secs: 30,
        }
    }

    fn source(
        handle: &KeeperExecutionTimeHandle,
        source_index: usize,
    ) -> KeeperExecutionTimeSourceHandle {
        handle.source_handle(source_index).unwrap()
    }

    fn parse_ticks_frame(ticks: serde_json::Value) -> FrameAction {
        parse_text_frame(
            &serde_json::json!({
                "type": "next",
                "payload": { "data": { "ticks": ticks } },
            })
            .to_string(),
        )
        .unwrap()
    }

    #[test]
    fn weighted_average_uses_observation_counts() {
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 8_000, now);
        handle.update_snapshot(1, 10, 3, 9_500, now);
        assert_eq!(
            handle.read_at(now, Duration::from_secs(30)).unwrap(),
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 9.125,
            }
        );
    }

    #[test]
    fn zero_sample_source_has_zero_weight_and_all_zero_is_unavailable() {
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 0, 0, now);
        handle.update_snapshot(1, 10, 2, 1_250, now);
        assert_eq!(
            handle.read_at(now, Duration::from_secs(30)).unwrap(),
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 1.25,
            }
        );
        handle.update_snapshot(1, 10, 0, 0, now);
        assert_eq!(
            handle.read_at(now, Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::EmptySnapshot)
        );
    }

    #[test]
    fn zero_avg_ms_is_valid_when_sample_count_is_positive() {
        let handle = KeeperExecutionTimeHandle::for_source_count(1);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 0, now);
        assert_eq!(
            handle.read_at(now, Duration::from_secs(30)).unwrap(),
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 0.0,
            }
        );
    }

    #[test]
    fn aggregate_waits_for_every_source_and_applies_reason_precedence() {
        let handle = KeeperExecutionTimeHandle::for_source_count(3);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 1_000, now);
        handle.note_transport_failure(1);
        assert_eq!(
            handle.read_at(now, Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::WaitingForFirstSnapshot)
        );
        handle.set_contract_unavailable(2);
        assert_eq!(
            handle.read_at(now, Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::ContractIncompatible)
        );
    }

    #[test]
    fn unavailable_reason_precedence_is_deterministic() {
        let now = Instant::now();

        let waiting_over_stale = KeeperExecutionTimeHandle::for_source_count(2);
        waiting_over_stale.update_snapshot(0, 10, 1, 1_000, now);
        assert_eq!(
            waiting_over_stale.read_at(now + Duration::from_secs(31), Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::WaitingForFirstSnapshot)
        );

        let stale_over_transport = KeeperExecutionTimeHandle::for_source_count(2);
        stale_over_transport.update_snapshot(0, 10, 1, 1_000, now);
        stale_over_transport.note_transport_failure(1);
        assert_eq!(
            stale_over_transport.read_at(now + Duration::from_secs(31), Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::SnapshotStale)
        );

        let transport_over_misaligned = KeeperExecutionTimeHandle::for_source_count(3);
        transport_over_misaligned.update_snapshot(0, 10, 1, 1_000, now);
        transport_over_misaligned.update_snapshot(1, 10, 1, 2_000, now + Duration::from_secs(10));
        transport_over_misaligned.note_transport_failure(2);
        assert_eq!(
            transport_over_misaligned
                .read_at(now + Duration::from_secs(10), Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::TransportUnavailable)
        );

        let misaligned_over_empty = KeeperExecutionTimeHandle::for_source_count(2);
        misaligned_over_empty.update_snapshot(0, 10, 0, 0, now);
        misaligned_over_empty.update_snapshot(1, 10, 0, 0, now + Duration::from_secs(10));
        assert_eq!(
            misaligned_over_empty.read_at(now + Duration::from_secs(10), Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::SnapshotMisaligned)
        );
    }

    #[test]
    fn stale_transport_and_contract_state_follow_all_sources_policy() {
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 1_000, now);
        handle.update_snapshot(1, 10, 1, 2_000, now);
        handle.note_transport_failure(0);
        assert!(handle.read_at(now, Duration::from_secs(30)).is_ok());
        assert_eq!(
            handle.read_at(now + Duration::from_secs(31), Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::SnapshotStale)
        );
        handle.set_contract_unavailable(1);
        assert_eq!(
            handle.read_at(now, Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::ContractIncompatible)
        );
    }

    #[test]
    fn short_http_ttl_does_not_change_subscription_state_or_watchdog() {
        let handle = KeeperExecutionTimeHandle::for_source_count(1);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 1_000, now);

        assert_eq!(
            handle.read_at(now + Duration::from_secs(2), Duration::from_secs(1)),
            Err(KeeperExecutionTimeUnavailableReason::SnapshotStale)
        );
        assert!(matches!(
            &*handle.source_handle(0).unwrap().state(),
            KeeperExecutionTimeSourceState::Snapshot { .. }
        ));
        assert_eq!(
            ConnectionTimeouts::default().snapshot_watchdog,
            SNAPSHOT_WATCHDOG_TIMEOUT
        );

        handle.update_snapshot(0, 10, 1, 2_000, now + Duration::from_secs(2));
        assert_eq!(
            handle
                .read_at(now + Duration::from_secs(2), Duration::from_secs(1))
                .unwrap(),
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 2.0,
            }
        );
    }

    #[test]
    fn window_seconds_and_received_at_must_align() {
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 1_000, now);
        handle.update_snapshot(1, 11, 1, 2_000, now);
        assert_eq!(
            handle.read_at(now, Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::ContractIncompatible)
        );

        handle.update_snapshot(1, 10, 1, 2_000, now + Duration::from_secs(10));
        assert_eq!(
            handle.read_at(now + Duration::from_secs(10), Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::SnapshotMisaligned)
        );
        handle.update_snapshot(0, 10, 1, 1_000, now + Duration::from_secs(2));
        assert!(handle
            .read_at(now + Duration::from_secs(10), Duration::from_secs(30))
            .is_ok());
    }

    #[test]
    fn old_last_good_is_rejected_after_other_source_advances() {
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 1_000, now);
        handle.update_snapshot(1, 10, 1, 2_000, now);
        handle.note_transport_failure(0);
        handle.update_snapshot(1, 10, 1, 2_000, now + Duration::from_secs(10));
        assert_eq!(
            handle.read_at(now + Duration::from_secs(10), Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::SnapshotMisaligned)
        );
    }

    #[test]
    fn overflow_is_rejected_as_contract_incompatible() {
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(0, 10, u64::MAX, u64::MAX, now);
        handle.update_snapshot(1, 10, u64::MAX, u64::MAX, now);
        assert_eq!(
            handle.read_at(now, Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::ContractIncompatible)
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn concurrent_source_updates_do_not_overwrite_each_other() {
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        let barrier = Arc::new(Barrier::new(3));
        let update_a = tokio::spawn({
            let handle = handle.clone();
            let barrier = barrier.clone();
            async move {
                barrier.wait().await;
                handle.update_snapshot(0, 10, 2, 2_000, now);
            }
        });
        let update_b = tokio::spawn({
            let handle = handle.clone();
            let barrier = barrier.clone();
            async move {
                barrier.wait().await;
                handle.update_snapshot(1, 10, 3, 3_000, now);
            }
        });
        barrier.wait().await;
        update_a.await.unwrap();
        update_b.await.unwrap();
        assert_eq!(
            handle.read_at(now, Duration::from_secs(30)).unwrap(),
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 2.6,
            }
        );
    }

    #[test]
    fn parser_accepts_snapshot_and_rejects_incompatible_shapes() {
        assert_eq!(
            parse_text_frame(
                r#"{"type":"next","payload":{"data":{"ticks":{"windowSeconds":10,"sampleCount":1,"avgMs":500,"maxMs":750}}}}"#
            )
            .unwrap(),
            FrameAction::Snapshot(ValidatedSnapshot {
                window_seconds: 10,
                sample_count: 1,
                avg_ms: 500,
            })
        );
        for (frame, kind) in [
            (
                r#"{"type":"error","payload":[{"message":"old schema"}]}"#,
                ContractErrorKind::GraphqlErrorFrame,
            ),
            (
                r#"{"type":"next","payload":{"errors":[{"message":"resolver failed"}]}}"#,
                ContractErrorKind::GraphqlPayloadErrors,
            ),
            (
                r#"{"type":"next","payload":{"data":{}}}"#,
                ContractErrorKind::TicksMissing,
            ),
            (
                r#"{"type":"next","payload":{"data":{"ticks":1}}}"#,
                ContractErrorKind::TicksInvalid,
            ),
            (
                r#"{"type":"next","payload":{"data":{"ticks":{"sampleCount":1,"avgMs":500,"maxMs":750}}}}"#,
                ContractErrorKind::TicksInvalid,
            ),
            (
                r#"{"type":"next","payload":{"data":{"ticks":{"windowSeconds":10,"sampleCount":1,"avgMs":500}}}}"#,
                ContractErrorKind::TicksInvalid,
            ),
            (
                r#"{"type":"next","payload":{"data":{"ticks":{"windowSeconds":0,"sampleCount":1,"avgMs":500,"maxMs":750}}}}"#,
                ContractErrorKind::TicksInvalid,
            ),
            (
                r#"{"type":"next","payload":{"data":{"ticks":{"windowSeconds":10,"sampleCount":-1,"avgMs":500,"maxMs":750}}}}"#,
                ContractErrorKind::TicksInvalid,
            ),
        ] {
            assert_eq!(
                parse_text_frame(frame).unwrap(),
                FrameAction::ContractError(kind)
            );
        }
    }

    #[test]
    fn ticks_fields_must_fit_graphql_int() {
        let valid_ticks = serde_json::json!({
            "windowSeconds": GRAPHQL_INT_MAX,
            "sampleCount": GRAPHQL_INT_MAX,
            "avgMs": GRAPHQL_INT_MAX - 1,
            "maxMs": GRAPHQL_INT_MAX,
        });
        assert_eq!(
            parse_ticks_frame(valid_ticks.clone()),
            FrameAction::Snapshot(ValidatedSnapshot {
                window_seconds: GRAPHQL_INT_MAX,
                sample_count: GRAPHQL_INT_MAX,
                avg_ms: GRAPHQL_INT_MAX - 1,
            })
        );

        for field in ["windowSeconds", "sampleCount", "avgMs", "maxMs"] {
            let mut ticks = valid_ticks.clone();
            ticks[field] = serde_json::json!(GRAPHQL_INT_MAX + 1);
            assert_eq!(
                parse_ticks_frame(ticks),
                FrameAction::ContractError(ContractErrorKind::TicksInvalid),
                "{field} must fit GraphQL Int"
            );
        }
    }

    #[test]
    fn ticks_fields_must_be_nonnegative_json_integers() {
        let valid_ticks = serde_json::json!({
            "windowSeconds": 10,
            "sampleCount": 1,
            "avgMs": 500,
            "maxMs": 750,
        });

        for field in ["windowSeconds", "sampleCount", "avgMs", "maxMs"] {
            let mut missing = valid_ticks.clone();
            missing.as_object_mut().unwrap().remove(field);
            assert_eq!(
                parse_ticks_frame(missing),
                FrameAction::ContractError(ContractErrorKind::TicksInvalid),
                "{field} must be present"
            );

            for invalid_value in [
                serde_json::json!(-1),
                serde_json::json!(1.5),
                serde_json::json!("1"),
                serde_json::json!(true),
                serde_json::Value::Null,
            ] {
                let mut ticks = valid_ticks.clone();
                ticks[field] = invalid_value;
                assert_eq!(
                    parse_ticks_frame(ticks),
                    FrameAction::ContractError(ContractErrorKind::TicksInvalid),
                    "{field} must be a nonnegative JSON integer"
                );
            }
        }
    }

    #[test]
    fn empty_snapshot_tuple_must_be_consistent() {
        assert_eq!(
            parse_ticks_frame(serde_json::json!({
                "windowSeconds": 10,
                "sampleCount": 0,
                "avgMs": 0,
                "maxMs": 0,
            })),
            FrameAction::Snapshot(ValidatedSnapshot {
                window_seconds: 10,
                sample_count: 0,
                avg_ms: 0,
            })
        );

        for ticks in [
            serde_json::json!({
                "windowSeconds": 10,
                "sampleCount": 0,
                "avgMs": 1,
                "maxMs": 1,
            }),
            serde_json::json!({
                "windowSeconds": 10,
                "sampleCount": 0,
                "avgMs": 0,
                "maxMs": 1,
            }),
            serde_json::json!({
                "windowSeconds": 10,
                "sampleCount": 0,
                "avgMs": 1,
                "maxMs": 0,
            }),
        ] {
            assert_eq!(
                parse_ticks_frame(ticks),
                FrameAction::ContractError(ContractErrorKind::TicksInvalid)
            );
        }
    }

    #[test]
    fn average_must_not_exceed_maximum() {
        assert_eq!(
            parse_ticks_frame(serde_json::json!({
                "windowSeconds": 10,
                "sampleCount": 1,
                "avgMs": 501,
                "maxMs": 500,
            })),
            FrameAction::ContractError(ContractErrorKind::TicksInvalid)
        );
        assert_eq!(
            parse_ticks_frame(serde_json::json!({
                "windowSeconds": 10,
                "sampleCount": 1,
                "avgMs": 0,
                "maxMs": 0,
            })),
            FrameAction::Snapshot(ValidatedSnapshot {
                window_seconds: 10,
                sample_count: 1,
                avg_ms: 0,
            })
        );
    }

    #[test]
    fn saturated_average_is_rejected_without_rejecting_saturated_maximum() {
        assert_eq!(
            parse_ticks_frame(serde_json::json!({
                "windowSeconds": 10,
                "sampleCount": 1,
                "avgMs": GRAPHQL_INT_MAX,
                "maxMs": GRAPHQL_INT_MAX,
            })),
            FrameAction::ContractError(ContractErrorKind::TicksInvalid)
        );
        assert_eq!(
            parse_ticks_frame(serde_json::json!({
                "windowSeconds": 10,
                "sampleCount": 1,
                "avgMs": GRAPHQL_INT_MAX - 1,
                "maxMs": GRAPHQL_INT_MAX,
            })),
            FrameAction::Snapshot(ValidatedSnapshot {
                window_seconds: 10,
                sample_count: 1,
                avg_ms: GRAPHQL_INT_MAX - 1,
            })
        );
    }

    #[test]
    fn observation_latency_is_not_bounded_by_window() {
        assert_eq!(
            parse_ticks_frame(serde_json::json!({
                "windowSeconds": 10,
                "sampleCount": 1,
                "avgMs": 12_000,
                "maxMs": 78_000,
            })),
            FrameAction::Snapshot(ValidatedSnapshot {
                window_seconds: 10,
                sample_count: 1,
                avg_ms: 12_000,
            })
        );
    }

    #[test]
    fn text_ping_returns_graphql_pong_and_ack_is_ignored() {
        assert_eq!(
            parse_text_frame(r#"{"type":"ping"}"#).unwrap(),
            FrameAction::ReplyPong
        );
        assert_eq!(
            parse_text_frame(r#"{"type":"connection_ack"}"#).unwrap(),
            FrameAction::Ignore
        );
    }

    #[test]
    fn contract_error_categories_are_fixed_and_safe_for_logs() {
        assert_eq!(
            [
                ContractErrorKind::GraphqlErrorFrame,
                ContractErrorKind::GraphqlPayloadErrors,
                ContractErrorKind::TicksMissing,
                ContractErrorKind::TicksInvalid,
            ]
            .map(ContractErrorKind::as_str),
            [
                "graphql_error_frame",
                "graphql_payload_errors",
                "ticks_missing",
                "ticks_invalid",
            ]
        );
    }

    #[test]
    fn unavailable_reason_is_from_fixed_contract() {
        let reasons = [
            KeeperExecutionTimeUnavailableReason::RuntimeDisabled,
            KeeperExecutionTimeUnavailableReason::EndpointMissing,
            KeeperExecutionTimeUnavailableReason::EndpointInvalid,
            KeeperExecutionTimeUnavailableReason::WaitingForFirstSnapshot,
            KeeperExecutionTimeUnavailableReason::EmptySnapshot,
            KeeperExecutionTimeUnavailableReason::ContractIncompatible,
            KeeperExecutionTimeUnavailableReason::TransportUnavailable,
            KeeperExecutionTimeUnavailableReason::SnapshotStale,
            KeeperExecutionTimeUnavailableReason::SnapshotMisaligned,
        ];
        assert_eq!(
            reasons.map(KeeperExecutionTimeUnavailableReason::as_str),
            [
                "runtime disabled",
                "endpoint missing",
                "endpoint invalid",
                "waiting for first snapshot",
                "empty snapshot",
                "contract incompatible",
                "transport unavailable",
                "snapshot stale",
                "snapshot misaligned",
            ]
        );
    }

    struct PendingSink;

    impl Sink<Message> for PendingSink {
        type Error = std::io::Error;

        fn poll_ready(
            self: Pin<&mut Self>,
            _cx: &mut Context<'_>,
        ) -> Poll<Result<(), Self::Error>> {
            Poll::Pending
        }

        fn start_send(self: Pin<&mut Self>, _item: Message) -> Result<(), Self::Error> {
            Ok(())
        }

        fn poll_flush(
            self: Pin<&mut Self>,
            _cx: &mut Context<'_>,
        ) -> Poll<Result<(), Self::Error>> {
            Poll::Pending
        }

        fn poll_close(
            self: Pin<&mut Self>,
            _cx: &mut Context<'_>,
        ) -> Poll<Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }
    }

    #[tokio::test(start_paused = true)]
    async fn outbound_write_times_out_with_pending_sink() {
        let error = send_with_timeout(
            &mut PendingSink,
            Message::text("test"),
            Duration::from_secs(10),
        )
        .await
        .unwrap_err();
        assert_eq!(error.to_string(), "outbound write timeout");
    }

    async fn accept_graphql_socket(stream: TcpStream) -> WebSocketStream<TcpStream> {
        accept_hdr_async(stream, |request: &Request, mut response: Response| {
            assert_eq!(
                request.headers().get(SEC_WEBSOCKET_PROTOCOL).unwrap(),
                "graphql-transport-ws"
            );
            response.headers_mut().insert(
                SEC_WEBSOCKET_PROTOCOL,
                HeaderValue::from_static("graphql-transport-ws"),
            );
            Ok(response)
        })
        .await
        .unwrap()
    }

    async fn read_init_and_subscribe(socket: &mut WebSocketStream<TcpStream>) {
        let init = socket.next().await.unwrap().unwrap();
        assert_eq!(init.into_text().unwrap(), r#"{"type":"connection_init"}"#);

        let subscribe = socket.next().await.unwrap().unwrap();
        let subscribe: serde_json::Value =
            serde_json::from_str(subscribe.to_text().unwrap()).unwrap();
        let query = subscribe["payload"]["query"].as_str().unwrap();
        assert!(query.contains("windowSeconds"));
        assert!(query.contains("sampleCount"));
        assert!(query.contains("avgMs"));
        assert!(query.contains("maxMs"));
    }

    async fn mock_server_with_frame(
        frame: serde_json::Value,
    ) -> (url::Url, tokio::task::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = accept_graphql_socket(stream).await;
            read_init_and_subscribe(&mut socket).await;
            socket.send(Message::text(frame.to_string())).await.unwrap();
            socket.close(None).await.unwrap();
        });
        (url::Url::parse(&format!("ws://{address}")).unwrap(), task)
    }

    #[tokio::test]
    async fn multiple_mock_websockets_produce_weighted_aggregate() {
        let (endpoint_a, server_a) = mock_server_with_frame(serde_json::json!({
            "type": "next",
            "payload": { "data": { "ticks": {
                "windowSeconds": 10,
                "sampleCount": 1,
                "avgMs": 8000,
                "maxMs": 8000
            }}}
        }))
        .await;
        let (endpoint_b, server_b) = mock_server_with_frame(serde_json::json!({
            "type": "next",
            "payload": { "data": { "ticks": {
                "windowSeconds": 10,
                "sampleCount": 3,
                "avgMs": 9500,
                "maxMs": 9500
            }}}
        }))
        .await;
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let source_a = source(&handle, 0);
        let source_b = source(&handle, 1);

        let (outcome_a, outcome_b) = tokio::join!(
            subscribe_once(&source_a, &endpoint_a),
            subscribe_once(&source_b, &endpoint_b),
        );
        assert_eq!(outcome_a.unwrap(), ConnectionOutcome::Ended);
        assert_eq!(outcome_b.unwrap(), ConnectionOutcome::Ended);
        assert_eq!(
            handle
                .read_at(Instant::now(), Duration::from_secs(30))
                .unwrap(),
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 9.125,
            }
        );
        server_a.await.unwrap();
        server_b.await.unwrap();
    }

    #[tokio::test]
    async fn supervisor_recovers_one_source_without_restarting_other_workers() {
        let listener_a = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint_a = format!("ws://{}", listener_a.local_addr().unwrap());
        let listener_b = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint_b = format!("ws://{}", listener_b.local_addr().unwrap());
        let connections_a = Arc::new(AtomicUsize::new(0));
        let connections_b = Arc::new(AtomicUsize::new(0));
        let recovered = Arc::new(Notify::new());

        let server_a = tokio::spawn({
            let connections_a = connections_a.clone();
            async move {
                let (stream, _) = listener_a.accept().await.unwrap();
                connections_a.fetch_add(1, Ordering::SeqCst);
                let mut socket = accept_graphql_socket(stream).await;
                read_init_and_subscribe(&mut socket).await;
                socket
                    .send(Message::text(
                        serde_json::json!({
                            "type": "next",
                            "payload": { "data": { "ticks": {
                                "windowSeconds": 10,
                                "sampleCount": 1,
                                "avgMs": 8000,
                                "maxMs": 8000
                            }}}
                        })
                        .to_string(),
                    ))
                    .await
                    .unwrap();
                pending::<()>().await;
            }
        });
        let server_b = tokio::spawn({
            let connections_b = connections_b.clone();
            let recovered = recovered.clone();
            async move {
                let (stream, _) = listener_b.accept().await.unwrap();
                connections_b.fetch_add(1, Ordering::SeqCst);
                let mut socket = accept_graphql_socket(stream).await;
                read_init_and_subscribe(&mut socket).await;
                socket
                    .send(Message::text(
                        r#"{"type":"error","payload":[{"message":"old schema"}]}"#,
                    ))
                    .await
                    .unwrap();
                drop(socket);

                let (stream, _) = listener_b.accept().await.unwrap();
                connections_b.fetch_add(1, Ordering::SeqCst);
                let mut socket = accept_graphql_socket(stream).await;
                read_init_and_subscribe(&mut socket).await;
                socket
                    .send(Message::text(
                        serde_json::json!({
                            "type": "next",
                            "payload": { "data": { "ticks": {
                                "windowSeconds": 10,
                                "sampleCount": 3,
                                "avgMs": 9500,
                                "maxMs": 9500
                            }}}
                        })
                        .to_string(),
                    ))
                    .await
                    .unwrap();
                recovered.notify_one();
                pending::<()>().await;
            }
        });

        let config = enabled_config(&[&endpoint_a, &endpoint_b]);
        let handle = KeeperExecutionTimeHandle::from_config(&config, "");
        let supervisor = tokio::spawn(run_keeper_execution_time_subscriptions(handle.clone()));

        tokio::time::timeout(Duration::from_secs(1), async {
            loop {
                if handle.read_at(Instant::now(), Duration::from_secs(30))
                    == Err(KeeperExecutionTimeUnavailableReason::ContractIncompatible)
                {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        tokio::time::timeout(Duration::from_secs(4), recovered.notified())
            .await
            .unwrap();
        let aggregate = tokio::time::timeout(Duration::from_secs(1), async {
            loop {
                if let Ok(aggregate) = handle.read_at(Instant::now(), Duration::from_secs(30)) {
                    break aggregate;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        assert_eq!(
            aggregate,
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 9.125,
            }
        );
        assert_eq!(connections_a.load(Ordering::SeqCst), 1);
        assert_eq!(connections_b.load(Ordering::SeqCst), 2);

        supervisor.abort();
        server_a.abort();
        server_b.abort();
    }

    #[tokio::test]
    async fn subscribe_once_invalidates_only_target_source_on_graphql_error() {
        let (endpoint, server) = mock_server_with_frame(serde_json::json!({
            "type": "error",
            "payload": [{ "message": "incompatible schema" }]
        }))
        .await;
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 1_000, now);
        handle.update_snapshot(1, 10, 1, 2_000, now);

        let outcome = subscribe_once(&source(&handle, 0), &endpoint)
            .await
            .unwrap();
        assert_eq!(
            outcome,
            ConnectionOutcome::ContractError(ContractErrorKind::GraphqlErrorFrame)
        );
        assert_eq!(
            handle.read_at(Instant::now(), Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::ContractIncompatible)
        );
        assert!(matches!(
            &*source(&handle, 1).state(),
            KeeperExecutionTimeSourceState::Snapshot { avg_ms: 2_000, .. }
        ));
        server.await.unwrap();
    }

    #[tokio::test]
    async fn subscribe_once_rejects_contract_invalid_snapshot_without_last_good() {
        let (endpoint, server) = mock_server_with_frame(serde_json::json!({
            "type": "next",
            "payload": { "data": { "ticks": {
                "windowSeconds": 10,
                "sampleCount": 1,
                "avgMs": 2_000,
                "maxMs": 1_000
            }}}
        }))
        .await;
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 1_000, now);
        handle.update_snapshot(1, 10, 1, 2_000, now);

        let outcome = subscribe_once(&source(&handle, 0), &endpoint)
            .await
            .unwrap();
        assert_eq!(
            outcome,
            ConnectionOutcome::ContractError(ContractErrorKind::TicksInvalid)
        );
        assert!(matches!(
            &*source(&handle, 0).state(),
            KeeperExecutionTimeSourceState::Unavailable {
                reason: KeeperExecutionTimeUnavailableReason::ContractIncompatible
            }
        ));
        assert!(matches!(
            &*source(&handle, 1).state(),
            KeeperExecutionTimeSourceState::Snapshot { avg_ms: 2_000, .. }
        ));
        assert_eq!(
            handle.read_at(Instant::now(), Duration::from_secs(30)),
            Err(KeeperExecutionTimeUnavailableReason::ContractIncompatible)
        );
        server.await.unwrap();
    }

    #[tokio::test]
    async fn subscribe_once_rejects_binary_graphql_transport_frame() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint =
            url::Url::parse(&format!("ws://{}", listener.local_addr().unwrap())).unwrap();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = accept_graphql_socket(stream).await;
            read_init_and_subscribe(&mut socket).await;
            socket
                .send(Message::Binary(vec![0x01, 0x02]))
                .await
                .unwrap();
        });
        let handle = KeeperExecutionTimeHandle::for_source_count(1);

        let error = subscribe_once(&source(&handle, 0), &endpoint)
            .await
            .unwrap_err();
        assert_eq!(
            error.to_string(),
            "unsupported binary GraphQL WebSocket frame"
        );
        server.await.unwrap();
    }

    #[tokio::test]
    async fn subscribe_once_times_out_during_handshake() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint =
            url::Url::parse(&format!("ws://{}", listener.local_addr().unwrap())).unwrap();
        let server = tokio::spawn(async move {
            let (_stream, _) = listener.accept().await.unwrap();
            pending::<()>().await;
        });
        let handle = KeeperExecutionTimeHandle::for_source_count(1);

        let error = subscribe_once_with_timeouts(
            &source(&handle, 0),
            &endpoint,
            ConnectionTimeouts {
                connect: Duration::from_millis(100),
                ..ConnectionTimeouts::default()
            },
        )
        .await
        .unwrap_err();
        assert_eq!(error.to_string(), "connection timeout");
        server.abort();
    }

    #[tokio::test]
    async fn ping_only_connection_hits_snapshot_watchdog() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint =
            url::Url::parse(&format!("ws://{}", listener.local_addr().unwrap())).unwrap();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = accept_graphql_socket(stream).await;
            read_init_and_subscribe(&mut socket).await;
            socket
                .send(Message::text(r#"{"type":"ping"}"#))
                .await
                .unwrap();
            let pong = socket.next().await.unwrap().unwrap();
            assert_eq!(pong.into_text().unwrap(), r#"{"type":"pong"}"#);
            pending::<()>().await;
        });
        let handle = KeeperExecutionTimeHandle::for_source_count(1);

        let error = subscribe_once_with_timeouts(
            &source(&handle, 0),
            &endpoint,
            ConnectionTimeouts {
                frame_idle: Duration::from_secs(1),
                snapshot_watchdog: Duration::from_millis(100),
                ..ConnectionTimeouts::default()
            },
        )
        .await
        .unwrap_err();
        assert_eq!(error.to_string(), "snapshot watchdog timeout");
        server.abort();
    }

    #[tokio::test]
    async fn silent_connection_hits_frame_idle_timeout() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint =
            url::Url::parse(&format!("ws://{}", listener.local_addr().unwrap())).unwrap();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = accept_graphql_socket(stream).await;
            read_init_and_subscribe(&mut socket).await;
            pending::<()>().await;
        });
        let handle = KeeperExecutionTimeHandle::for_source_count(1);

        let error = subscribe_once_with_timeouts(
            &source(&handle, 0),
            &endpoint,
            ConnectionTimeouts {
                frame_idle: Duration::from_millis(100),
                snapshot_watchdog: Duration::from_secs(1),
                ..ConnectionTimeouts::default()
            },
        )
        .await
        .unwrap_err();
        assert_eq!(error.to_string(), "frame idle timeout");
        server.abort();
    }

    #[tokio::test]
    async fn empty_snapshot_refreshes_watchdog_and_has_zero_weight() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint =
            url::Url::parse(&format!("ws://{}", listener.local_addr().unwrap())).unwrap();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = accept_graphql_socket(stream).await;
            read_init_and_subscribe(&mut socket).await;
            tokio::time::sleep(Duration::from_millis(200)).await;
            socket
                .send(Message::text(
                    serde_json::json!({
                        "type": "next",
                        "payload": { "data": { "ticks": {
                            "windowSeconds": 10,
                            "sampleCount": 0,
                            "avgMs": 0,
                            "maxMs": 0
                        }}}
                    })
                    .to_string(),
                ))
                .await
                .unwrap();
            tokio::time::sleep(Duration::from_millis(200)).await;
            socket
                .send(Message::text(r#"{"type":"complete"}"#))
                .await
                .unwrap();
        });
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(1, 10, 1, 500, now);

        let outcome = subscribe_once_with_timeouts(
            &source(&handle, 0),
            &endpoint,
            ConnectionTimeouts {
                frame_idle: Duration::from_secs(1),
                snapshot_watchdog: Duration::from_millis(300),
                ..ConnectionTimeouts::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(outcome, ConnectionOutcome::Ended);
        assert_eq!(
            handle
                .read_at(Instant::now(), Duration::from_secs(30))
                .unwrap(),
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 0.5,
            }
        );
        server.await.unwrap();
    }

    #[tokio::test]
    async fn short_http_ttl_does_not_restart_healthy_websocket() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint =
            url::Url::parse(&format!("ws://{}", listener.local_addr().unwrap())).unwrap();
        let connections = Arc::new(AtomicUsize::new(0));
        let second_sent = Arc::new(Notify::new());
        let server = tokio::spawn({
            let connections = connections.clone();
            let second_sent = second_sent.clone();
            async move {
                let (stream, _) = listener.accept().await.unwrap();
                connections.fetch_add(1, Ordering::SeqCst);
                let mut socket = accept_graphql_socket(stream).await;
                read_init_and_subscribe(&mut socket).await;
                for avg_ms in [1_000, 2_000] {
                    socket
                        .send(Message::text(
                            serde_json::json!({
                                "type": "next",
                                "payload": { "data": { "ticks": {
                                    "windowSeconds": 10,
                                    "sampleCount": 1,
                                    "avgMs": avg_ms,
                                    "maxMs": avg_ms
                                }}}
                            })
                            .to_string(),
                        ))
                        .await
                        .unwrap();
                    if avg_ms == 1_000 {
                        tokio::time::sleep(Duration::from_millis(250)).await;
                    }
                }
                second_sent.notify_one();
                socket
                    .send(Message::text(r#"{"type":"complete"}"#))
                    .await
                    .unwrap();
            }
        });
        let handle = KeeperExecutionTimeHandle::for_source_count(1);
        let source = source(&handle, 0);
        let subscription = tokio::spawn({
            let endpoint = endpoint.clone();
            async move {
                subscribe_once_with_timeouts(
                    &source,
                    &endpoint,
                    ConnectionTimeouts {
                        frame_idle: Duration::from_secs(1),
                        snapshot_watchdog: Duration::from_secs(1),
                        ..ConnectionTimeouts::default()
                    },
                )
                .await
            }
        });

        tokio::time::timeout(Duration::from_secs(1), async {
            loop {
                if handle
                    .read_at(Instant::now(), Duration::from_secs(30))
                    .is_ok()
                {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert_eq!(
            handle.read_at(Instant::now(), Duration::from_millis(50)),
            Err(KeeperExecutionTimeUnavailableReason::SnapshotStale)
        );

        tokio::time::timeout(Duration::from_secs(1), second_sent.notified())
            .await
            .unwrap();
        assert_eq!(
            subscription.await.unwrap().unwrap(),
            ConnectionOutcome::Ended
        );
        assert_eq!(
            handle
                .read_at(Instant::now(), Duration::from_millis(50))
                .unwrap(),
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 2.0,
            }
        );
        assert_eq!(connections.load(Ordering::SeqCst), 1);
        server.await.unwrap();
    }

    #[tokio::test]
    async fn real_subscription_loop_recovers_after_complete_close_idle_and_watchdog() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint =
            url::Url::parse(&format!("ws://{}", listener.local_addr().unwrap())).unwrap();
        let attempts = Arc::new(AtomicUsize::new(0));
        let recovered = Arc::new(Notify::new());
        let server = tokio::spawn({
            let attempts = attempts.clone();
            let recovered = recovered.clone();
            async move {
                for attempt in 0..5 {
                    let (stream, _) = listener.accept().await.unwrap();
                    attempts.fetch_add(1, Ordering::SeqCst);
                    let mut socket = accept_graphql_socket(stream).await;
                    read_init_and_subscribe(&mut socket).await;
                    match attempt {
                        0 => {
                            socket
                                .send(Message::text(r#"{"type":"complete"}"#))
                                .await
                                .unwrap();
                        }
                        1 => {
                            socket.close(None).await.unwrap();
                        }
                        2 => {
                            let _ = socket.next().await;
                        }
                        3 => {
                            for _ in 0..10 {
                                if socket
                                    .send(Message::text(r#"{"type":"ping"}"#))
                                    .await
                                    .is_err()
                                {
                                    break;
                                }
                                if tokio::time::timeout(Duration::from_millis(100), socket.next())
                                    .await
                                    .is_err()
                                {
                                    break;
                                }
                                tokio::time::sleep(Duration::from_millis(30)).await;
                            }
                        }
                        _ => {
                            socket
                                .send(Message::text(
                                    serde_json::json!({
                                        "type": "next",
                                        "payload": { "data": { "ticks": {
                                            "windowSeconds": 10,
                                            "sampleCount": 1,
                                            "avgMs": 3000,
                                            "maxMs": 3000
                                        }}}
                                    })
                                    .to_string(),
                                ))
                                .await
                                .unwrap();
                            recovered.notify_one();
                            pending::<()>().await;
                        }
                    }
                }
            }
        });
        let handle = KeeperExecutionTimeHandle::for_source_count(1);
        let resolved = ResolvedKeeperExecutionTimeEndpoint {
            source_index: 0,
            url: endpoint,
            source: KeeperExecutionTimeEndpointSource::OverrideList,
            log_target: "ws://127.0.0.1".into(),
        };
        let task = tokio::spawn(run_source_subscription_loop_with_timeouts(
            source(&handle, 0),
            resolved,
            Duration::from_millis(20),
            ConnectionTimeouts {
                frame_idle: Duration::from_millis(100),
                snapshot_watchdog: Duration::from_millis(200),
                ..ConnectionTimeouts::default()
            },
        ));

        tokio::time::timeout(Duration::from_secs(2), recovered.notified())
            .await
            .unwrap();
        let aggregate = tokio::time::timeout(Duration::from_secs(1), async {
            loop {
                if let Ok(aggregate) = handle.read_at(Instant::now(), Duration::from_secs(30)) {
                    break aggregate;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        assert_eq!(attempts.load(Ordering::SeqCst), 5);
        assert_eq!(
            aggregate,
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 3.0,
            }
        );

        task.abort();
        server.abort();
    }

    #[tokio::test(start_paused = true)]
    async fn subscription_loop_reconnects_with_independent_backoff() {
        let handle = KeeperExecutionTimeHandle::for_source_count(1);
        let resolved = ResolvedKeeperExecutionTimeEndpoint {
            source_index: 0,
            url: url::Url::parse("ws://127.0.0.1:1/graphql-ws").unwrap(),
            source: KeeperExecutionTimeEndpointSource::OverrideList,
            log_target: "ws://127.0.0.1:1".into(),
        };
        let attempts = Arc::new(AtomicUsize::new(0));
        let attempt_times = Arc::new(Mutex::new(Vec::new()));
        let third_attempt = Arc::new(Notify::new());

        let task = tokio::spawn(run_source_subscription_loop_with(
            source(&handle, 0),
            resolved,
            RECONNECT_DELAY,
            {
                let attempts = attempts.clone();
                let attempt_times = attempt_times.clone();
                let third_attempt = third_attempt.clone();
                move |source, _endpoint| {
                    let attempt = attempts.fetch_add(1, Ordering::SeqCst);
                    attempt_times.lock().unwrap().push(Instant::now());
                    let third_attempt = third_attempt.clone();
                    async move {
                        match attempt {
                            0 => Ok(ConnectionOutcome::Ended),
                            1 => {
                                source.set_contract_unavailable();
                                Ok(ConnectionOutcome::ContractError(
                                    ContractErrorKind::TicksInvalid,
                                ))
                            }
                            _ => {
                                source.update_snapshot(
                                    ValidatedSnapshot {
                                        window_seconds: 10,
                                        sample_count: 1,
                                        avg_ms: 3_000,
                                    },
                                    Instant::now(),
                                );
                                third_attempt.notify_one();
                                pending::<eyre::Result<ConnectionOutcome>>().await
                            }
                        }
                    }
                }
            },
        ));

        third_attempt.notified().await;
        assert_eq!(attempts.load(Ordering::SeqCst), 3);
        let attempt_times = attempt_times.lock().unwrap();
        assert_eq!(attempt_times[1] - attempt_times[0], RECONNECT_DELAY);
        assert_eq!(attempt_times[2] - attempt_times[1], RECONNECT_DELAY);
        assert_eq!(
            handle
                .read_at(Instant::now(), Duration::from_secs(30))
                .unwrap(),
            KeeperMetricsResponse {
                estimated_execution_time_seconds: 3.0,
            }
        );
        task.abort();
    }

    #[test]
    fn from_config_preserves_resolved_source_order() {
        let config = enabled_config(&[
            "wss://keeper-a.example/graphql-ws",
            "wss://keeper-b.example/graphql-ws",
        ]);
        let handle = KeeperExecutionTimeHandle::from_config(&config, "");
        let resolved = handle.resolved_sources().unwrap();
        assert_eq!(resolved.len(), 2);
        assert_eq!(resolved[0].source_index, 0);
        assert_eq!(resolved[1].source_index, 1);
    }
}
