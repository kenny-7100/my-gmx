//! GM/GLV token mint metadata RPC source.

use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;

use eyre::{bail, Result};
use gmsol_sdk::solana_utils::solana_client::nonblocking::rpc_client::RpcClient;
use gmsol_sdk::solana_utils::solana_sdk::{account::Account, pubkey::Pubkey};
use gmsol_sdk::utils::base64::encode_base64;
use tokio::time::{interval, MissedTickBehavior};

use crate::sources::rpc_markets::{get_accounts_chunked, parse_mint, MarketList};
use crate::state::AppState;
use crate::token_mints::{TokenMintRecord, TokenMintsCache};

const RUNTIME_DISABLED_REASON: &str = "token mints runtime switch is disabled";
const EMPTY_RPC_ENDPOINT_REASON: &str = "rpc.endpoint is empty; token mints unavailable";
const INVALID_STORE_REASON: &str = "rpc.store is empty or invalid; token mints unavailable";
const WAITING_FOR_FIRST_REFRESH_REASON: &str = "waiting for first token mints refresh";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TokenMintKind {
    Gm,
    Glv,
}

fn expected_owner(kind: TokenMintKind) -> Pubkey {
    match kind {
        TokenMintKind::Gm => anchor_spl::token::ID,
        TokenMintKind::Glv => anchor_spl::token_2022::ID,
    }
}

fn kind_label(kind: TokenMintKind) -> &'static str {
    match kind {
        TokenMintKind::Gm => "gm",
        TokenMintKind::Glv => "glv",
    }
}

fn build_mint_requests(list: &MarketList) -> Result<Vec<(Pubkey, TokenMintKind)>> {
    let mut requests = Vec::with_capacity(list.markets.len() + list.glvs.len());
    let mut seen = HashMap::<Pubkey, TokenMintKind>::new();

    for mint in list.markets.iter().map(|m| m.market_token_mint) {
        add_mint_request(mint, TokenMintKind::Gm, &mut requests, &mut seen)?;
    }
    for mint in list.glvs.iter().map(|g| g.glv_token_mint) {
        add_mint_request(mint, TokenMintKind::Glv, &mut requests, &mut seen)?;
    }

    Ok(requests)
}

fn add_mint_request(
    mint: Pubkey,
    kind: TokenMintKind,
    requests: &mut Vec<(Pubkey, TokenMintKind)>,
    seen: &mut HashMap<Pubkey, TokenMintKind>,
) -> Result<()> {
    match seen.get(&mint).copied() {
        None => {
            seen.insert(mint, kind);
            requests.push((mint, kind));
        }
        Some(existing) if existing == kind => {}
        Some(existing) => {
            bail!(
                "token mints: same mint discovered with conflicting source kind: {} first_kind {} second_kind {}",
                mint,
                kind_label(existing),
                kind_label(kind)
            );
        }
    }
    Ok(())
}

pub async fn fetch_token_mints(rpc: &RpcClient, list: &MarketList) -> Result<TokenMintsCache> {
    let requests = build_mint_requests(list)?;
    let keys: Vec<Pubkey> = requests.iter().map(|(pubkey, _)| *pubkey).collect();
    let accounts = get_accounts_chunked(rpc, &keys).await?;
    assemble_token_mints(&requests, &accounts)
}

pub async fn run_token_mints_refresh(state: AppState) {
    if !state.config.token_mints.enabled {
        state.token_mints.set_disabled(RUNTIME_DISABLED_REASON);
        tracing::info!("token mints refresh disabled");
        return;
    }

    let endpoint = state.config.rpc.endpoint.clone();
    if endpoint.is_empty() {
        state.token_mints.set_disabled(EMPTY_RPC_ENDPOINT_REASON);
        tracing::warn!("token mints refresh disabled: rpc.endpoint is empty");
        return;
    }

    if let Err(err) = Pubkey::from_str(&state.config.rpc.store) {
        state.token_mints.set_disabled(INVALID_STORE_REASON);
        tracing::warn!(error = %err, store = %state.config.rpc.store, "token mints refresh disabled: invalid store pubkey");
        return;
    }

    let rpc = RpcClient::new(endpoint);
    let refresh_secs = state.config.token_mints.refresh_secs.max(1);
    let timeout = Duration::from_secs(refresh_secs.clamp(10, 30));
    let mut ticker = interval(Duration::from_secs(refresh_secs));
    ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
    state
        .token_mints
        .set_initializing(WAITING_FOR_FIRST_REFRESH_REASON);

    tracing::info!(
        refresh_secs,
        timeout_secs = timeout.as_secs(),
        "token mints refresh started"
    );
    ticker.tick().await; // Consume the immediate tick: refresh now, then wait one full period.

    loop {
        let Some(list) = state.token_mints_market_list.load_full() else {
            tracing::debug!("token mints refresh waiting for market list discovery");
            ticker.tick().await;
            continue;
        };

        match tokio::time::timeout(timeout, fetch_token_mints(&rpc, list.as_ref())).await {
            Ok(Ok(cache)) => {
                let count = cache.token_mints.len();
                state.token_mints.set_ready(cache);
                state.ws.notify_token_mints_changed();
                tracing::debug!(count, "token mints refresh succeeded");
            }
            Ok(Err(err)) => {
                state.token_mints.note_refresh_failure();
                tracing::warn!(error = %err, "token mints refresh failed; keeping last good cache when available");
            }
            Err(_) => {
                state.token_mints.note_refresh_failure();
                tracing::warn!(
                    timeout_secs = timeout.as_secs(),
                    "token mints refresh timed out; keeping last good cache when available"
                );
            }
        }
        ticker.tick().await;
    }
}

fn assemble_token_mints(
    requests: &[(Pubkey, TokenMintKind)],
    accounts: &[Option<Account>],
) -> Result<TokenMintsCache> {
    if requests.is_empty() {
        bail!("token mints refresh has no mint requests");
    }
    if accounts.len() != requests.len() {
        bail!(
            "token mints refresh account count mismatch: requested {}, got {}",
            requests.len(),
            accounts.len()
        );
    }

    let mut token_mints = std::collections::BTreeMap::new();

    for ((pubkey, kind), account) in requests.iter().copied().zip(accounts) {
        let account = account.as_ref().ok_or_else(|| {
            eyre::eyre!(
                "token mints: {} mint account missing: {pubkey}",
                kind_label(kind)
            )
        })?;
        match parse_token_mint_record(pubkey, kind, account) {
            Some(record) => {
                token_mints.insert(record.pubkey.clone(), record);
            }
            None => {
                bail!(
                    "token mints: {} mint account owner or data invalid: {} owner {}",
                    kind_label(kind),
                    pubkey,
                    account.owner
                );
            }
        }
    }

    Ok(TokenMintsCache { token_mints })
}

fn parse_token_mint_record(
    pubkey: Pubkey,
    kind: TokenMintKind,
    account: &Account,
) -> Option<TokenMintRecord> {
    if account.owner != expected_owner(kind) {
        return None;
    }
    let (supply, decimals) = parse_mint(&account.data)?;
    Some(TokenMintRecord {
        pubkey: pubkey.to_string(),
        program_id: account.owner.to_string(),
        decimals,
        supply: supply.to_string(),
        data_base64: encode_base64(&account.data),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sources::rpc_markets::{GlvRef, MarketRef};

    fn mint_account(owner: Pubkey, supply: u64, decimals: u8) -> Account {
        let mut data = vec![0u8; 82];
        data[0] = 1;
        data[36..44].copy_from_slice(&supply.to_le_bytes());
        data[44] = decimals;
        Account {
            owner,
            data,
            ..Default::default()
        }
    }

    #[test]
    fn parse_token_mint_record_requires_expected_owner() {
        let pubkey = Pubkey::new_unique();
        let account = mint_account(anchor_spl::token::ID, 1_000, 9);

        let record = parse_token_mint_record(pubkey, TokenMintKind::Gm, &account).unwrap();
        assert_eq!(record.pubkey, pubkey.to_string());
        assert_eq!(record.program_id, anchor_spl::token::ID.to_string());
        assert_eq!(record.supply, "1000");
        assert_eq!(record.decimals, 9);
        assert!(parse_token_mint_record(pubkey, TokenMintKind::Glv, &account).is_none());
    }

    #[test]
    fn build_mint_requests_dedups_same_kind() {
        let gm = Pubkey::new_unique();
        let glv = Pubkey::new_unique();
        let list = MarketList {
            markets: vec![
                MarketRef {
                    market_pda: Pubkey::new_unique(),
                    market_token_mint: gm,
                },
                MarketRef {
                    market_pda: Pubkey::new_unique(),
                    market_token_mint: gm,
                },
            ],
            glvs: vec![GlvRef {
                glv_pda: Pubkey::new_unique(),
                glv_token_mint: glv,
            }],
        };

        let requests = build_mint_requests(&list).unwrap();

        assert_eq!(
            requests,
            vec![(gm, TokenMintKind::Gm), (glv, TokenMintKind::Glv)]
        );
    }

    #[test]
    fn build_mint_requests_fails_on_conflicting_kind() {
        let conflict = Pubkey::new_unique();
        let list = MarketList {
            markets: vec![MarketRef {
                market_pda: Pubkey::new_unique(),
                market_token_mint: conflict,
            }],
            glvs: vec![GlvRef {
                glv_pda: Pubkey::new_unique(),
                glv_token_mint: conflict,
            }],
        };

        let err = build_mint_requests(&list).unwrap_err();

        assert!(err.to_string().contains("conflicting source kind"));
    }

    #[test]
    fn assemble_token_mints_fails_when_input_is_empty() {
        let err = assemble_token_mints(&[], &[]).unwrap_err();

        assert!(err.to_string().contains("no mint requests"));
    }

    #[test]
    fn assemble_token_mints_fails_when_account_count_mismatches() {
        let pubkey = Pubkey::new_unique();
        let requests = vec![(pubkey, TokenMintKind::Gm)];
        let accounts = Vec::new();

        let err = assemble_token_mints(&requests, &accounts).unwrap_err();

        assert!(err.to_string().contains("account count mismatch"));
    }

    #[test]
    fn assemble_token_mints_fails_when_any_account_is_missing() {
        let missing = Pubkey::new_unique();
        let valid = Pubkey::new_unique();
        let requests = vec![(missing, TokenMintKind::Gm), (valid, TokenMintKind::Gm)];
        let accounts = vec![None, Some(mint_account(anchor_spl::token::ID, 1_000, 9))];

        let err = assemble_token_mints(&requests, &accounts).unwrap_err();

        assert!(err.to_string().contains("mint account missing"));
    }

    #[test]
    fn assemble_token_mints_fails_when_any_record_is_invalid() {
        let pubkey = Pubkey::new_unique();
        let wrong_owner = Pubkey::new_unique();
        let valid = Pubkey::new_unique();
        let requests = vec![(valid, TokenMintKind::Gm), (pubkey, TokenMintKind::Gm)];
        let accounts = vec![
            Some(mint_account(anchor_spl::token::ID, 1_000, 9)),
            Some(mint_account(wrong_owner, 1_000, 9)),
        ];

        let err = assemble_token_mints(&requests, &accounts).unwrap_err();

        assert!(err.to_string().contains("owner or data invalid"));
    }
}
