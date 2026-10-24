//! On-chain TokenMap fetch (read-only RPC) deriving each token's symbol, decimals, and mint to drive the dynamic token table.

use std::str::FromStr;

use eyre::Result;
use gmsol_sdk::client::ClientOptions;
use gmsol_sdk::solana_utils::cluster::Cluster;
use gmsol_sdk::solana_utils::signer::shared_signer;
use gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey;
use gmsol_sdk::solana_utils::solana_sdk::signature::Keypair;
use gmsol_sdk::Client;

use crate::tokens::OnchainToken;

/// Fetch all tokens from the store's authorized TokenMap, `Err` on RPC/decode failure.
pub async fn fetch_onchain_tokens(rpc_url: &str, store: &str) -> Result<Vec<OnchainToken>> {
    let cluster = Cluster::from_str(rpc_url)?;
    // Read-only: a random ephemeral signer is sufficient (never signs a txn).
    let payer = shared_signer(Keypair::new());
    let client = Client::new_with_options(cluster, payer, ClientOptions::default())?;

    let store = Pubkey::from_str(store)?;
    let token_map = client.authorized_token_map(&store).await?;

    let mut out = Vec::new();
    for (mint, config) in token_map.iter() {
        let symbol = match config.name() {
            Ok(s) if !s.is_empty() => s.to_string(),
            _ => continue,
        };
        out.push(OnchainToken {
            mint: mint.to_string(),
            symbol,
            decimals: config.token_decimals() as i8,
        });
    }

    if out.is_empty() {
        eyre::bail!("on-chain token map returned no tokens");
    }
    Ok(out)
}

/// Read each token's Chainlink Data Streams feed id from the store's authorized TokenMap keyed by mint, `Err` on RPC/decode failure.
pub async fn fetch_chainlink_feeds(
    rpc_url: &str,
    store: &str,
) -> Result<std::collections::HashMap<String, String>> {
    use gmsol_sdk::core::oracle::PriceProviderKind;

    let cluster = Cluster::from_str(rpc_url)?;
    let payer = shared_signer(Keypair::new());
    let client = Client::new_with_options(cluster, payer, ClientOptions::default())?;

    let store = Pubkey::from_str(store)?;
    let token_map = client.authorized_token_map(&store).await?;

    let mut feeds = std::collections::HashMap::new();
    for (mint, config) in token_map.iter() {
        // `get_feed` returns the 32-byte feed pubkey whose lowercase hex is the feed id; no-feed tokens return Err and are skipped.
        if let Ok(feed) = config.get_feed(&PriceProviderKind::ChainlinkDataStreams) {
            feeds.insert(
                mint.to_string(),
                format!("0x{}", hex::encode(feed.to_bytes())),
            );
        }
    }
    Ok(feeds)
}
