//! GM/GLV token mint metadata cache and wire payload helpers.

use std::collections::BTreeMap;
use std::hash::{Hash, Hasher};
use std::str::FromStr;
use std::sync::Arc;

use arc_swap::ArcSwap;
use serde::{Deserialize, Serialize};

use crate::config::{Config, TokenMintsConfig};

use gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey;

const DISABLED_REASON: &str = "token mints disabled";
const RUNTIME_DISABLED_REASON: &str = "token mints runtime switch is disabled";
const EMPTY_RPC_ENDPOINT_REASON: &str = "rpc.endpoint is empty; token mints unavailable";
const INVALID_STORE_REASON: &str = "rpc.store is empty or invalid; token mints unavailable";
const WAITING_FOR_FIRST_REFRESH_REASON: &str = "waiting for first token mints refresh";
const REFRESH_FAILED_REASON: &str = "token mints refresh failed; retrying";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TokenMintsCacheState {
    Disabled { reason: String },
    Initializing { reason: String },
    Ready(TokenMintsCache),
}

#[derive(Clone)]
pub struct TokenMintsHandle {
    inner: Arc<ArcSwap<TokenMintsCacheState>>,
}

impl TokenMintsHandle {
    pub fn new(initial_state: TokenMintsCacheState) -> Self {
        Self {
            inner: Arc::new(ArcSwap::from_pointee(initial_state)),
        }
    }

    pub fn disabled(reason: impl Into<String>) -> Self {
        Self::new(TokenMintsCacheState::Disabled {
            reason: reason.into(),
        })
    }

    pub fn from_config(config: &Config) -> Self {
        Self::new(initial_cache_state(config))
    }

    pub fn state(&self) -> Arc<TokenMintsCacheState> {
        self.inner.load_full()
    }

    pub fn set_disabled(&self, reason: impl Into<String>) {
        self.inner.store(Arc::new(TokenMintsCacheState::Disabled {
            reason: reason.into(),
        }));
    }

    pub fn set_initializing(&self, reason: impl Into<String>) {
        self.inner
            .store(Arc::new(TokenMintsCacheState::Initializing {
                reason: reason.into(),
            }));
    }

    pub fn set_ready(&self, cache: TokenMintsCache) {
        self.inner
            .store(Arc::new(TokenMintsCacheState::Ready(cache)));
    }

    pub fn note_refresh_failure(&self) {
        if !matches!(&*self.state(), TokenMintsCacheState::Ready(_)) {
            self.set_initializing(REFRESH_FAILED_REASON);
        }
    }
}

impl Default for TokenMintsHandle {
    fn default() -> Self {
        Self::disabled(DISABLED_REASON)
    }
}

fn initial_cache_state(config: &Config) -> TokenMintsCacheState {
    if !config.token_mints.enabled {
        return TokenMintsCacheState::Disabled {
            reason: RUNTIME_DISABLED_REASON.to_string(),
        };
    }
    if config.rpc.endpoint.is_empty() {
        return TokenMintsCacheState::Disabled {
            reason: EMPTY_RPC_ENDPOINT_REASON.to_string(),
        };
    }
    if Pubkey::from_str(&config.rpc.store).is_err() {
        return TokenMintsCacheState::Disabled {
            reason: INVALID_STORE_REASON.to_string(),
        };
    }
    TokenMintsCacheState::Initializing {
        reason: WAITING_FOR_FIRST_REFRESH_REASON.to_string(),
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenMintsCache {
    pub token_mints: BTreeMap<String, TokenMintRecord>,
}

impl TokenMintsCache {
    pub fn to_payload(
        &self,
        filter: Option<&TokenMintsFilter>,
        with_data: bool,
    ) -> TokenMintsPayload {
        let records: Vec<&TokenMintRecord> = match filter {
            Some(filter) => filter
                .pubkeys
                .iter()
                .filter_map(|pubkey| self.token_mints.get(pubkey))
                .collect(),
            None => self.token_mints.values().collect(),
        };

        let last_index = records.len().checked_sub(1);
        let token_mints = records
            .into_iter()
            .enumerate()
            .map(|(idx, record)| TokenMintPayload {
                pubkey: record.pubkey.clone(),
                program_id: record.program_id.clone(),
                decimals: record.decimals,
                supply: record.supply.clone(),
                data: with_data.then(|| record.data_base64.clone()),
                is_snapshot: true,
                is_last_snapshot: Some(Some(idx) == last_index),
                has_last_snapshot: true,
            })
            .collect();

        TokenMintsPayload { token_mints }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenMintRecord {
    pub pubkey: String,
    pub program_id: String,
    pub decimals: u8,
    pub supply: String,
    pub data_base64: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenMintsPayload {
    pub token_mints: Vec<TokenMintPayload>,
}

impl TokenMintsPayload {
    pub fn fingerprint(&self) -> u64 {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        self.hash(&mut hasher);
        hasher.finish()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenMintPayload {
    pub pubkey: String,
    pub program_id: String,
    pub decimals: u8,
    pub supply: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<String>,
    pub is_snapshot: bool,
    pub is_last_snapshot: Option<bool>,
    pub has_last_snapshot: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TokenMintsFilter {
    pub pubkeys: Vec<String>,
}

#[derive(Clone, Copy, Debug)]
pub enum TokenMintsPubkeysInput<'a> {
    HttpParam(Option<&'a str>),
    WsList(&'a [String]),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TokenMintsInputError {
    EmptyPubkey,
    InvalidPubkey { value: String },
    TooManyPubkeys { max: usize },
    PubkeysParamTooLong { max: usize },
}

impl TokenMintsInputError {
    pub fn reason(&self) -> String {
        match self {
            TokenMintsInputError::EmptyPubkey => "empty pubkey".to_string(),
            TokenMintsInputError::InvalidPubkey { value } => {
                format!("invalid pubkey: {value}")
            }
            TokenMintsInputError::TooManyPubkeys { max } => {
                format!("too many pubkeys; max {max}")
            }
            TokenMintsInputError::PubkeysParamTooLong { max } => {
                format!("pubkeys parameter too long; max {max} bytes")
            }
        }
    }
}

pub fn parse_pubkeys_filter(
    input: TokenMintsPubkeysInput<'_>,
    limits: &TokenMintsConfig,
) -> Result<Option<TokenMintsFilter>, TokenMintsInputError> {
    let raw_items = match input {
        TokenMintsPubkeysInput::HttpParam(None) => return Ok(None),
        TokenMintsPubkeysInput::HttpParam(Some(raw)) => {
            if raw.len() > limits.max_pubkeys_param_len {
                return Err(TokenMintsInputError::PubkeysParamTooLong {
                    max: limits.max_pubkeys_param_len,
                });
            }
            raw.split(',').map(str::to_string).collect::<Vec<_>>()
        }
        TokenMintsPubkeysInput::WsList(items) => {
            if items.is_empty() {
                return Ok(None);
            }
            let total_len = items
                .iter()
                .map(String::len)
                .sum::<usize>()
                .saturating_add(items.len().saturating_sub(1));
            if total_len > limits.max_pubkeys_param_len {
                return Err(TokenMintsInputError::PubkeysParamTooLong {
                    max: limits.max_pubkeys_param_len,
                });
            }
            items.to_vec()
        }
    };

    if raw_items.is_empty() {
        return Ok(None);
    }

    let mut pubkeys = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for raw in raw_items {
        let item = raw.trim();
        if item.is_empty() {
            return Err(TokenMintsInputError::EmptyPubkey);
        }
        let pubkey = Pubkey::from_str(item).map_err(|_| TokenMintsInputError::InvalidPubkey {
            value: item.to_string(),
        })?;
        let normalized = pubkey.to_string();
        if seen.insert(normalized.clone()) {
            pubkeys.push(normalized);
        }
    }

    if pubkeys.len() > limits.max_pubkeys {
        return Err(TokenMintsInputError::TooManyPubkeys {
            max: limits.max_pubkeys,
        });
    }

    Ok(Some(TokenMintsFilter { pubkeys }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn limits(max_pubkeys: usize, max_len: usize) -> TokenMintsConfig {
        TokenMintsConfig {
            enabled: true,
            refresh_secs: 60,
            max_pubkeys,
            max_pubkeys_param_len: max_len,
        }
    }

    fn key() -> String {
        Pubkey::new_unique().to_string()
    }

    #[test]
    fn parse_pubkeys_filter_normalizes_and_dedups_http_input() {
        let first = key();
        let second = key();
        let raw = format!("{first},{second},{first}");

        let filter = parse_pubkeys_filter(
            TokenMintsPubkeysInput::HttpParam(Some(&raw)),
            &limits(10, 1024),
        )
        .unwrap()
        .unwrap();

        assert_eq!(filter.pubkeys, vec![first, second]);
    }

    #[test]
    fn parse_pubkeys_filter_accepts_empty_missing_inputs_as_no_filter() {
        assert_eq!(
            parse_pubkeys_filter(TokenMintsPubkeysInput::HttpParam(None), &limits(10, 1024))
                .unwrap(),
            None
        );
        assert_eq!(
            parse_pubkeys_filter(TokenMintsPubkeysInput::WsList(&[]), &limits(10, 1024)).unwrap(),
            None
        );
    }

    #[test]
    fn parse_pubkeys_filter_rejects_bad_inputs() {
        assert_eq!(
            parse_pubkeys_filter(
                TokenMintsPubkeysInput::HttpParam(Some("")),
                &limits(10, 1024)
            )
            .unwrap_err(),
            TokenMintsInputError::EmptyPubkey
        );
        assert_eq!(
            parse_pubkeys_filter(
                TokenMintsPubkeysInput::HttpParam(Some("not-a-pubkey")),
                &limits(10, 1024)
            )
            .unwrap_err(),
            TokenMintsInputError::InvalidPubkey {
                value: "not-a-pubkey".to_string()
            }
        );
        let one = key();
        let two = key();
        assert_eq!(
            parse_pubkeys_filter(
                TokenMintsPubkeysInput::WsList(&[one, two]),
                &limits(1, 1024)
            )
            .unwrap_err(),
            TokenMintsInputError::TooManyPubkeys { max: 1 }
        );
        assert_eq!(
            parse_pubkeys_filter(
                TokenMintsPubkeysInput::HttpParam(Some(&key())),
                &limits(10, 3)
            )
            .unwrap_err(),
            TokenMintsInputError::PubkeysParamTooLong { max: 3 }
        );
    }

    #[test]
    fn payload_uses_filter_order_and_data_flag() {
        let first = key();
        let second = key();
        let mut cache = TokenMintsCache::default();
        cache.token_mints.insert(
            first.clone(),
            TokenMintRecord {
                pubkey: first.clone(),
                program_id: "program1".to_string(),
                decimals: 9,
                supply: "100".to_string(),
                data_base64: "AAAA".to_string(),
            },
        );
        cache.token_mints.insert(
            second.clone(),
            TokenMintRecord {
                pubkey: second.clone(),
                program_id: "program2".to_string(),
                decimals: 6,
                supply: "200".to_string(),
                data_base64: "BBBB".to_string(),
            },
        );

        let filter = TokenMintsFilter {
            pubkeys: vec![second.clone(), first.clone()],
        };
        let payload = cache.to_payload(Some(&filter), false);

        assert_eq!(payload.token_mints.len(), 2);
        assert_eq!(payload.token_mints[0].pubkey, second);
        assert_eq!(payload.token_mints[0].data, None);
        assert_eq!(payload.token_mints[0].is_last_snapshot, Some(false));
        assert_eq!(payload.token_mints[1].pubkey, first);
        assert_eq!(payload.token_mints[1].is_last_snapshot, Some(true));

        let with_data = cache.to_payload(Some(&filter), true);
        assert_eq!(with_data.token_mints[0].data.as_deref(), Some("BBBB"));
    }

    #[test]
    fn handle_keeps_ready_state_on_refresh_failure() {
        let pubkey = key();
        let mut cache = TokenMintsCache::default();
        cache.token_mints.insert(
            pubkey.clone(),
            TokenMintRecord {
                pubkey,
                program_id: "program1".to_string(),
                decimals: 9,
                supply: "100".to_string(),
                data_base64: "AAAA".to_string(),
            },
        );
        let handle = TokenMintsHandle::new(TokenMintsCacheState::Ready(cache.clone()));

        handle.note_refresh_failure();

        assert_eq!(&*handle.state(), &TokenMintsCacheState::Ready(cache));
    }

    #[test]
    fn handle_records_initializing_reason_on_first_refresh_failure() {
        let handle = TokenMintsHandle::new(TokenMintsCacheState::Initializing {
            reason: WAITING_FOR_FIRST_REFRESH_REASON.to_string(),
        });

        handle.note_refresh_failure();

        assert_eq!(
            &*handle.state(),
            &TokenMintsCacheState::Initializing {
                reason: REFRESH_FAILED_REASON.to_string()
            }
        );
    }
}
