//! GLV account body source.

use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;

use arc_swap::ArcSwap;
use eyre::{Result, WrapErr};
use gmsol_sdk::core::glv::GlvMarketFlag;
use gmsol_sdk::programs::gmsol_store::accounts::Glv;
use gmsol_sdk::solana_utils::solana_client::nonblocking::rpc_client::RpcClient;
use gmsol_sdk::solana_utils::solana_sdk::{account::Account, pubkey::Pubkey};
use gmsol_sdk::utils::base64::encode_base64;
use gmsol_sdk::utils::zero_copy::try_deserialize_zero_copy;
use serde::{Deserialize, Serialize};
use tokio::time::sleep;

use crate::config::Config;
use crate::sources::rpc_markets::{get_accounts_chunked, GlvRef};
use crate::state::AppState;

const DISABLED_REASON: &str = "glv accounts disabled";
const RUNTIME_DISABLED_REASON: &str = "glv accounts runtime switch is disabled";
const EMPTY_RPC_ENDPOINT_REASON: &str = "rpc.endpoint is empty; glv accounts unavailable";
const INVALID_STORE_REASON: &str = "rpc.store is empty or invalid; glv accounts unavailable";
const WAITING_FOR_UNIVERSE_REASON: &str = "waiting for glv account universe";
const WAITING_FOR_FIRST_REFRESH_REASON: &str = "waiting for first glv accounts refresh";
const REFRESH_FAILED_REASON: &str = "glv accounts refresh failed; retrying";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlvsPayload {
    pub glvs: Vec<GlvAccountRecordPayload>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlvAccountRecordPayload {
    pub glv: String,
    pub data: String,
    pub config: GlvConfigPayload,
    pub markets: Vec<GlvMarketPayload>,
    pub is_snapshot: bool,
    pub is_last_snapshot: bool,
    pub has_last_snapshot: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlvConfigPayload {
    pub glv_token: String,
    pub long_token: String,
    pub short_token: String,
    pub min_tokens_for_first_deposit: String,
    pub shift_last_executed_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlvMarketPayload {
    pub market_token: String,
    pub max_amount: String,
    pub max_value: String,
    pub flags: GlvMarketFlagsPayload,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlvMarketFlagsPayload {
    pub is_deposit_allowed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum GlvAccountsCacheState {
    Disabled { reason: String },
    Initializing { reason: String },
    Ready(GlvAccountsCache),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GlvAccountsCache {
    pub payload: GlvsPayload,
    pub ws_frame: Arc<str>,
}

#[derive(Clone)]
pub struct GlvAccountsHandle {
    inner: Arc<ArcSwap<GlvAccountsCacheState>>,
}

impl GlvAccountsHandle {
    pub fn new(initial_state: GlvAccountsCacheState) -> Self {
        Self {
            inner: Arc::new(ArcSwap::from_pointee(initial_state)),
        }
    }

    pub fn disabled(reason: impl Into<String>) -> Self {
        Self::new(GlvAccountsCacheState::Disabled {
            reason: reason.into(),
        })
    }

    pub fn from_config(config: &Config) -> Self {
        Self::new(initial_cache_state(config))
    }

    pub fn state(&self) -> Arc<GlvAccountsCacheState> {
        self.inner.load_full()
    }

    pub fn set_disabled(&self, reason: impl Into<String>) {
        self.inner.store(Arc::new(GlvAccountsCacheState::Disabled {
            reason: reason.into(),
        }));
    }

    pub fn set_initializing(&self, reason: impl Into<String>) {
        self.inner
            .store(Arc::new(GlvAccountsCacheState::Initializing {
                reason: reason.into(),
            }));
    }

    pub fn note_waiting_for_universe(&self) {
        self.note_refresh_error(WAITING_FOR_UNIVERSE_REASON);
    }

    pub fn note_refresh_failure(&self) {
        self.note_refresh_error(REFRESH_FAILED_REASON);
    }

    pub fn update_ready(&self, payload: GlvsPayload, ws_frame: Arc<str>) -> Option<Arc<str>> {
        let current = self.inner.load_full();
        if let GlvAccountsCacheState::Ready(cache) = &*current {
            if cache.ws_frame.as_ref() == ws_frame.as_ref() {
                return None;
            }
        }

        self.inner
            .store(Arc::new(GlvAccountsCacheState::Ready(GlvAccountsCache {
                payload,
                ws_frame: ws_frame.clone(),
            })));
        Some(ws_frame)
    }

    fn note_refresh_error(&self, reason: impl Into<String>) {
        let reason = reason.into();
        if !matches!(&*self.state(), GlvAccountsCacheState::Ready(_)) {
            self.set_initializing(reason);
        }
    }
}

impl Default for GlvAccountsHandle {
    fn default() -> Self {
        Self::disabled(DISABLED_REASON)
    }
}

fn initial_cache_state(config: &Config) -> GlvAccountsCacheState {
    if !config.glv_accounts.enabled {
        return GlvAccountsCacheState::Disabled {
            reason: RUNTIME_DISABLED_REASON.to_string(),
        };
    }
    if config.rpc.endpoint.is_empty() {
        return GlvAccountsCacheState::Disabled {
            reason: EMPTY_RPC_ENDPOINT_REASON.to_string(),
        };
    }
    if Pubkey::from_str(&config.rpc.store).is_err() {
        return GlvAccountsCacheState::Disabled {
            reason: INVALID_STORE_REASON.to_string(),
        };
    }
    GlvAccountsCacheState::Initializing {
        reason: WAITING_FOR_FIRST_REFRESH_REASON.to_string(),
    }
}

pub async fn run_glv_accounts_refresh(state: AppState) {
    if !state.config.glv_accounts.enabled {
        state.glv_accounts.set_disabled(RUNTIME_DISABLED_REASON);
        tracing::info!("glv accounts refresh disabled");
        return;
    }

    let endpoint = state.config.rpc.endpoint.clone();
    if endpoint.is_empty() {
        state.glv_accounts.set_disabled(EMPTY_RPC_ENDPOINT_REASON);
        tracing::warn!("glv accounts refresh disabled: rpc.endpoint is empty");
        return;
    }

    if let Err(err) = Pubkey::from_str(&state.config.rpc.store) {
        state.glv_accounts.set_disabled(INVALID_STORE_REASON);
        tracing::warn!(error = %err, store = %state.config.rpc.store, "glv accounts refresh disabled: invalid store pubkey");
        return;
    }

    let rpc = RpcClient::new(endpoint);
    let refresh_secs = state.config.glv_accounts.refresh_secs.max(1);
    let period = Duration::from_secs(refresh_secs);
    let wait_for_universe_period = Duration::from_secs(1);
    state
        .glv_accounts
        .set_initializing(WAITING_FOR_FIRST_REFRESH_REASON);

    tracing::info!(refresh_secs, "glv accounts refresh started");

    loop {
        let refs = state.glv_refs.load_full();
        let Some(refs) = refs.as_ref() else {
            state.glv_accounts.note_waiting_for_universe();
            sleep(wait_for_universe_period).await;
            continue;
        };

        match fetch_glv_accounts(&rpc, refs).await {
            Ok(fetched) if fetched.complete => {
                let Some(payload) = fetched.payload else {
                    state.glv_accounts.note_refresh_failure();
                    tracing::warn!("glv accounts refresh completed without a payload");
                    sleep(period).await;
                    continue;
                };
                let frame = glvs_ws_frame(&payload);
                let glv_count = payload.glvs.len();
                if let Some(frame) = state.glv_accounts.update_ready(payload, frame) {
                    let _ = state.ws.glvs.send(frame);
                    tracing::debug!(glv_count, "glv accounts refresh changed; broadcasted");
                } else {
                    tracing::debug!(glv_count, "glv accounts refresh unchanged");
                }
            }
            Ok(_) => {
                state.glv_accounts.note_refresh_failure();
                tracing::warn!(
                    "glv accounts refresh incomplete; keeping last good payload when available"
                );
            }
            Err(err) => {
                state.glv_accounts.note_refresh_failure();
                tracing::warn!(error = %err, "glv accounts refresh failed; keeping last good payload when available");
            }
        }

        sleep(period).await;
    }
}

pub async fn fetch_glv_accounts(rpc: &RpcClient, refs: &[GlvRef]) -> Result<FetchedGlvAccounts> {
    if refs.is_empty() {
        return Ok(FetchedGlvAccounts {
            payload: Some(GlvsPayload { glvs: Vec::new() }),
            complete: true,
        });
    }

    let keys: Vec<Pubkey> = refs.iter().map(|r| r.glv_pda).collect();
    let accounts = get_accounts_chunked(rpc, &keys).await?;
    Ok(assemble_glv_accounts(refs, &accounts))
}

pub struct FetchedGlvAccounts {
    pub payload: Option<GlvsPayload>,
    pub complete: bool,
}

pub(crate) fn glvs_ws_frame(payload: &GlvsPayload) -> Arc<str> {
    crate::ws::envelope_json(
        crate::ws_protocol::Topic::Glvs {
            with_snapshot: true,
        }
        .type_str(),
        payload,
    )
}

pub fn assemble_glv_accounts(refs: &[GlvRef], accounts: &[Option<Account>]) -> FetchedGlvAccounts {
    if accounts.len() < refs.len() {
        tracing::debug!(
            expected = refs.len(),
            actual = accounts.len(),
            "glv accounts assembly incomplete: account slice too short"
        );
        return FetchedGlvAccounts {
            payload: None,
            complete: false,
        };
    }

    let mut glvs = Vec::with_capacity(refs.len());
    for (glv_ref, account) in refs.iter().zip(accounts.iter()) {
        let Some(account) = account else {
            tracing::debug!(pda = %glv_ref.glv_pda, "glv account missing");
            return FetchedGlvAccounts {
                payload: None,
                complete: false,
            };
        };
        let record = match build_glv_record(glv_ref, account) {
            Ok(record) => record,
            Err(err) => {
                tracing::debug!(error = %err, pda = %glv_ref.glv_pda, "glv account decode failed");
                return FetchedGlvAccounts {
                    payload: None,
                    complete: false,
                };
            }
        };
        glvs.push(record);
    }

    glvs.sort_by(|a, b| a.glv.cmp(&b.glv));
    apply_snapshot_flags(&mut glvs);
    FetchedGlvAccounts {
        payload: Some(GlvsPayload { glvs }),
        complete: true,
    }
}

fn build_glv_record(glv_ref: &GlvRef, account: &Account) -> Result<GlvAccountRecordPayload> {
    let glv = try_deserialize_zero_copy::<Glv>(&account.data)
        .wrap_err("glv account deserialize failed")?
        .into_inner();
    let mut markets: Vec<_> = glv
        .market_tokens()
        .map(|market_token| {
            let config = glv
                .market_config(&market_token)
                .ok_or_else(|| eyre::eyre!("glv market config missing"))?;
            Ok(GlvMarketPayload {
                market_token: market_token.to_string(),
                max_amount: config.max_amount.to_string(),
                max_value: config.max_value.to_string(),
                flags: GlvMarketFlagsPayload {
                    is_deposit_allowed: config.flags.get_flag(GlvMarketFlag::IsDepositAllowed),
                },
            })
        })
        .collect::<Result<Vec<_>>>()?;
    markets.sort_by(|a, b| a.market_token.cmp(&b.market_token));

    Ok(GlvAccountRecordPayload {
        glv: glv_ref.glv_pda.to_string(),
        data: encode_base64(&account.data),
        config: GlvConfigPayload {
            glv_token: glv.glv_token.to_string(),
            long_token: glv.long_token.to_string(),
            short_token: glv.short_token.to_string(),
            min_tokens_for_first_deposit: glv.min_tokens_for_first_deposit.to_string(),
            shift_last_executed_at: glv.shift_last_executed_at.to_string(),
        },
        markets,
        is_snapshot: true,
        is_last_snapshot: false,
        has_last_snapshot: true,
    })
}

fn apply_snapshot_flags(glvs: &mut [GlvAccountRecordPayload]) {
    if let Some((last, rest)) = glvs.split_last_mut() {
        for record in rest {
            record.is_snapshot = true;
            record.is_last_snapshot = false;
            record.has_last_snapshot = true;
        }
        last.is_snapshot = true;
        last.is_last_snapshot = true;
        last.has_last_snapshot = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gmsol_sdk::programs::anchor_lang::Discriminator;
    use gmsol_sdk::programs::bytemuck::{bytes_of, Zeroable};

    fn glv_account() -> Account {
        let glv = Glv::zeroed();
        Account {
            data: [<Glv as Discriminator>::DISCRIMINATOR, bytes_of(&glv)].concat(),
            ..Default::default()
        }
    }

    fn glv_ref(glv_pda: Pubkey) -> GlvRef {
        GlvRef {
            glv_pda,
            glv_token_mint: Pubkey::new_unique(),
        }
    }

    #[test]
    fn assemble_empty_refs_returns_ready_empty_payload() {
        let fetched = assemble_glv_accounts(&[], &[]);

        assert!(fetched.complete);
        assert_eq!(fetched.payload.unwrap(), GlvsPayload { glvs: Vec::new() });
    }

    #[test]
    fn assemble_single_glv_includes_raw_data_and_snapshot_flags() {
        let pda = Pubkey::new_unique();
        let account = glv_account();
        let expected_data = encode_base64(&account.data);

        let fetched = assemble_glv_accounts(&[glv_ref(pda)], &[Some(account)]);

        assert!(fetched.complete);
        let payload = fetched.payload.unwrap();
        assert_eq!(payload.glvs.len(), 1);
        let record = &payload.glvs[0];
        assert_eq!(record.glv, pda.to_string());
        assert_eq!(record.data, expected_data);
        assert_eq!(record.config.min_tokens_for_first_deposit, "0");
        assert_eq!(record.config.shift_last_executed_at, "0");
        assert!(record.markets.is_empty());
        assert!(record.is_snapshot);
        assert!(record.is_last_snapshot);
        assert!(record.has_last_snapshot);
    }

    #[test]
    fn assemble_missing_or_short_accounts_is_incomplete() {
        let pda = Pubkey::new_unique();

        let short = assemble_glv_accounts(&[glv_ref(pda)], &[]);
        assert!(!short.complete);
        assert!(short.payload.is_none());

        let missing = assemble_glv_accounts(&[glv_ref(pda)], &[None]);
        assert!(!missing.complete);
        assert!(missing.payload.is_none());
    }

    #[test]
    fn update_ready_broadcasts_first_and_changed_frames_only() {
        let handle = GlvAccountsHandle::new(GlvAccountsCacheState::Initializing {
            reason: "waiting".to_string(),
        });
        let empty = GlvsPayload { glvs: Vec::new() };
        let empty_frame = glvs_ws_frame(&empty);

        let first = handle.update_ready(empty.clone(), empty_frame.clone());
        assert_eq!(first.as_deref(), Some(empty_frame.as_ref()));

        let same_frame = glvs_ws_frame(&empty);
        let unchanged = handle.update_ready(empty.clone(), same_frame);
        assert!(unchanged.is_none());
        match &*handle.state() {
            GlvAccountsCacheState::Ready(cache) => {
                assert_eq!(cache.ws_frame.as_ref(), empty_frame.as_ref());
            }
            other => panic!("expected ready cache, got {other:?}"),
        }

        let changed = GlvsPayload {
            glvs: vec![GlvAccountRecordPayload {
                glv: Pubkey::new_unique().to_string(),
                data: String::new(),
                config: GlvConfigPayload {
                    glv_token: Pubkey::new_unique().to_string(),
                    long_token: Pubkey::new_unique().to_string(),
                    short_token: Pubkey::new_unique().to_string(),
                    min_tokens_for_first_deposit: "0".to_string(),
                    shift_last_executed_at: "0".to_string(),
                },
                markets: Vec::new(),
                is_snapshot: true,
                is_last_snapshot: true,
                has_last_snapshot: true,
            }],
        };
        let changed_frame = glvs_ws_frame(&changed);
        assert_eq!(
            handle
                .update_ready(changed, changed_frame.clone())
                .as_deref(),
            Some(changed_frame.as_ref())
        );
    }

    #[test]
    fn glvs_ws_frame_uses_stable_glvs_envelope() {
        let frame = glvs_ws_frame(&GlvsPayload { glvs: Vec::new() });
        let value: serde_json::Value = serde_json::from_str(&frame).unwrap();
        assert_eq!(value["type"], "glvs");
        assert_eq!(value["payload"], serde_json::json!({"glvs":[]}));
    }
}
