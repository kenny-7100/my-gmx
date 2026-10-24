//! Store raw balances source.

use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;

use arc_swap::ArcSwap;
use eyre::{Result, WrapErr};
use serde::Serialize;

use anchor_spl::{
    token::spl_token,
    token_2022::spl_token_2022::{self, extension::StateWithExtensions},
};
use gmsol_sdk::client::accounts::get_token_accounts_by_owner_with_context;
use gmsol_sdk::solana_utils::solana_client::{
    nonblocking::rpc_client::RpcClient, rpc_config::RpcAccountInfoConfig,
    rpc_request::TokenAccountsFilter, rpc_response::RpcKeyedAccount,
};
use gmsol_sdk::solana_utils::solana_sdk::{account::Account, program_pack::Pack, pubkey::Pubkey};
use solana_account_decoder::UiAccountEncoding;
use tokio::time::{interval, MissedTickBehavior};

use crate::config::Config;
use crate::state::AppState;

const DISABLED_REASON: &str = "store balances disabled";
const RUNTIME_DISABLED_REASON: &str = "store balances runtime switch is disabled";
const EMPTY_RPC_ENDPOINT_REASON: &str = "rpc.endpoint is empty; store balances unavailable";
const INVALID_STORE_REASON: &str = "rpc.store is empty or invalid; store balances unavailable";
const WAITING_FOR_FIRST_REFRESH_REASON: &str = "waiting for first store balances refresh";
const REFRESH_FAILED_REASON: &str = "store balances refresh failed; retrying";

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreTokenBalance {
    pub mint: String,
    pub account: String,
    pub amount: String,
    pub program_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreBalancesPayload {
    pub store: String,
    pub sol_balance: String,
    pub token_balances: Vec<StoreTokenBalance>,
    pub is_snapshot: bool,
    pub is_last_snapshot: bool,
    pub has_last_snapshot: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StoreBalancesCacheState {
    Disabled { reason: String },
    Initializing { reason: String },
    Ready(StoreBalancesPayload),
}

#[derive(Clone)]
pub struct StoreBalancesHandle {
    inner: Arc<ArcSwap<StoreBalancesCacheState>>,
}

impl StoreBalancesHandle {
    pub fn new(initial_state: StoreBalancesCacheState) -> Self {
        Self {
            inner: Arc::new(ArcSwap::from_pointee(initial_state)),
        }
    }

    pub fn disabled(reason: impl Into<String>) -> Self {
        Self::new(StoreBalancesCacheState::Disabled {
            reason: reason.into(),
        })
    }

    pub fn from_config(config: &Config) -> Self {
        Self::new(initial_cache_state(config))
    }

    pub fn state(&self) -> Arc<StoreBalancesCacheState> {
        self.inner.load_full()
    }

    pub fn set_disabled(&self, reason: impl Into<String>) {
        self.inner
            .store(Arc::new(StoreBalancesCacheState::Disabled {
                reason: reason.into(),
            }));
    }

    pub fn set_initializing(&self, reason: impl Into<String>) {
        self.inner
            .store(Arc::new(StoreBalancesCacheState::Initializing {
                reason: reason.into(),
            }));
    }

    pub fn set_ready(&self, payload: StoreBalancesPayload) {
        self.inner
            .store(Arc::new(StoreBalancesCacheState::Ready(payload)));
    }

    pub fn note_refresh_failure(&self) {
        self.note_refresh_error(REFRESH_FAILED_REASON);
    }

    fn note_refresh_error(&self, reason: impl Into<String>) {
        let reason = reason.into();
        if !matches!(&*self.state(), StoreBalancesCacheState::Ready(_)) {
            self.set_initializing(reason);
        }
    }
}

impl Default for StoreBalancesHandle {
    fn default() -> Self {
        Self::disabled(DISABLED_REASON)
    }
}

fn initial_cache_state(config: &Config) -> StoreBalancesCacheState {
    if !config.store_balances.enabled {
        return StoreBalancesCacheState::Disabled {
            reason: RUNTIME_DISABLED_REASON.to_string(),
        };
    }
    if config.rpc.endpoint.is_empty() {
        return StoreBalancesCacheState::Disabled {
            reason: EMPTY_RPC_ENDPOINT_REASON.to_string(),
        };
    }
    if Pubkey::from_str(&config.rpc.store).is_err() {
        return StoreBalancesCacheState::Disabled {
            reason: INVALID_STORE_REASON.to_string(),
        };
    }
    StoreBalancesCacheState::Initializing {
        reason: WAITING_FOR_FIRST_REFRESH_REASON.to_string(),
    }
}

pub async fn run_store_balances_refresh(state: AppState) {
    if !state.config.store_balances.enabled {
        state.store_balances.set_disabled(RUNTIME_DISABLED_REASON);
        tracing::info!("store balances refresh disabled");
        return;
    }

    let endpoint = state.config.rpc.endpoint.clone();
    if endpoint.is_empty() {
        state.store_balances.set_disabled(EMPTY_RPC_ENDPOINT_REASON);
        tracing::warn!("store balances refresh disabled: rpc.endpoint is empty");
        return;
    }

    let store = match Pubkey::from_str(&state.config.rpc.store) {
        Ok(store) => store,
        Err(err) => {
            state.store_balances.set_disabled(INVALID_STORE_REASON);
            tracing::warn!(error = %err, store = %state.config.rpc.store, "store balances refresh disabled: invalid store pubkey");
            return;
        }
    };

    let rpc = RpcClient::new(endpoint);
    let refresh_secs = state.config.store_balances.refresh_secs.max(1);
    let period = Duration::from_secs(refresh_secs);
    let mut ticker = interval(period);
    ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
    state
        .store_balances
        .set_initializing(WAITING_FOR_FIRST_REFRESH_REASON);

    tracing::info!(refresh_secs, store = %store, "store balances refresh started");
    ticker.tick().await; // Consume the immediate tick: refresh now, then wait one full period.

    loop {
        match fetch_store_balances(&rpc, &store).await {
            Ok(payload) => {
                let token_accounts = payload.token_balances.len();
                state.store_balances.set_ready(payload.clone());
                let _ = state.ws.store_balances.send(crate::ws::envelope_json(
                    crate::ws_protocol::Topic::StoreBalances.type_str(),
                    &payload,
                ));
                tracing::debug!(token_accounts, "store balances refresh succeeded");
            }
            Err(err) => {
                state.store_balances.note_refresh_failure();
                tracing::warn!(error = %err, "store balances refresh failed; keeping last good payload when available");
            }
        }
        ticker.tick().await;
    }
}

pub async fn fetch_store_balances(rpc: &RpcClient, store: &Pubkey) -> Result<StoreBalancesPayload> {
    let sol_balance = rpc
        .get_balance(store)
        .await
        .wrap_err("rpc get_balance failed")?;

    let mut token_balances = Vec::new();
    token_balances.extend(
        fetch_token_accounts_by_program(rpc, store, &anchor_spl::token::ID, TokenProgram::Spl)
            .await
            .wrap_err("rpc fetch SPL token accounts failed")?,
    );
    token_balances.extend(
        fetch_token_accounts_by_program(
            rpc,
            store,
            &anchor_spl::token_2022::ID,
            TokenProgram::Token2022,
        )
        .await
        .wrap_err("rpc fetch Token-2022 accounts failed")?,
    );
    token_balances.sort_by(|a, b| {
        a.account
            .cmp(&b.account)
            .then_with(|| a.program_id.cmp(&b.program_id))
            .then_with(|| a.mint.cmp(&b.mint))
    });

    Ok(StoreBalancesPayload {
        store: store.to_string(),
        sol_balance: sol_balance.to_string(),
        token_balances,
        is_snapshot: true,
        is_last_snapshot: true,
        has_last_snapshot: true,
    })
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TokenProgram {
    Spl,
    Token2022,
}

async fn fetch_token_accounts_by_program(
    rpc: &RpcClient,
    store: &Pubkey,
    program_id: &Pubkey,
    program: TokenProgram,
) -> Result<Vec<StoreTokenBalance>> {
    let keyed_accounts = get_token_accounts_by_owner_with_context(
        rpc,
        store,
        TokenAccountsFilter::ProgramId(*program_id),
        RpcAccountInfoConfig {
            encoding: Some(UiAccountEncoding::Base64),
            data_slice: None,
            ..Default::default()
        },
    )
    .await
    .map_err(eyre::Report::new)?
    .into_value();

    Ok(build_token_balances(
        store,
        program_id,
        program,
        keyed_accounts,
    ))
}

fn build_token_balances(
    store: &Pubkey,
    program_id: &Pubkey,
    program: TokenProgram,
    keyed_accounts: Vec<RpcKeyedAccount>,
) -> Vec<StoreTokenBalance> {
    let mut out = Vec::with_capacity(keyed_accounts.len());
    for keyed in keyed_accounts {
        let account_pubkey = keyed.pubkey;
        let Some(account): Option<Account> = keyed.account.decode() else {
            tracing::warn!(account = %account_pubkey, program_id = %program_id, "store balances: token account RPC data decode failed; skipping");
            continue;
        };
        let decoded = match program {
            TokenProgram::Spl => decode_spl_token_account(&account.data),
            TokenProgram::Token2022 => decode_token_2022_account(&account.data),
        };
        let Some((mint, owner, amount)) = decoded else {
            tracing::warn!(account = %account_pubkey, program_id = %program_id, "store balances: token account layout decode failed; skipping");
            continue;
        };
        if owner != *store {
            tracing::warn!(
                account = %account_pubkey,
                owner = %owner,
                expected_owner = %store,
                program_id = %program_id,
                "store balances: token account owner mismatch; skipping"
            );
            continue;
        }
        out.push(StoreTokenBalance {
            mint: mint.to_string(),
            account: account_pubkey,
            amount: amount.to_string(),
            program_id: program_id.to_string(),
        });
    }
    out
}

fn decode_spl_token_account(data: &[u8]) -> Option<(Pubkey, Pubkey, u64)> {
    let account = spl_token::state::Account::unpack(data).ok()?;
    Some((account.mint, account.owner, account.amount))
}

fn decode_token_2022_account(data: &[u8]) -> Option<(Pubkey, Pubkey, u64)> {
    let account = StateWithExtensions::<spl_token_2022::state::Account>::unpack(data)
        .ok()?
        .base;
    Some((account.mint, account.owner, account.amount))
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_spl::{token::spl_token::state::AccountState, token_2022::spl_token_2022};
    use figment::{providers::Serialized, Figment};
    use solana_account_decoder::{encode_ui_account, UiAccount, UiAccountData};

    fn spl_account_data(mint: Pubkey, owner: Pubkey, amount: u64) -> Vec<u8> {
        let account = spl_token::state::Account {
            mint,
            owner,
            amount,
            delegate: Default::default(),
            state: AccountState::Initialized,
            is_native: Default::default(),
            delegated_amount: 0,
            close_authority: Default::default(),
        };
        let mut data = vec![0; spl_token::state::Account::LEN];
        spl_token::state::Account::pack(account, &mut data).unwrap();
        data
    }

    fn token_2022_account_data(mint: Pubkey, owner: Pubkey, amount: u64) -> Vec<u8> {
        let account = spl_token_2022::state::Account {
            mint,
            owner,
            amount,
            delegate: Default::default(),
            state: spl_token_2022::state::AccountState::Initialized,
            is_native: Default::default(),
            delegated_amount: 0,
            close_authority: Default::default(),
        };
        let mut data = vec![0; spl_token_2022::state::Account::LEN];
        spl_token_2022::state::Account::pack(account, &mut data).unwrap();
        data
    }

    fn token_2022_account_data_with_immutable_owner_extension(
        mint: Pubkey,
        owner: Pubkey,
        amount: u64,
    ) -> Vec<u8> {
        use spl_token_2022::extension::{
            immutable_owner::ImmutableOwner, BaseStateWithExtensionsMut, ExtensionType,
            StateWithExtensionsMut,
        };

        let account = spl_token_2022::state::Account {
            mint,
            owner,
            amount,
            delegate: Default::default(),
            state: spl_token_2022::state::AccountState::Initialized,
            is_native: Default::default(),
            delegated_amount: 0,
            close_authority: Default::default(),
        };
        let len = ExtensionType::try_calculate_account_len::<spl_token_2022::state::Account>(&[
            ExtensionType::ImmutableOwner,
        ])
        .unwrap();
        let mut data = vec![0; len];
        {
            let mut account_state =
                StateWithExtensionsMut::<spl_token_2022::state::Account>::unpack_uninitialized(
                    &mut data,
                )
                .unwrap();
            account_state.base = account;
            account_state.pack_base();
            account_state.init_account_type().unwrap();
            account_state
                .init_extension::<ImmutableOwner>(true)
                .unwrap();
        }
        data
    }

    fn keyed_account(account_pubkey: Pubkey, program_id: Pubkey, data: Vec<u8>) -> RpcKeyedAccount {
        let account = Account {
            lamports: 0,
            data,
            owner: program_id,
            executable: false,
            rent_epoch: 0,
        };
        RpcKeyedAccount {
            pubkey: account_pubkey.to_string(),
            account: encode_ui_account(
                &account_pubkey,
                &account,
                UiAccountEncoding::Base64,
                None,
                None,
            ),
        }
    }

    fn undecodable_keyed_account(account_pubkey: Pubkey, program_id: Pubkey) -> RpcKeyedAccount {
        RpcKeyedAccount {
            pubkey: account_pubkey.to_string(),
            account: UiAccount {
                lamports: 0,
                data: UiAccountData::Binary("not base64".to_string(), UiAccountEncoding::Base64),
                owner: program_id.to_string(),
                executable: false,
                rent_epoch: 0,
                space: None,
            },
        }
    }

    #[test]
    fn decodes_spl_token_account_with_owner() {
        let mint = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        assert_eq!(
            decode_spl_token_account(&spl_account_data(mint, owner, 42)),
            Some((mint, owner, 42))
        );
    }

    #[test]
    fn decodes_token_2022_account_with_owner() {
        let mint = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        assert_eq!(
            decode_token_2022_account(&token_2022_account_data(mint, owner, 7)),
            Some((mint, owner, 7))
        );
    }

    #[test]
    fn decodes_token_2022_account_with_extension() {
        let mint = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        assert_eq!(
            decode_token_2022_account(&token_2022_account_data_with_immutable_owner_extension(
                mint, owner, 13,
            )),
            Some((mint, owner, 13))
        );
    }

    #[test]
    fn build_token_balances_preserves_per_account_rows_for_same_mint() {
        let store = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let account_a = Pubkey::new_unique();
        let account_b = Pubkey::new_unique();
        let balances = build_token_balances(
            &store,
            &anchor_spl::token::ID,
            TokenProgram::Spl,
            vec![
                keyed_account(
                    account_a,
                    anchor_spl::token::ID,
                    spl_account_data(mint, store, 11),
                ),
                keyed_account(
                    account_b,
                    anchor_spl::token::ID,
                    spl_account_data(mint, store, 22),
                ),
            ],
        );

        assert_eq!(balances.len(), 2);
        assert_eq!(balances[0].mint, mint.to_string());
        assert_eq!(balances[0].account, account_a.to_string());
        assert_eq!(balances[0].amount, "11");
        assert_eq!(balances[0].program_id, anchor_spl::token::ID.to_string());
        assert_eq!(balances[1].mint, mint.to_string());
        assert_eq!(balances[1].account, account_b.to_string());
        assert_eq!(balances[1].amount, "22");
        assert_eq!(balances[1].program_id, anchor_spl::token::ID.to_string());
    }

    #[test]
    fn build_token_balances_skips_owner_mismatch_and_bad_accounts() {
        let store = Pubkey::new_unique();
        let other_owner = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let valid_account = Pubkey::new_unique();
        let wrong_owner_account = Pubkey::new_unique();
        let bad_layout_account = Pubkey::new_unique();
        let bad_rpc_account = Pubkey::new_unique();
        let balances = build_token_balances(
            &store,
            &anchor_spl::token::ID,
            TokenProgram::Spl,
            vec![
                keyed_account(
                    wrong_owner_account,
                    anchor_spl::token::ID,
                    spl_account_data(mint, other_owner, 1),
                ),
                keyed_account(bad_layout_account, anchor_spl::token::ID, vec![1, 2, 3]),
                undecodable_keyed_account(bad_rpc_account, anchor_spl::token::ID),
                keyed_account(
                    valid_account,
                    anchor_spl::token::ID,
                    spl_account_data(mint, store, 99),
                ),
            ],
        );

        assert_eq!(
            balances,
            vec![StoreTokenBalance {
                mint: mint.to_string(),
                account: valid_account.to_string(),
                amount: "99".to_string(),
                program_id: anchor_spl::token::ID.to_string(),
            }]
        );
    }

    #[test]
    fn build_token_balances_writes_token_2022_program_id() {
        let store = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let account = Pubkey::new_unique();
        let balances = build_token_balances(
            &store,
            &anchor_spl::token_2022::ID,
            TokenProgram::Token2022,
            vec![keyed_account(
                account,
                anchor_spl::token_2022::ID,
                token_2022_account_data(mint, store, 77),
            )],
        );

        assert_eq!(
            balances,
            vec![StoreTokenBalance {
                mint: mint.to_string(),
                account: account.to_string(),
                amount: "77".to_string(),
                program_id: anchor_spl::token_2022::ID.to_string(),
            }]
        );
    }

    #[test]
    fn cache_keeps_ready_state_on_refresh_error() {
        let handle = StoreBalancesHandle::default();
        handle.set_ready(StoreBalancesPayload {
            store: Pubkey::new_unique().to_string(),
            sol_balance: "1".to_string(),
            token_balances: Vec::new(),
            is_snapshot: true,
            is_last_snapshot: true,
            has_last_snapshot: true,
        });

        handle.note_refresh_failure();

        assert!(matches!(
            &*handle.state(),
            StoreBalancesCacheState::Ready(_)
        ));
    }

    #[test]
    fn cache_records_stable_public_reason_on_first_refresh_failure() {
        let handle = StoreBalancesHandle::new(StoreBalancesCacheState::Initializing {
            reason: WAITING_FOR_FIRST_REFRESH_REASON.to_string(),
        });

        handle.note_refresh_failure();

        assert!(matches!(
            &*handle.state(),
            StoreBalancesCacheState::Initializing { reason }
                if reason == REFRESH_FAILED_REASON
        ));
    }

    #[test]
    fn initial_cache_state_follows_runtime_config() {
        let disabled_cfg = Config::from_figment(Figment::new()).unwrap();
        assert!(matches!(
            &*StoreBalancesHandle::from_config(&disabled_cfg).state(),
            StoreBalancesCacheState::Disabled { reason }
                if reason == RUNTIME_DISABLED_REASON
        ));

        let store = Pubkey::new_unique().to_string();
        let enabled_fig = Figment::new().merge(Serialized::defaults(serde_json::json!({
            "rpc": {
                "endpoint": "https://rpc.example.invalid",
                "store": store,
            },
            "store_balances": {
                "enabled": true,
            },
        })));
        let enabled_cfg = Config::from_figment(enabled_fig).unwrap();
        assert!(matches!(
            &*StoreBalancesHandle::from_config(&enabled_cfg).state(),
            StoreBalancesCacheState::Initializing { reason }
                if reason == WAITING_FOR_FIRST_REFRESH_REASON
        ));

        let empty_endpoint_fig = Figment::new().merge(Serialized::defaults(serde_json::json!({
            "rpc": {
                "endpoint": "",
                "store": Pubkey::new_unique().to_string(),
            },
            "store_balances": {
                "enabled": true,
            },
        })));
        let empty_endpoint_cfg = Config::from_figment(empty_endpoint_fig).unwrap();
        assert!(matches!(
            &*StoreBalancesHandle::from_config(&empty_endpoint_cfg).state(),
            StoreBalancesCacheState::Disabled { reason }
                if reason == EMPTY_RPC_ENDPOINT_REASON
        ));

        let invalid_store_fig = Figment::new().merge(Serialized::defaults(serde_json::json!({
            "rpc": {
                "endpoint": "https://rpc.example.invalid",
                "store": "not a pubkey",
            },
            "store_balances": {
                "enabled": true,
            },
        })));
        let invalid_store_cfg = Config::from_figment(invalid_store_fig).unwrap();
        assert!(matches!(
            &*StoreBalancesHandle::from_config(&invalid_store_cfg).state(),
            StoreBalancesCacheState::Disabled { reason }
                if reason == INVALID_STORE_REASON
        ));
    }

    #[test]
    fn payload_serializes_frontend_contract_fields() {
        let payload = StoreBalancesPayload {
            store: "store111".to_string(),
            sol_balance: "123".to_string(),
            token_balances: vec![StoreTokenBalance {
                mint: "mint111".to_string(),
                account: "account111".to_string(),
                amount: "456".to_string(),
                program_id: "program111".to_string(),
            }],
            is_snapshot: true,
            is_last_snapshot: true,
            has_last_snapshot: true,
        };

        let json = serde_json::to_value(payload).unwrap();
        assert_eq!(json["store"], "store111");
        assert_eq!(json["solBalance"], "123");
        assert_eq!(json["tokenBalances"][0]["mint"], "mint111");
        assert_eq!(json["tokenBalances"][0]["account"], "account111");
        assert_eq!(json["tokenBalances"][0]["amount"], "456");
        assert_eq!(json["tokenBalances"][0]["programId"], "program111");
        assert_eq!(json["isSnapshot"], true);
        assert_eq!(json["isLastSnapshot"], true);
        assert_eq!(json["hasLastSnapshot"], true);
    }
}
