//! WebSocket protocol types for the legacy `/ws` frontend contract (Go's `SocketRespMessage` / `SocketReqMessage`).

use serde::{Deserialize, Serialize};

/// Server→client wrapper serializing to `{"type":<topic>,"payload":<...>}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envelope<T> {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: T,
}

impl<T> Envelope<T> {
    pub fn new(msg_type: impl Into<String>, payload: T) -> Self {
        Self {
            msg_type: msg_type.into(),
            payload,
        }
    }
}

/// A server-push topic plus, for `candles`, its subscription parameters.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Topic {
    IndexTokens,
    Tickers,
    SwapList,
    Candles {
        token_symbol: String,
        period: String,
    },
    StoreBalances,
    TokenMints(TokenMintsSub),
    Glvs {
        with_snapshot: bool,
    },
    Heartbeat,
}

impl Topic {
    /// The on-the-wire `type` string for this topic (matches the Go contract).
    pub fn type_str(&self) -> &'static str {
        match self {
            Topic::IndexTokens => "indexTokens",
            Topic::Tickers => "tickers",
            Topic::SwapList => "swapList",
            Topic::Candles { .. } => "candles",
            Topic::StoreBalances => "storeBalances",
            Topic::TokenMints(_) => "tokenMints",
            Topic::Glvs { .. } => "glvs",
            Topic::Heartbeat => "heartbeat",
        }
    }
}

/// Incoming client message (Go's `SocketReqMessage`); `query`/`subscribe` default to empty, `payload` optional.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct ClientMsg {
    #[serde(default)]
    pub query: String,
    #[serde(default)]
    pub subscribe: String,
    #[serde(default)]
    pub payload: Option<serde_json::Value>,
    #[serde(default)]
    pub pubkeys: Vec<String>,
    #[serde(default, rename = "withSnapshot")]
    pub with_snapshot: Option<bool>,
    #[serde(default, rename = "withData")]
    pub with_data: bool,
}

/// `candles` subscription / query payload: `{"tokenSymbol":..,"period":..,"limit":..}`.
/// `limit` is optional and only honored by one-shot queries (subscriptions ignore it).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CandlesSub {
    pub token_symbol: String,
    pub period: String,
    #[serde(default)]
    pub limit: Option<u32>,
}

impl CandlesSub {
    /// Returns `true` iff `period` is a configured valid period and `token_symbol` is 1..=20 ASCII alphanumeric characters.
    pub fn valid(&self) -> bool {
        let period_ok = crate::runtime::params()
            .valid_periods
            .iter()
            .any(|p| p == &self.period);
        let sym = &self.token_symbol;
        let symbol_ok =
            (1..=20).contains(&sym.len()) && sym.chars().all(|c| c.is_ascii_alphanumeric());
        period_ok && symbol_ok
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TokenMintsSub {
    #[serde(default)]
    pub pubkeys: Vec<String>,
    #[serde(default)]
    pub with_snapshot: bool,
    #[serde(default)]
    pub with_data: bool,
}

/// Heartbeat payload: `{"timestamp":<unix i64>}`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Heartbeat {
    pub timestamp: i64,
}

/// The interpreted intent of a [`ClientMsg`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClientIntent {
    Subscribe(Topic),
    /// One-shot candles query (no ongoing subscription).
    QueryCandles(CandlesSub),
    Invalid,
}

/// Interpret a [`ClientMsg`] into a [`ClientIntent`], preferring `subscribe` over `query` and falling back to `Invalid`.
pub fn parse_client_msg(msg: &ClientMsg) -> ClientIntent {
    if !msg.subscribe.is_empty() {
        return match msg.subscribe.as_str() {
            "tickers" => ClientIntent::Subscribe(Topic::Tickers),
            "indexTokens" => ClientIntent::Subscribe(Topic::IndexTokens),
            "swapList" => ClientIntent::Subscribe(Topic::SwapList),
            "storeBalances" => ClientIntent::Subscribe(Topic::StoreBalances),
            "tokenMints" => match decode_token_mints(msg) {
                Some(sub) => ClientIntent::Subscribe(Topic::TokenMints(sub)),
                None => ClientIntent::Invalid,
            },
            "glvs" => ClientIntent::Subscribe(Topic::Glvs {
                with_snapshot: msg.with_snapshot.unwrap_or(true),
            }),
            "candles" => match decode_valid_candles(msg) {
                Some(sub) => ClientIntent::Subscribe(Topic::Candles {
                    token_symbol: sub.token_symbol,
                    period: sub.period,
                }),
                None => ClientIntent::Invalid,
            },
            _ => ClientIntent::Invalid,
        };
    }

    if msg.query == "candles" {
        return match decode_valid_candles(msg) {
            Some(sub) => ClientIntent::QueryCandles(sub),
            None => ClientIntent::Invalid,
        };
    }

    ClientIntent::Invalid
}

/// Decode `msg.payload` into a [`CandlesSub`] and return it only if it validates.
fn decode_valid_candles(msg: &ClientMsg) -> Option<CandlesSub> {
    let payload = msg.payload.as_ref()?;
    let sub: CandlesSub = serde_json::from_value(payload.clone()).ok()?;
    sub.valid().then_some(sub)
}

fn decode_token_mints(msg: &ClientMsg) -> Option<TokenMintsSub> {
    let mut sub = match msg.payload.as_ref() {
        Some(payload) => serde_json::from_value::<TokenMintsSub>(payload.clone()).ok()?,
        None => TokenMintsSub::default(),
    };
    if !msg.pubkeys.is_empty() {
        sub.pubkeys = msg.pubkeys.clone();
    }
    if msg.with_snapshot == Some(true) {
        sub.with_snapshot = true;
    }
    if msg.with_data {
        sub.with_data = true;
    }
    Some(sub)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn query_candles(payload: serde_json::Value) -> ClientMsg {
        ClientMsg {
            query: "candles".into(),
            subscribe: String::new(),
            payload: Some(payload),
            pubkeys: Vec::new(),
            with_snapshot: None,
            with_data: false,
        }
    }

    #[test]
    fn query_candles_decodes_limit() {
        let msg = query_candles(serde_json::json!({"tokenSymbol":"BTC","period":"1m","limit":3}));
        match parse_client_msg(&msg) {
            ClientIntent::QueryCandles(sub) => assert_eq!(sub.limit, Some(3)),
            other => panic!("expected QueryCandles, got {other:?}"),
        }
    }

    #[test]
    fn query_candles_limit_defaults_to_none_when_absent() {
        let msg = query_candles(serde_json::json!({"tokenSymbol":"BTC","period":"1m"}));
        match parse_client_msg(&msg) {
            ClientIntent::QueryCandles(sub) => assert_eq!(sub.limit, None),
            other => panic!("expected QueryCandles, got {other:?}"),
        }
    }

    #[test]
    fn subscribe_store_balances_accepts_optional_with_snapshot_field() {
        let msg: ClientMsg =
            serde_json::from_value(serde_json::json!({"subscribe":"storeBalances"})).unwrap();
        assert_eq!(
            parse_client_msg(&msg),
            ClientIntent::Subscribe(Topic::StoreBalances)
        );

        let msg: ClientMsg = serde_json::from_value(
            serde_json::json!({"subscribe":"storeBalances","withSnapshot":false}),
        )
        .unwrap();
        assert_eq!(
            parse_client_msg(&msg),
            ClientIntent::Subscribe(Topic::StoreBalances)
        );
    }

    #[test]
    fn subscribe_token_mints_decodes_top_level_fields() {
        let first = "11111111111111111111111111111111";
        let msg: ClientMsg = serde_json::from_value(serde_json::json!({
            "subscribe": "tokenMints",
            "pubkeys": [first],
            "withSnapshot": true,
            "withData": true
        }))
        .unwrap();

        assert_eq!(
            parse_client_msg(&msg),
            ClientIntent::Subscribe(Topic::TokenMints(TokenMintsSub {
                pubkeys: vec![first.to_string()],
                with_snapshot: true,
                with_data: true,
            }))
        );
    }

    #[test]
    fn subscribe_token_mints_decodes_payload_fields() {
        let first = "11111111111111111111111111111111";
        let msg: ClientMsg = serde_json::from_value(serde_json::json!({
            "subscribe": "tokenMints",
            "payload": {
                "pubkeys": [first],
                "withSnapshot": true,
                "withData": true
            }
        }))
        .unwrap();

        assert_eq!(
            parse_client_msg(&msg),
            ClientIntent::Subscribe(Topic::TokenMints(TokenMintsSub {
                pubkeys: vec![first.to_string()],
                with_snapshot: true,
                with_data: true,
            }))
        );
    }

    #[test]
    fn subscribe_token_mints_rejects_malformed_payload() {
        let msg: ClientMsg = serde_json::from_value(serde_json::json!({
            "subscribe": "tokenMints",
            "payload": {
                "pubkeys": "not-a-list"
            }
        }))
        .unwrap();

        assert_eq!(parse_client_msg(&msg), ClientIntent::Invalid);
    }

    #[test]
    fn subscribe_glvs_parses_with_snapshot_default_true() {
        let msg: ClientMsg =
            serde_json::from_value(serde_json::json!({"subscribe":"glvs"})).unwrap();
        assert_eq!(
            parse_client_msg(&msg),
            ClientIntent::Subscribe(Topic::Glvs {
                with_snapshot: true
            })
        );
    }

    #[test]
    fn subscribe_glvs_parses_with_snapshot_false() {
        let msg: ClientMsg =
            serde_json::from_value(serde_json::json!({"subscribe":"glvs","withSnapshot":false}))
                .unwrap();
        assert_eq!(
            parse_client_msg(&msg),
            ClientIntent::Subscribe(Topic::Glvs {
                with_snapshot: false
            })
        );
    }
}
