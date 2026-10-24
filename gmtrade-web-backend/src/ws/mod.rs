//! WebSocket `/ws` push engine: a Rust port of Go's `StartPushEngine` with one pre-serialized broadcast per shared topic.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::Response;
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tokio::sync::broadcast;
use tokio::time::{interval, timeout, MissedTickBehavior};

use crate::ws_protocol::{parse_client_msg, ClientIntent, ClientMsg, Envelope, Heartbeat, Topic};

use crate::state::{AppState, Snapshot};

use crate::metrics;

/// Channel capacity for the shared-topic broadcasts; lagging clients skip stale frames.
const BROADCAST_CAPACITY: usize = 64;

/// Tunable connection limits for the `/ws` engine (defaults match the Go server).
#[derive(Debug, Clone, Copy)]
pub struct WsLimits {
    /// Max inbound frame size in bytes (read frame limit). Default 64KB.
    pub max_frame_bytes: usize,
    /// Max concurrent subscriptions per connection. Default 8.
    pub max_subscriptions: usize,
    /// Cumulative invalid-payload count we disconnect ABOVE (Go's `>`). Default 10.
    pub max_invalid_payloads: u32,
    /// Max inbound messages per second (per-second token bucket). Default 10.
    pub max_msgs_per_sec: u32,
    /// Per-message write timeout. Default 5s.
    pub write_timeout: Duration,
    /// Interval between server WS Pings. Default 25s.
    pub ping_interval: Duration,
    /// Read timeout (reset on any read/pong). Default 60s.
    pub read_timeout: Duration,
}

impl Default for WsLimits {
    fn default() -> Self {
        Self {
            max_frame_bytes: 64 * 1024,
            max_subscriptions: 8,
            max_invalid_payloads: 10,
            max_msgs_per_sec: 10,
            write_timeout: Duration::from_secs(5),
            ping_interval: Duration::from_secs(25),
            read_timeout: Duration::from_secs(60),
        }
    }
}

/// Shared-topic broadcast senders for the WS push engine, carrying pre-serialized envelope JSON.
#[derive(Clone)]
pub struct WsBroadcast {
    pub heartbeat: broadcast::Sender<Arc<str>>,
    pub index_tokens: broadcast::Sender<Arc<str>>,
    pub tickers: broadcast::Sender<Arc<str>>,
    pub swap_list: broadcast::Sender<Arc<str>>,
    pub store_balances: broadcast::Sender<Arc<str>>,
    pub glvs: broadcast::Sender<Arc<str>>,
    pub token_mints: broadcast::Sender<()>,
}

impl WsBroadcast {
    pub fn new() -> Self {
        Self {
            heartbeat: broadcast::channel(BROADCAST_CAPACITY).0,
            index_tokens: broadcast::channel(BROADCAST_CAPACITY).0,
            tickers: broadcast::channel(BROADCAST_CAPACITY).0,
            swap_list: broadcast::channel(BROADCAST_CAPACITY).0,
            store_balances: broadcast::channel(BROADCAST_CAPACITY).0,
            glvs: broadcast::channel(BROADCAST_CAPACITY).0,
            token_mints: broadcast::channel(BROADCAST_CAPACITY).0,
        }
    }

    pub fn notify_token_mints_changed(&self) {
        let _ = self.token_mints.send(());
    }
}

impl Default for WsBroadcast {
    fn default() -> Self {
        Self::new()
    }
}

/// Current unix time in seconds.
fn unix_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Serialize a payload into an envelope JSON, falling back to an empty-payload envelope on failure.
pub(crate) fn envelope_json<T: serde::Serialize>(topic_type: &str, payload: T) -> Arc<str> {
    match serde_json::to_string(&Envelope::new(topic_type, payload)) {
        Ok(s) => Arc::from(s.as_str()),
        Err(err) => {
            tracing::error!(error = %err, topic = topic_type, "ws: envelope serialize failed");
            Arc::from(format!("{{\"type\":\"{topic_type}\",\"payload\":null}}").as_str())
        }
    }
}

/// Base-tick loop that serializes the snapshot's topic payloads into envelopes and broadcasts them.
pub async fn run_push_engine(state: AppState) {
    let period = Duration::from_millis(state.config.ws_tick_ms.max(1));
    let mut ticker = interval(period);
    ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
    tracing::info!(
        ws_tick_ms = state.config.ws_tick_ms,
        "ws push engine started"
    );

    let mut tick_count: u64 = 0;
    loop {
        ticker.tick().await;
        let snap = state.snapshot();

        // Every tick: rebuild tickers from the live keeper price map so Chainlink prices stay sub-second fresh.
        let sol_tickers = crate::refresh::live_sol_tickers(&state);
        let sent = state
            .ws
            .tickers
            .send(envelope_json(Topic::Tickers.type_str(), &sol_tickers));
        metrics::record_ws_push_if(metrics::WsTopic::Tickers, || sent.is_ok());

        match tick_count % 5 {
            0 => {
                let sent = state.ws.heartbeat.send(envelope_json(
                    Topic::Heartbeat.type_str(),
                    Heartbeat {
                        timestamp: unix_now(),
                    },
                ));
                metrics::record_ws_push_if(metrics::WsTopic::Heartbeat, || sent.is_ok());
                let sent = state.ws.index_tokens.send(envelope_json(
                    Topic::IndexTokens.type_str(),
                    &snap.index_infos,
                ));
                metrics::record_ws_push_if(metrics::WsTopic::IndexTokens, || sent.is_ok());
            }
            1 => {
                let sent = state
                    .ws
                    .swap_list
                    .send(envelope_json(Topic::SwapList.type_str(), &snap.swap_list));
                metrics::record_ws_push_if(metrics::WsTopic::SwapList, || sent.is_ok());
            }
            _ => {}
        }

        tick_count = tick_count.wrapping_add(1);
    }
}

/// `GET /ws` — upgrade to a WebSocket. All origins allowed (matches Go).
pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    let limits = WsLimits::default();
    let ws = ws.max_message_size(limits.max_frame_bytes);
    ws.on_upgrade(move |socket| handle_socket(socket, state, limits))
}

/// A normalized key for the shared broadcast topics a connection can subscribe to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum TopicKey {
    IndexTokens,
    Tickers,
    SwapList,
    StoreBalances,
    Glvs,
}

#[derive(Debug, Clone)]
struct TokenMintsSubscription {
    filter: Option<crate::token_mints::TokenMintsFilter>,
    with_snapshot: bool,
    with_data: bool,
    last_view_fingerprint: Option<u64>,
}

/// Per-connection state for the handler loop.
struct ConnState {
    subs: HashSet<TopicKey>,
    candles_sub: Option<(String, String)>, // (token_symbol, period)
    token_mints_sub: Option<TokenMintsSubscription>,
    invalid_count: u32,
    // Per-second token bucket for inbound rate limiting.
    window_start: tokio::time::Instant,
    window_count: u32,
}

impl ConnState {
    fn new() -> Self {
        Self {
            subs: HashSet::new(),
            candles_sub: None,
            token_mints_sub: None,
            invalid_count: 0,
            window_start: tokio::time::Instant::now(),
            window_count: 0,
        }
    }

    /// Total subscription count (shared topics + candles) for the subscription limit.
    fn sub_count(&self) -> usize {
        self.subs.len()
            + usize::from(self.candles_sub.is_some())
            + usize::from(self.token_mints_sub.is_some())
    }
}

/// Drive one connection: forward subscribed broadcasts, handle subscribe/query, enforce limits, ping, and time out idle reads.
async fn handle_socket(socket: WebSocket, state: AppState, limits: WsLimits) {
    let (mut sink, mut stream) = socket.split();

    let mut rx_heartbeat = state.ws.heartbeat.subscribe();
    let mut rx_index = state.ws.index_tokens.subscribe();
    let mut rx_tickers = state.ws.tickers.subscribe();
    let mut rx_swap = state.ws.swap_list.subscribe();
    let mut rx_store_balances = state.ws.store_balances.subscribe();
    let mut rx_token_mints = state.ws.token_mints.subscribe();
    let mut rx_glvs = state.ws.glvs.subscribe();

    let mut conn = ConnState::new();

    let mut ping_ticker = interval(limits.ping_interval);
    ping_ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
    ping_ticker.tick().await; // consume the immediate first tick

    let candles_period = Duration::from_millis(state.config.ws_tick_ms.max(1));
    let mut candles_ticker = interval(candles_period);
    candles_ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
    candles_ticker.tick().await; // consume immediate first tick

    macro_rules! select_ws {
        ($($extra:tt)*) => {
            tokio::select! {
                // Heartbeat goes to ALL connected clients (no sub check).
                r = rx_heartbeat.recv() => {
                    match r {
                        Ok(frame) => {
                            if send_text(&mut sink, &frame, limits.write_timeout).await.is_err() {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(lost)) => {
                            metrics::record_ws_lag(metrics::WsTopic::Heartbeat, lost);
                        }
                        Err(broadcast::error::RecvError::Closed) => break,
                    }
                }
                r = rx_index.recv() => {
                    if !forward_if_subscribed(&mut sink, &conn, TopicKey::IndexTokens, r, limits.write_timeout).await {
                        break;
                    }
                }
                r = rx_tickers.recv() => {
                    if !forward_if_subscribed(&mut sink, &conn, TopicKey::Tickers, r, limits.write_timeout).await {
                        break;
                    }
                }
                r = rx_swap.recv() => {
                    if !forward_if_subscribed(&mut sink, &conn, TopicKey::SwapList, r, limits.write_timeout).await {
                        break;
                    }
                }
                $($extra)*

                // Subscription push streams only the latest candle each tick.
                _ = candles_ticker.tick() => {
                    if let Some((symbol, period)) = conn.candles_sub.clone() {
                        let resp = state.candles.candles(&symbol, &period, 1).await;
                        let frame = envelope_json(Topic::Candles { token_symbol: symbol, period }.type_str(), resp);
                        if send_text(&mut sink, &frame, limits.write_timeout).await.is_err() {
                            break;
                        }
                    }
                }

                _ = ping_ticker.tick() => {
                    if timeout(limits.write_timeout, sink.send(Message::Ping(Vec::new().into()))).await.is_err()
                        || sink.flush().await.is_err()
                    {
                        break;
                    }
                }

                // Inbound frames (with read timeout).
                msg = timeout(limits.read_timeout, stream.next()) => {
                    let msg = match msg {
                        Err(_elapsed) => {
                            tracing::debug!("ws: read timeout; closing");
                            break;
                        }
                        Ok(None) => break,        // stream ended
                        Ok(Some(Err(_))) => break, // protocol error
                        Ok(Some(Ok(m))) => m,
                    };

                    match msg {
                        Message::Text(text) => {
                            if !rate_ok(&mut conn, limits.max_msgs_per_sec) {
                                tracing::debug!("ws: inbound rate limit exceeded; closing");
                                break;
                            }
                            if !handle_text(&text, &state, &mut conn, &mut sink, &limits).await {
                                break;
                            }
                        }
                        Message::Binary(_) => {
                            // Treat binary as an invalid payload (Go expects JSON text).
                            if note_invalid(&mut conn, limits.max_invalid_payloads) {
                                break;
                            }
                        }
                        Message::Ping(payload) => {
                            if timeout(limits.write_timeout, sink.send(Message::Pong(payload))).await.is_err() {
                                break;
                            }
                        }
                        Message::Pong(_) => { /* read timeout already reset by the recv */ }
                        Message::Close(_) => break,
                    }
                }
            }
        };
    }

    loop {
        select_ws! {
            r = rx_store_balances.recv() => {
                if !forward_if_subscribed(&mut sink, &conn, TopicKey::StoreBalances, r, limits.write_timeout).await {
                    break;
                }
            }
            r = rx_glvs.recv() => {
                if !forward_if_subscribed(&mut sink, &conn, TopicKey::Glvs, r, limits.write_timeout).await {
                    break;
                }
            }
            r = rx_token_mints.recv() => {
                match r {
                    Ok(()) => {}
                    Err(broadcast::error::RecvError::Lagged(lost)) => {
                        metrics::record_ws_lag(metrics::WsTopic::TokenMints, lost);
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
                if !handle_token_mints_wakeup(&state, &mut conn, &mut sink, limits.write_timeout).await {
                    break;
                }
            }
        }
    }

    let _ = sink.close().await;
}

/// Apply the per-second inbound token bucket, returning `false` when the limit is exceeded.
fn rate_ok(conn: &mut ConnState, max_per_sec: u32) -> bool {
    let now = tokio::time::Instant::now();
    if now.duration_since(conn.window_start) >= Duration::from_secs(1) {
        conn.window_start = now;
        conn.window_count = 0;
    }
    conn.window_count += 1;
    conn.window_count <= max_per_sec
}

/// Increment the cumulative invalid-payload counter, returning `true` when the count exceeds `max` and the connection should close.
fn note_invalid(conn: &mut ConnState, max: u32) -> bool {
    conn.invalid_count += 1;
    conn.invalid_count > max
}

/// Forward a broadcast frame to the socket only if subscribed to `key`, returning `false` on write failure or closed channel.
async fn forward_if_subscribed<S>(
    sink: &mut S,
    conn: &ConnState,
    key: TopicKey,
    r: Result<Arc<str>, broadcast::error::RecvError>,
    write_timeout: Duration,
) -> bool
where
    S: SinkExt<Message> + Unpin,
{
    match r {
        Ok(frame) => {
            if conn.subs.contains(&key) {
                send_text(sink, &frame, write_timeout).await.is_ok()
            } else {
                true
            }
        }
        Err(broadcast::error::RecvError::Lagged(lost)) => {
            metrics::record_ws_lag_with(lost, || match key {
                TopicKey::IndexTokens => metrics::WsTopic::IndexTokens,
                TopicKey::Tickers => metrics::WsTopic::Tickers,
                TopicKey::SwapList => metrics::WsTopic::SwapList,
                TopicKey::StoreBalances => metrics::WsTopic::StoreBalances,
                TopicKey::Glvs => metrics::WsTopic::Glvs,
            });
            true
        }
        Err(broadcast::error::RecvError::Closed) => false,
    }
}

/// Send a text frame with a per-message write timeout + flush.
async fn send_text<S>(sink: &mut S, text: &str, write_timeout: Duration) -> Result<(), ()>
where
    S: SinkExt<Message> + Unpin,
{
    match timeout(
        write_timeout,
        sink.send(Message::Text(text.to_string().into())),
    )
    .await
    {
        Ok(Ok(())) => match timeout(write_timeout, sink.flush()).await {
            Ok(Ok(())) => Ok(()),
            _ => Err(()),
        },
        _ => Err(()),
    }
}

/// Handle one inbound text frame, returning `false` if the connection should close.
async fn handle_text<S>(
    text: &str,
    state: &AppState,
    conn: &mut ConnState,
    sink: &mut S,
    limits: &WsLimits,
) -> bool
where
    S: SinkExt<Message> + Unpin,
{
    // JSON parse failure counts as an invalid payload (Go's noteInvalid).
    let msg: ClientMsg = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(_) => {
            return !note_invalid(conn, limits.max_invalid_payloads);
        }
    };

    match parse_client_msg(&msg) {
        ClientIntent::Subscribe(topic) => handle_subscribe(topic, state, conn, sink, limits).await,
        ClientIntent::QueryCandles(sub) => {
            // One-shot: send ONE candles frame; do NOT add a subscription.
            let resp = state
                .candles
                .candles(&sub.token_symbol, &sub.period, sub.limit.unwrap_or(0))
                .await;
            let frame = envelope_json(
                Topic::Candles {
                    token_symbol: sub.token_symbol,
                    period: sub.period,
                }
                .type_str(),
                resp,
            );
            send_text(sink, &frame, limits.write_timeout).await.is_ok()
        }
        ClientIntent::Invalid => !note_invalid(conn, limits.max_invalid_payloads),
    }
}

/// Add a subscription (limit + dedup) then immediately push the current data once, returning `false` only on write failure.
async fn handle_subscribe<S>(
    topic: Topic,
    state: &AppState,
    conn: &mut ConnState,
    sink: &mut S,
    limits: &WsLimits,
) -> bool
where
    S: SinkExt<Message> + Unpin,
{
    let snap = state.snapshot();
    match topic {
        Topic::IndexTokens | Topic::Tickers | Topic::SwapList => {
            let key = match topic {
                Topic::IndexTokens => TopicKey::IndexTokens,
                Topic::Tickers => TopicKey::Tickers,
                Topic::SwapList => TopicKey::SwapList,
                _ => unreachable!(),
            };
            // Reject silently on duplicate or at the limit.
            if conn.subs.contains(&key) || conn.sub_count() >= limits.max_subscriptions {
                return true;
            }
            conn.subs.insert(key);
            let frame = push_once_frame(key, &snap);
            send_text(sink, &frame, limits.write_timeout).await.is_ok()
        }
        Topic::Candles {
            token_symbol,
            period,
        } => {
            // Replacing an existing candles sub doesn't grow the count; a new one at the limit is rejected silently.
            if conn.candles_sub.is_none() && conn.sub_count() >= limits.max_subscriptions {
                return true;
            }
            // Unlike other topics, candles-subscribe does not push-once; the first frame arrives on the next tick.
            conn.candles_sub = Some((token_symbol, period));
            true
        }
        Topic::StoreBalances => handle_store_balances_subscribe(state, conn, sink, limits).await,
        Topic::TokenMints(sub) => {
            handle_token_mints_subscribe(sub, state, conn, sink, limits).await
        }
        Topic::Glvs { with_snapshot } => {
            handle_glvs_subscribe(state, conn, sink, limits, with_snapshot).await
        }
        Topic::Heartbeat => true, // not a client-subscribable topic
    }
}

#[derive(Serialize)]
struct WsErrorPayload {
    topic: &'static str,
    error: &'static str,
    reason: String,
}

fn store_balances_error_frame(reason: &str) -> Arc<str> {
    envelope_json(
        "error",
        WsErrorPayload {
            topic: Topic::StoreBalances.type_str(),
            error: "store balances unavailable",
            reason: reason.to_string(),
        },
    )
}

fn store_balances_ready_frame(
    payload: &crate::sources::store_balances::StoreBalancesPayload,
) -> Arc<str> {
    envelope_json(Topic::StoreBalances.type_str(), payload)
}

async fn handle_store_balances_subscribe<S>(
    state: &AppState,
    conn: &mut ConnState,
    sink: &mut S,
    limits: &WsLimits,
) -> bool
where
    S: SinkExt<Message> + Unpin,
{
    use crate::sources::store_balances::StoreBalancesCacheState;

    let key = TopicKey::StoreBalances;
    if conn.subs.contains(&key) || conn.sub_count() >= limits.max_subscriptions {
        return true;
    }

    match &*state.store_balances.state() {
        StoreBalancesCacheState::Ready(payload) => {
            conn.subs.insert(key);
            let frame = store_balances_ready_frame(payload);
            send_text(sink, &frame, limits.write_timeout).await.is_ok()
        }
        StoreBalancesCacheState::Initializing { reason } => {
            conn.subs.insert(key);
            let frame = store_balances_error_frame(reason);
            send_text(sink, &frame, limits.write_timeout).await.is_ok()
        }
        StoreBalancesCacheState::Disabled { reason } => {
            let frame = store_balances_error_frame(reason);
            send_text(sink, &frame, limits.write_timeout).await.is_ok()
        }
    }
}

fn glvs_error_frame(error: &'static str, reason: &str) -> Arc<str> {
    envelope_json(
        "error",
        WsErrorPayload {
            topic: Topic::Glvs {
                with_snapshot: true,
            }
            .type_str(),
            error,
            reason: reason.to_string(),
        },
    )
}

async fn handle_glvs_subscribe<S>(
    state: &AppState,
    conn: &mut ConnState,
    sink: &mut S,
    limits: &WsLimits,
    with_snapshot: bool,
) -> bool
where
    S: SinkExt<Message> + Unpin,
{
    use crate::sources::glv_accounts::GlvAccountsCacheState;

    let key = TopicKey::Glvs;
    let already_subscribed = conn.subs.contains(&key);
    if !already_subscribed && conn.sub_count() >= limits.max_subscriptions {
        return true;
    }

    match &*state.glv_accounts.state() {
        GlvAccountsCacheState::Ready(cache) => {
            conn.subs.insert(key);
            if with_snapshot {
                send_text(sink, &cache.ws_frame, limits.write_timeout)
                    .await
                    .is_ok()
            } else {
                true
            }
        }
        GlvAccountsCacheState::Initializing { reason } => {
            conn.subs.insert(key);
            let frame = glvs_error_frame("glv accounts initializing", reason);
            send_text(sink, &frame, limits.write_timeout).await.is_ok()
        }
        GlvAccountsCacheState::Disabled { reason } => {
            let frame = glvs_error_frame("glv accounts disabled", reason);
            send_text(sink, &frame, limits.write_timeout).await.is_ok()
        }
    }
}

fn token_mints_error_frame(reason: &str) -> Arc<str> {
    envelope_json(
        "error",
        WsErrorPayload {
            topic: Topic::TokenMints(crate::ws_protocol::TokenMintsSub::default()).type_str(),
            error: "token mints unavailable",
            reason: reason.to_string(),
        },
    )
}

fn token_mints_ready_frame(payload: &crate::token_mints::TokenMintsPayload) -> Arc<str> {
    envelope_json(
        Topic::TokenMints(crate::ws_protocol::TokenMintsSub::default()).type_str(),
        payload,
    )
}

fn token_mints_payload_for_subscription(
    state: &AppState,
    sub: &mut TokenMintsSubscription,
) -> Option<Arc<str>> {
    use crate::token_mints::TokenMintsCacheState;

    let cache = match &*state.token_mints.state() {
        TokenMintsCacheState::Ready(cache) => cache.clone(),
        TokenMintsCacheState::Disabled { .. } | TokenMintsCacheState::Initializing { .. } => {
            return None;
        }
    };
    let payload = cache.to_payload(sub.filter.as_ref(), sub.with_data);
    let fingerprint = payload.fingerprint();
    match sub.last_view_fingerprint {
        None => {
            sub.last_view_fingerprint = Some(fingerprint);
            sub.with_snapshot.then(|| token_mints_ready_frame(&payload))
        }
        Some(prev) if prev == fingerprint => None,
        Some(_) => {
            sub.last_view_fingerprint = Some(fingerprint);
            Some(token_mints_ready_frame(&payload))
        }
    }
}

async fn handle_token_mints_wakeup<S>(
    state: &AppState,
    conn: &mut ConnState,
    sink: &mut S,
    write_timeout: Duration,
) -> bool
where
    S: SinkExt<Message> + Unpin,
{
    let frame = conn
        .token_mints_sub
        .as_mut()
        .and_then(|sub| token_mints_payload_for_subscription(state, sub));
    match frame {
        Some(frame) => send_text(sink, &frame, write_timeout).await.is_ok(),
        None => true,
    }
}

async fn handle_token_mints_subscribe<S>(
    sub: crate::ws_protocol::TokenMintsSub,
    state: &AppState,
    conn: &mut ConnState,
    sink: &mut S,
    limits: &WsLimits,
) -> bool
where
    S: SinkExt<Message> + Unpin,
{
    use crate::token_mints::{parse_pubkeys_filter, TokenMintsCacheState, TokenMintsPubkeysInput};

    let filter = match parse_pubkeys_filter(
        TokenMintsPubkeysInput::WsList(&sub.pubkeys),
        &state.config.token_mints,
    ) {
        Ok(filter) => filter,
        Err(_) => return !note_invalid(conn, limits.max_invalid_payloads),
    };

    if conn.token_mints_sub.is_none() && conn.sub_count() >= limits.max_subscriptions {
        return true;
    }

    match &*state.token_mints.state() {
        TokenMintsCacheState::Ready(cache) => {
            let payload = cache.to_payload(filter.as_ref(), sub.with_data);
            let fingerprint = payload.fingerprint();
            conn.token_mints_sub = Some(TokenMintsSubscription {
                filter,
                with_snapshot: sub.with_snapshot,
                with_data: sub.with_data,
                last_view_fingerprint: Some(fingerprint),
            });
            if sub.with_snapshot {
                let frame = token_mints_ready_frame(&payload);
                send_text(sink, &frame, limits.write_timeout).await.is_ok()
            } else {
                true
            }
        }
        TokenMintsCacheState::Initializing { reason } => {
            conn.token_mints_sub = Some(TokenMintsSubscription {
                filter,
                with_snapshot: sub.with_snapshot,
                with_data: sub.with_data,
                last_view_fingerprint: None,
            });
            let frame = token_mints_error_frame(reason);
            send_text(sink, &frame, limits.write_timeout).await.is_ok()
        }
        TokenMintsCacheState::Disabled { reason } => {
            let frame = token_mints_error_frame(reason);
            send_text(sink, &frame, limits.write_timeout).await.is_ok()
        }
    }
}

/// Build the push-once envelope JSON for a shared topic from the current snapshot.
fn push_once_frame(key: TopicKey, snap: &Snapshot) -> Arc<str> {
    match key {
        TopicKey::IndexTokens => envelope_json(Topic::IndexTokens.type_str(), &snap.index_infos),
        TopicKey::Tickers => envelope_json(Topic::Tickers.type_str(), &snap.sol_tickers),
        TopicKey::SwapList => envelope_json(Topic::SwapList.type_str(), &snap.swap_list),
        TopicKey::StoreBalances => unreachable!("storeBalances push-once reads the cache state"),
        TopicKey::Glvs => unreachable!("glvs push-once reads the cache state"),
    }
}

#[cfg(test)]
mod tests {
    use std::{
        pin::Pin,
        sync::Arc,
        task::{Context, Poll},
    };

    use super::*;

    #[test]
    fn note_invalid_disconnects_strictly_above_max() {
        let mut conn = ConnState::new();
        // max = 10: counts 1..=10 stay alive while 11 disconnects.
        for i in 1..=10 {
            assert!(!note_invalid(&mut conn, 10), "count {i} must stay alive");
        }
        assert!(note_invalid(&mut conn, 10), "11th invalid disconnects");
    }

    #[derive(Default)]
    struct RecordingSink {
        messages: Vec<Message>,
    }

    impl futures_util::Sink<Message> for RecordingSink {
        type Error = ();

        fn poll_ready(
            self: Pin<&mut Self>,
            _cx: &mut Context<'_>,
        ) -> Poll<Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }

        fn start_send(self: Pin<&mut Self>, item: Message) -> Result<(), Self::Error> {
            self.get_mut().messages.push(item);
            Ok(())
        }

        fn poll_flush(
            self: Pin<&mut Self>,
            _cx: &mut Context<'_>,
        ) -> Poll<Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }

        fn poll_close(
            self: Pin<&mut Self>,
            _cx: &mut Context<'_>,
        ) -> Poll<Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }
    }

    impl RecordingSink {
        fn text_values(&self) -> Vec<serde_json::Value> {
            self.messages
                .iter()
                .map(|message| match message {
                    Message::Text(text) => serde_json::from_str(text).unwrap(),
                    other => panic!("expected text message, got {other:?}"),
                })
                .collect()
        }
    }

    fn test_http_client() -> reqwest::Client {
        reqwest::Client::builder().no_proxy().build().unwrap()
    }

    fn test_sqd_service() -> gmsol_sqd_client::SqdService {
        gmsol_sqd_client::SqdService::with_http_client(Default::default(), test_http_client())
    }

    fn test_price_candle_service() -> gmsol_price_candle_client::PriceCandleService {
        gmsol_price_candle_client::PriceCandleService::with_http_client(
            Default::default(),
            test_http_client(),
        )
        .unwrap()
    }

    fn test_app_state(
        store_balances: crate::sources::store_balances::StoreBalancesHandle,
    ) -> AppState {
        let config = crate::config::Config::from_figment(figment::Figment::new()).unwrap();
        let sqd = test_sqd_service();
        let candle_cache = Arc::new(arc_swap::ArcSwap::from_pointee(
            crate::state::CandleCache::default(),
        ));
        let candle_tip = crate::state::new_candle_tip();
        let cl_prices = crate::state::new_cl_prices();
        let keeper_prices = crate::state::new_keeper_prices();
        let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
            Default::default(),
        )
        .unwrap();
        let glvs = Arc::new(arc_swap::ArcSwap::from_pointee(Vec::<
            crate::sources::rpc_markets::RpcGlv,
        >::new()));
        let chainlink_candle =
            crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
                Default::default(),
                false,
            )
            .unwrap();
        AppState {
            config: Arc::new(config),
            sqd: crate::sources::sqd::SqdSource::new(sqd.clone()),
            candles: crate::sources::candles::CandleSource::new(
                candle_cache.clone(),
                candle_tip.clone(),
            ),
            sqd_volumes: sqd,
            snapshot: Arc::new(arc_swap::ArcSwap::from_pointee(Snapshot::default())),
            candle_data: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            daily_cache: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            store_balances,
            token_mints: crate::token_mints::TokenMintsHandle::default(),
            token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
            glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle::default(),
            candle_cache,
            candle_tip,
            arbitrum,
            cl_prices,
            keeper_prices,
            keeper_execution_time:
                crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::default(),
            arbitrum_prices: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            glvs,
            glv_refs: Arc::new(arc_swap::ArcSwap::from_pointee(
                None::<Vec<crate::sources::rpc_markets::GlvRef>>,
            )),
            volumes: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            cl_auth_token: Arc::new(arc_swap::ArcSwap::from_pointee(None)),
            chainlink_candle,
            price_candle: test_price_candle_service(),
            uploader: Arc::new(crate::s3::AwsS3UploaderUnused),
            health: crate::health::Health::new(30),
            ws: WsBroadcast::new(),
            redis: None,
            chainlink_streams: crate::sources::chainlink_streams::ChainlinkStreamsClient::new(
                String::new(),
                String::new(),
                std::collections::HashMap::new(),
                false,
            )
            .unwrap(),
            streams_prices: Arc::new(arc_swap::ArcSwap::from_pointee(Vec::new())),
        }
    }

    fn test_app_state_with_token_mints(
        token_mints: crate::token_mints::TokenMintsHandle,
    ) -> AppState {
        let config = crate::config::Config::from_figment(figment::Figment::new()).unwrap();
        let sqd = test_sqd_service();
        let candle_cache = Arc::new(arc_swap::ArcSwap::from_pointee(
            crate::state::CandleCache::default(),
        ));
        let candle_tip = crate::state::new_candle_tip();
        let cl_prices = crate::state::new_cl_prices();
        let keeper_prices = crate::state::new_keeper_prices();
        let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
            Default::default(),
        )
        .unwrap();
        let glvs = Arc::new(arc_swap::ArcSwap::from_pointee(Vec::<
            crate::sources::rpc_markets::RpcGlv,
        >::new()));
        let chainlink_candle =
            crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
                Default::default(),
                false,
            )
            .unwrap();
        AppState {
            config: Arc::new(config),
            sqd: crate::sources::sqd::SqdSource::new(sqd.clone()),
            candles: crate::sources::candles::CandleSource::new(
                candle_cache.clone(),
                candle_tip.clone(),
            ),
            sqd_volumes: sqd,
            snapshot: Arc::new(arc_swap::ArcSwap::from_pointee(Snapshot::default())),
            candle_data: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            daily_cache: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            store_balances: crate::sources::store_balances::StoreBalancesHandle::default(),
            token_mints,
            token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
            glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle::default(),
            candle_cache,
            candle_tip,
            arbitrum,
            cl_prices,
            keeper_prices,
            keeper_execution_time:
                crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::default(),
            arbitrum_prices: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            glvs,
            glv_refs: Arc::new(arc_swap::ArcSwap::from_pointee(
                None::<Vec<crate::sources::rpc_markets::GlvRef>>,
            )),
            volumes: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            cl_auth_token: Arc::new(arc_swap::ArcSwap::from_pointee(None)),
            chainlink_candle,
            price_candle: test_price_candle_service(),
            uploader: Arc::new(crate::s3::AwsS3UploaderUnused),
            health: crate::health::Health::new(30),
            ws: WsBroadcast::new(),
            redis: None,
            chainlink_streams: crate::sources::chainlink_streams::ChainlinkStreamsClient::new(
                String::new(),
                String::new(),
                std::collections::HashMap::new(),
                false,
            )
            .unwrap(),
            streams_prices: Arc::new(arc_swap::ArcSwap::from_pointee(Vec::new())),
        }
    }

    fn store_balances_payload() -> crate::sources::store_balances::StoreBalancesPayload {
        crate::sources::store_balances::StoreBalancesPayload {
            store: "store111".to_string(),
            sol_balance: "123".to_string(),
            token_balances: vec![crate::sources::store_balances::StoreTokenBalance {
                mint: "mint111".to_string(),
                account: "account111".to_string(),
                amount: "456".to_string(),
                program_id: "program111".to_string(),
            }],
            is_snapshot: true,
            is_last_snapshot: true,
            has_last_snapshot: true,
        }
    }

    fn token_mints_cache(first: &str, second: &str) -> crate::token_mints::TokenMintsCache {
        let mut token_mints = std::collections::BTreeMap::new();
        token_mints.insert(
            first.to_string(),
            crate::token_mints::TokenMintRecord {
                pubkey: first.to_string(),
                program_id: anchor_spl::token::ID.to_string(),
                decimals: 9,
                supply: "100".to_string(),
                data_base64: "AAAA".to_string(),
            },
        );
        token_mints.insert(
            second.to_string(),
            crate::token_mints::TokenMintRecord {
                pubkey: second.to_string(),
                program_id: anchor_spl::token_2022::ID.to_string(),
                decimals: 6,
                supply: "200".to_string(),
                data_base64: "BBBB".to_string(),
            },
        );
        crate::token_mints::TokenMintsCache { token_mints }
    }

    fn token_mints_handle_ready(first: &str, second: &str) -> crate::token_mints::TokenMintsHandle {
        crate::token_mints::TokenMintsHandle::new(crate::token_mints::TokenMintsCacheState::Ready(
            token_mints_cache(first, second),
        ))
    }

    fn test_app_state_with_glv_accounts(
        glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle,
    ) -> AppState {
        let config = crate::config::Config::from_figment(figment::Figment::new()).unwrap();
        let sqd = test_sqd_service();
        let candle_cache = Arc::new(arc_swap::ArcSwap::from_pointee(
            crate::state::CandleCache::default(),
        ));
        let candle_tip = crate::state::new_candle_tip();
        let cl_prices = crate::state::new_cl_prices();
        let keeper_prices = crate::state::new_keeper_prices();
        let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
            Default::default(),
        )
        .unwrap();
        let glvs = Arc::new(arc_swap::ArcSwap::from_pointee(Vec::<
            crate::sources::rpc_markets::RpcGlv,
        >::new()));
        let chainlink_candle =
            crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
                Default::default(),
                false,
            )
            .unwrap();
        AppState {
            config: Arc::new(config),
            sqd: crate::sources::sqd::SqdSource::new(sqd.clone()),
            candles: crate::sources::candles::CandleSource::new(
                candle_cache.clone(),
                candle_tip.clone(),
            ),
            sqd_volumes: sqd,
            snapshot: Arc::new(arc_swap::ArcSwap::from_pointee(Snapshot::default())),
            candle_data: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            daily_cache: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            store_balances: crate::sources::store_balances::StoreBalancesHandle::default(),
            token_mints: crate::token_mints::TokenMintsHandle::default(),
            token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
            glv_accounts,
            candle_cache,
            candle_tip,
            arbitrum,
            cl_prices,
            keeper_prices,
            keeper_execution_time:
                crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::default(),
            arbitrum_prices: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            glvs,
            glv_refs: Arc::new(arc_swap::ArcSwap::from_pointee(
                None::<Vec<crate::sources::rpc_markets::GlvRef>>,
            )),
            volumes: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            cl_auth_token: Arc::new(arc_swap::ArcSwap::from_pointee(None)),
            chainlink_candle,
            price_candle: test_price_candle_service(),
            uploader: Arc::new(crate::s3::AwsS3UploaderUnused),
            health: crate::health::Health::new(30),
            ws: WsBroadcast::new(),
            redis: None,
            chainlink_streams: crate::sources::chainlink_streams::ChainlinkStreamsClient::new(
                String::new(),
                String::new(),
                std::collections::HashMap::new(),
                false,
            )
            .unwrap(),
            streams_prices: Arc::new(arc_swap::ArcSwap::from_pointee(Vec::new())),
        }
    }

    fn glv_accounts_payload() -> crate::sources::glv_accounts::GlvsPayload {
        crate::sources::glv_accounts::GlvsPayload {
            glvs: vec![crate::sources::glv_accounts::GlvAccountRecordPayload {
                glv: "glv111".to_string(),
                data: "AQID".to_string(),
                config: crate::sources::glv_accounts::GlvConfigPayload {
                    glv_token: "glvToken111".to_string(),
                    long_token: "long111".to_string(),
                    short_token: "short111".to_string(),
                    min_tokens_for_first_deposit: "1".to_string(),
                    shift_last_executed_at: "2".to_string(),
                },
                markets: Vec::new(),
                is_snapshot: true,
                is_last_snapshot: true,
                has_last_snapshot: true,
            }],
        }
    }

    #[test]
    fn store_balances_error_frame_uses_error_envelope() {
        let frame = store_balances_error_frame("balances initializing");
        let value: serde_json::Value = serde_json::from_str(&frame).unwrap();
        assert_eq!(value["type"], "error");
        assert_eq!(value["payload"]["topic"], "storeBalances");
        assert_eq!(value["payload"]["error"], "store balances unavailable");
        assert_eq!(value["payload"]["reason"], "balances initializing");
    }

    #[tokio::test]
    async fn store_balances_ready_subscribe_pushes_payload_and_subscribes() {
        let payload = store_balances_payload();
        let state = test_app_state(crate::sources::store_balances::StoreBalancesHandle::new(
            crate::sources::store_balances::StoreBalancesCacheState::Ready(payload.clone()),
        ));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open =
            handle_store_balances_subscribe(&state, &mut conn, &mut sink, &limits).await;

        assert!(keep_open);
        assert!(conn.subs.contains(&TopicKey::StoreBalances));
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "storeBalances");
        assert_eq!(frames[0]["payload"], serde_json::to_value(payload).unwrap());
    }

    #[tokio::test]
    async fn store_balances_initializing_subscribe_sends_error_and_keeps_subscription() {
        let state = test_app_state(crate::sources::store_balances::StoreBalancesHandle::new(
            crate::sources::store_balances::StoreBalancesCacheState::Initializing {
                reason: "waiting for first test refresh".to_string(),
            },
        ));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open =
            handle_store_balances_subscribe(&state, &mut conn, &mut sink, &limits).await;

        assert!(keep_open);
        assert!(conn.subs.contains(&TopicKey::StoreBalances));
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "error");
        assert_eq!(frames[0]["payload"]["topic"], "storeBalances");
        assert_eq!(frames[0]["payload"]["error"], "store balances unavailable");
        assert_eq!(
            frames[0]["payload"]["reason"],
            "waiting for first test refresh"
        );
    }

    #[tokio::test]
    async fn store_balances_disabled_subscribe_sends_error_without_subscription() {
        let state = test_app_state(
            crate::sources::store_balances::StoreBalancesHandle::disabled("disabled by test"),
        );
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open =
            handle_store_balances_subscribe(&state, &mut conn, &mut sink, &limits).await;

        assert!(keep_open);
        assert!(!conn.subs.contains(&TopicKey::StoreBalances));
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "error");
        assert_eq!(frames[0]["payload"]["topic"], "storeBalances");
        assert_eq!(frames[0]["payload"]["error"], "store balances unavailable");
        assert_eq!(frames[0]["payload"]["reason"], "disabled by test");
    }

    #[tokio::test]
    async fn store_balances_subscribe_dedups_and_respects_limit() {
        let state = test_app_state(crate::sources::store_balances::StoreBalancesHandle::new(
            crate::sources::store_balances::StoreBalancesCacheState::Ready(store_balances_payload()),
        ));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        assert!(handle_store_balances_subscribe(&state, &mut conn, &mut sink, &limits).await);
        assert!(handle_store_balances_subscribe(&state, &mut conn, &mut sink, &limits).await);
        assert_eq!(sink.messages.len(), 1);
        assert!(conn.subs.contains(&TopicKey::StoreBalances));

        let mut limited_conn = ConnState::new();
        let mut limited_sink = RecordingSink::default();
        let limited = WsLimits {
            max_subscriptions: 0,
            ..WsLimits::default()
        };
        assert!(
            handle_store_balances_subscribe(&state, &mut limited_conn, &mut limited_sink, &limited)
                .await
        );
        assert!(limited_sink.messages.is_empty());
        assert!(!limited_conn.subs.contains(&TopicKey::StoreBalances));
    }

    #[test]
    fn glvs_error_frame_uses_error_envelope() {
        let frame = glvs_error_frame("glv accounts initializing", "glvs initializing");
        let value: serde_json::Value = serde_json::from_str(&frame).unwrap();
        assert_eq!(value["type"], "error");
        assert_eq!(value["payload"]["topic"], "glvs");
        assert_eq!(value["payload"]["error"], "glv accounts initializing");
        assert_eq!(value["payload"]["reason"], "glvs initializing");
    }

    #[tokio::test]
    async fn glvs_ready_subscribe_with_snapshot_pushes_cached_frame_and_subscribes() {
        let payload = glv_accounts_payload();
        let ws_frame = crate::sources::glv_accounts::glvs_ws_frame(&payload);
        let state =
            test_app_state_with_glv_accounts(crate::sources::glv_accounts::GlvAccountsHandle::new(
                crate::sources::glv_accounts::GlvAccountsCacheState::Ready(
                    crate::sources::glv_accounts::GlvAccountsCache {
                        payload: payload.clone(),
                        ws_frame,
                    },
                ),
            ));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open = handle_glvs_subscribe(&state, &mut conn, &mut sink, &limits, true).await;

        assert!(keep_open);
        assert!(conn.subs.contains(&TopicKey::Glvs));
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "glvs");
        assert_eq!(frames[0]["payload"], serde_json::to_value(payload).unwrap());
    }

    #[tokio::test]
    async fn glvs_ready_subscribe_without_snapshot_subscribes_without_push() {
        let payload = glv_accounts_payload();
        let ws_frame = crate::sources::glv_accounts::glvs_ws_frame(&payload);
        let state =
            test_app_state_with_glv_accounts(crate::sources::glv_accounts::GlvAccountsHandle::new(
                crate::sources::glv_accounts::GlvAccountsCacheState::Ready(
                    crate::sources::glv_accounts::GlvAccountsCache { payload, ws_frame },
                ),
            ));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open = handle_glvs_subscribe(&state, &mut conn, &mut sink, &limits, false).await;

        assert!(keep_open);
        assert!(conn.subs.contains(&TopicKey::Glvs));
        assert!(sink.messages.is_empty());
    }

    #[tokio::test]
    async fn glvs_duplicate_subscribe_can_request_snapshot_without_growing_sub_count() {
        let payload = glv_accounts_payload();
        let ws_frame = crate::sources::glv_accounts::glvs_ws_frame(&payload);
        let state =
            test_app_state_with_glv_accounts(crate::sources::glv_accounts::GlvAccountsHandle::new(
                crate::sources::glv_accounts::GlvAccountsCacheState::Ready(
                    crate::sources::glv_accounts::GlvAccountsCache {
                        payload: payload.clone(),
                        ws_frame,
                    },
                ),
            ));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        assert!(handle_glvs_subscribe(&state, &mut conn, &mut sink, &limits, false).await);
        assert_eq!(conn.sub_count(), 1);
        assert!(sink.messages.is_empty());

        assert!(handle_glvs_subscribe(&state, &mut conn, &mut sink, &limits, true).await);
        assert_eq!(conn.sub_count(), 1);
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "glvs");
        assert_eq!(frames[0]["payload"], serde_json::to_value(payload).unwrap());
    }

    #[tokio::test]
    async fn glvs_initializing_subscribe_sends_error_and_keeps_subscription() {
        let state =
            test_app_state_with_glv_accounts(crate::sources::glv_accounts::GlvAccountsHandle::new(
                crate::sources::glv_accounts::GlvAccountsCacheState::Initializing {
                    reason: "waiting for first test refresh".to_string(),
                },
            ));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open = handle_glvs_subscribe(&state, &mut conn, &mut sink, &limits, true).await;

        assert!(keep_open);
        assert!(conn.subs.contains(&TopicKey::Glvs));
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "error");
        assert_eq!(frames[0]["payload"]["topic"], "glvs");
        assert_eq!(frames[0]["payload"]["error"], "glv accounts initializing");
        assert_eq!(
            frames[0]["payload"]["reason"],
            "waiting for first test refresh"
        );
    }

    #[tokio::test]
    async fn glvs_disabled_subscribe_sends_error_without_subscription() {
        let state = test_app_state_with_glv_accounts(
            crate::sources::glv_accounts::GlvAccountsHandle::disabled("disabled by test"),
        );
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open = handle_glvs_subscribe(&state, &mut conn, &mut sink, &limits, true).await;

        assert!(keep_open);
        assert!(!conn.subs.contains(&TopicKey::Glvs));
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "error");
        assert_eq!(frames[0]["payload"]["topic"], "glvs");
        assert_eq!(frames[0]["payload"]["error"], "glv accounts disabled");
        assert_eq!(frames[0]["payload"]["reason"], "disabled by test");
    }

    #[test]
    fn token_mints_error_frame_uses_error_envelope() {
        let frame = token_mints_error_frame("mints initializing");
        let value: serde_json::Value = serde_json::from_str(&frame).unwrap();
        assert_eq!(value["type"], "error");
        assert_eq!(value["payload"]["topic"], "tokenMints");
        assert_eq!(value["payload"]["error"], "token mints unavailable");
        assert_eq!(value["payload"]["reason"], "mints initializing");
    }

    #[tokio::test]
    async fn token_mints_ready_subscribe_pushes_snapshot_when_requested() {
        let first = gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey::new_unique().to_string();
        let second = gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey::new_unique().to_string();
        let state = test_app_state_with_token_mints(token_mints_handle_ready(&first, &second));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open = handle_token_mints_subscribe(
            crate::ws_protocol::TokenMintsSub {
                pubkeys: vec![second.clone(), first.clone()],
                with_snapshot: true,
                with_data: true,
            },
            &state,
            &mut conn,
            &mut sink,
            &limits,
        )
        .await;

        assert!(keep_open);
        assert!(conn.token_mints_sub.is_some());
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "tokenMints");
        assert_eq!(frames[0]["payload"]["tokenMints"][0]["pubkey"], second);
        assert_eq!(frames[0]["payload"]["tokenMints"][0]["data"], "BBBB");
        assert_eq!(
            frames[0]["payload"]["tokenMints"][0]["isLastSnapshot"],
            false
        );
        assert_eq!(frames[0]["payload"]["tokenMints"][1]["pubkey"], first);
        assert_eq!(
            frames[0]["payload"]["tokenMints"][1]["isLastSnapshot"],
            true
        );
    }

    #[tokio::test]
    async fn token_mints_ready_subscribe_without_snapshot_sets_baseline_only() {
        let first = gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey::new_unique().to_string();
        let second = gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey::new_unique().to_string();
        let state = test_app_state_with_token_mints(token_mints_handle_ready(&first, &second));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open = handle_token_mints_subscribe(
            crate::ws_protocol::TokenMintsSub {
                pubkeys: vec![first],
                with_snapshot: false,
                with_data: false,
            },
            &state,
            &mut conn,
            &mut sink,
            &limits,
        )
        .await;

        assert!(keep_open);
        assert!(conn.token_mints_sub.is_some());
        assert!(conn
            .token_mints_sub
            .as_ref()
            .unwrap()
            .last_view_fingerprint
            .is_some());
        assert!(sink.messages.is_empty());
    }

    #[tokio::test]
    async fn token_mints_initializing_subscribe_sends_error_and_keeps_subscription() {
        let state = test_app_state_with_token_mints(crate::token_mints::TokenMintsHandle::new(
            crate::token_mints::TokenMintsCacheState::Initializing {
                reason: "waiting for first test refresh".to_string(),
            },
        ));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open = handle_token_mints_subscribe(
            crate::ws_protocol::TokenMintsSub {
                pubkeys: Vec::new(),
                with_snapshot: true,
                with_data: false,
            },
            &state,
            &mut conn,
            &mut sink,
            &limits,
        )
        .await;

        assert!(keep_open);
        assert!(conn.token_mints_sub.is_some());
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "error");
        assert_eq!(frames[0]["payload"]["topic"], "tokenMints");
        assert_eq!(
            frames[0]["payload"]["reason"],
            "waiting for first test refresh"
        );
    }

    #[tokio::test]
    async fn token_mints_disabled_subscribe_sends_error_without_subscription() {
        let state = test_app_state_with_token_mints(
            crate::token_mints::TokenMintsHandle::disabled("disabled by test"),
        );
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        let keep_open = handle_token_mints_subscribe(
            crate::ws_protocol::TokenMintsSub::default(),
            &state,
            &mut conn,
            &mut sink,
            &limits,
        )
        .await;

        assert!(keep_open);
        assert!(conn.token_mints_sub.is_none());
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "error");
        assert_eq!(frames[0]["payload"]["reason"], "disabled by test");
    }

    #[tokio::test]
    async fn token_mints_wakeup_pushes_full_replacement_only_on_change() {
        let first = gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey::new_unique().to_string();
        let second = gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey::new_unique().to_string();
        let state = test_app_state_with_token_mints(token_mints_handle_ready(&first, &second));
        let mut conn = ConnState::new();
        let mut sink = RecordingSink::default();
        let limits = WsLimits::default();

        assert!(
            handle_token_mints_subscribe(
                crate::ws_protocol::TokenMintsSub {
                    pubkeys: vec![first.clone(), second.clone()],
                    with_snapshot: false,
                    with_data: false,
                },
                &state,
                &mut conn,
                &mut sink,
                &limits,
            )
            .await
        );
        assert!(sink.messages.is_empty());

        assert!(
            handle_token_mints_wakeup(&state, &mut conn, &mut sink, limits.write_timeout).await
        );
        assert!(sink.messages.is_empty(), "same view must not push");

        let mut changed = token_mints_cache(&first, &second);
        changed.token_mints.get_mut(&second).unwrap().supply = "201".to_string();
        state.token_mints.set_ready(changed);

        assert!(
            handle_token_mints_wakeup(&state, &mut conn, &mut sink, limits.write_timeout).await
        );
        let frames = sink.text_values();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["type"], "tokenMints");
        assert_eq!(
            frames[0]["payload"]["tokenMints"].as_array().unwrap().len(),
            2
        );
        assert_eq!(frames[0]["payload"]["tokenMints"][1]["supply"], "201");
    }
}
