//! Keeper (marin) graphql-ws price subscription feeding the live `data_source = Chainlink` price leg
//! into [`AppState::keeper_prices`] and, under `price_candle_first`, the forming candle tips. This
//! replicates the old Go backend's `flush_token_price` subscription
//! (`subscription { tokens(withSnapshot: true) { pubkey price { ts min max } } }`).

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, http::HeaderValue, Message};

use crate::state::{AppState, KeeperPrices};

/// Delay before reconnecting a dropped/failed subscription.
const RECONNECT_DELAY: Duration = Duration::from_secs(2);
/// Force a reconnect if no frame arrives within this window (a dead connection sends nothing).
const IDLE_TIMEOUT: Duration = Duration::from_secs(60);
/// graphql-transport-ws subscription: every enabled token's live price, snapshot-first then updates.
const SUB_QUERY: &str =
    "subscription { tokens(withSnapshot: true) { pubkey price { ts min max } } }";

type KeeperPriceUpdate = (String, u128, u128, i64);

/// Run the keeper price subscription forever, reconnecting on any drop. No-op when no endpoint is configured.
pub async fn run_keeper_price_subscription(state: AppState) {
    let endpoint = state.config.keeper.graphql_ws_endpoint.trim().to_string();
    if endpoint.is_empty() {
        tracing::info!("keeper price subscription disabled (keeper.graphql_ws_endpoint empty)");
        return;
    }
    tracing::info!(endpoint = %endpoint, "keeper price subscription starting");
    loop {
        if let Err(err) = subscribe_once(&state, &endpoint).await {
            tracing::warn!(endpoint = %endpoint, error = ?err, "keeper price subscription disconnected; reconnecting");
        }
        tokio::time::sleep(RECONNECT_DELAY).await;
    }
}

/// One connection lifetime: connect, init + subscribe (pipelined, matching the old Go backend), apply price updates until it ends, errors, or goes idle.
async fn subscribe_once(state: &AppState, endpoint: &str) -> eyre::Result<()> {
    let mut request = endpoint.into_client_request()?;
    request.headers_mut().insert(
        "Sec-WebSocket-Protocol",
        HeaderValue::from_static("graphql-transport-ws"),
    );
    let (mut ws, _resp) = tokio_tungstenite::connect_async(request).await?;

    ws.send(Message::text(r#"{"type":"connection_init"}"#))
        .await?;
    let subscribe = serde_json::json!({
        "id": "1",
        "type": "subscribe",
        "payload": { "query": SUB_QUERY },
    })
    .to_string();
    ws.send(Message::text(subscribe)).await?;

    loop {
        let msg = match tokio::time::timeout(IDLE_TIMEOUT, ws.next()).await {
            Err(_) => eyre::bail!("idle timeout"),
            Ok(None) => return Ok(()), // stream ended cleanly
            Ok(Some(item)) => item?,
        };
        match msg {
            Message::Text(text) => {
                let (reply, update) = handle_text(&state.keeper_prices, text.as_str());
                if let Some((pubkey, min, max, ts)) = update {
                    apply_candle_tip(state, &pubkey, min, max, ts).await;
                }
                if let Some(reply) = reply {
                    ws.send(reply).await?;
                }
            }
            Message::Ping(payload) => ws.send(Message::Pong(payload)).await?,
            Message::Close(_) => return Ok(()),
            _ => {}
        }
    }
}

/// Handle one graphql-transport-ws text frame; returns an optional reply (keep-alive pong). `next` frames upsert `prices`.
fn handle_text(prices: &KeeperPrices, text: &str) -> (Option<Message>, Option<KeeperPriceUpdate>) {
    let Ok(val) = serde_json::from_str::<serde_json::Value>(text) else {
        return (None, None);
    };
    match val.get("type").and_then(serde_json::Value::as_str) {
        Some("ping") => (Some(Message::text(r#"{"type":"pong"}"#)), None),
        Some("next") => (None, apply_price(prices, &val)),
        // connection_ack / complete / error / pong: nothing to do.
        _ => (None, None),
    }
}

/// Extract `{pubkey, price{ts,min,max}}` from a `next` payload and upsert it into `prices`.
/// `min`/`max` are the keeper `to_unit_price` (`P*10^(20-decimals)`); the price composer lifts them to internal `U`.
fn apply_price(prices: &KeeperPrices, val: &serde_json::Value) -> Option<KeeperPriceUpdate> {
    let token = val.pointer("/payload/data/tokens")?;
    let pubkey = token.get("pubkey").and_then(serde_json::Value::as_str)?;
    // `price` is null until the keeper has a price for the token.
    let price = match token.get("price") {
        Some(p) if !p.is_null() => p,
        _ => return None,
    };
    let ts = price.get("ts").and_then(serde_json::Value::as_i64)?;
    let min = price
        .get("min")
        .and_then(serde_json::Value::as_str)?
        .parse::<u128>()
        .ok()?;
    let max = price
        .get("max")
        .and_then(serde_json::Value::as_str)?
        .parse::<u128>()
        .ok()?;
    if let Ok(mut map) = prices.lock() {
        map.insert(pubkey.to_string(), (min, max, ts));
    }
    Some((pubkey.to_string(), min, max, ts))
}

/// Under `price_candle_first`, use the already-subscribed keeper midpoint to keep the
/// forming candle current between the slower authoritative price-candle prefetches.
async fn apply_candle_tip(state: &AppState, pubkey: &str, min: u128, max: u128, ts: i64) {
    if !state.config.price_candle_first {
        return;
    }
    let Some(row) = crate::tokens::token_by_mint(pubkey) else {
        return;
    };
    // Match the historical prefetch universe; do not expose hidden/extra tokens through a live-only tip.
    if !row.view_flg {
        return;
    }
    let price = midpoint_price(min, max, row.decimals.max(0) as u32);
    let symbol = crate::sources::chainlink_candle::data_source_symbol(row.symbol);
    crate::candle_stream::apply_live_candle_price(state, &symbol, ts, price).await;
}

fn midpoint_price(min: u128, max: u128, decimals: u32) -> f64 {
    // Overflow-safe floor((min + max) / 2), matching integer source precision.
    let midpoint = min / 2 + max / 2 + (min % 2 + max % 2) / 2;
    let price_u = crate::aggregate::scale::unit_price_to_u(midpoint, decimals);
    price_u as f64 / 1e20
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::new_keeper_prices;

    #[test]
    fn apply_price_upserts_next_payload() {
        let prices = new_keeper_prices();
        let msg = serde_json::json!({
            "type": "next",
            "payload": { "data": { "tokens": {
                "pubkey": "So11111111111111111111111111111111111111112",
                "price": { "ts": 1_700, "min": "63000000000000", "max": "64000000000000" }
            }}}
        });
        let update = apply_price(&prices, &msg);
        assert_eq!(
            update,
            Some((
                "So11111111111111111111111111111111111111112".to_string(),
                63_000_000_000_000,
                64_000_000_000_000,
                1_700,
            ))
        );
        assert_eq!(
            prices
                .lock()
                .unwrap()
                .get("So11111111111111111111111111111111111111112")
                .copied(),
            Some((63_000_000_000_000u128, 64_000_000_000_000u128, 1_700i64))
        );
    }

    #[test]
    fn apply_price_skips_null_price() {
        let prices = new_keeper_prices();
        let msg = serde_json::json!({
            "type": "next",
            "payload": { "data": { "tokens": { "pubkey": "X", "price": null }}}
        });
        apply_price(&prices, &msg);
        assert!(prices.lock().unwrap().is_empty());
    }

    #[test]
    fn keeper_midpoint_converts_unit_price_to_candle_price() {
        let price = midpoint_price(63_000_000_000_000, 64_000_000_000_000, 8);
        assert!((price - 63.5).abs() < 1e-12);
    }

    #[test]
    fn handle_text_pongs_ping_and_ignores_ack() {
        let prices = new_keeper_prices();
        assert!(matches!(
            handle_text(&prices, r#"{"type":"ping"}"#),
            (Some(Message::Text(_)), None)
        ));
        assert_eq!(
            handle_text(&prices, r#"{"type":"connection_ack"}"#),
            (None, None)
        );
    }
}
