//! On-chain market + GLV fetch via `gmsol-sdk` RPC using a read-only ephemeral signer.

use std::str::FromStr;
use std::sync::Arc;

use eyre::{Result, WrapErr};
use gmsol_keeper_client::FetchedMarket;
use gmsol_sdk::client::ClientOptions;
use gmsol_sdk::programs::bytemuck::bytes_of;
use gmsol_sdk::programs::gmsol_store::accounts::{Glv, Market};
use gmsol_sdk::solana_utils::cluster::Cluster;
use gmsol_sdk::solana_utils::signer::shared_signer;
use gmsol_sdk::solana_utils::solana_client::nonblocking::rpc_client::RpcClient;
use gmsol_sdk::solana_utils::solana_sdk::account::Account;
use gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey;
use gmsol_sdk::solana_utils::solana_sdk::signature::Keypair;
use gmsol_sdk::utils::base64::encode_base64;
use gmsol_sdk::utils::zero_copy::try_deserialize_zero_copy;
use gmsol_sdk::Client;

/// Solana `getMultipleAccounts` page size.
const MULTI_ACCOUNTS_CHUNK: usize = 100;

/// One market fetched on-chain: the decoded account plus token mints and GM-token supply/decimals.
pub struct RpcMarket {
    pub market: Arc<Market>,
    pub market_token: String,
    pub index_token_mint: String,
    pub long_token_mint: String,
    pub short_token_mint: String,
    pub market_token_mint: String,
    pub supply: u64,
    pub market_token_decimals: u8,
}

impl RpcMarket {
    /// A [`FetchedMarket`] view for the snapshot consumers, with unused VI fields defaulted and account bytes re-encoded into `data_base64`.
    pub fn to_fetched(&self) -> FetchedMarket {
        FetchedMarket {
            market_token: self.market_token.clone(),
            index_token_mint: self.index_token_mint.clone(),
            long_token_mint: self.long_token_mint.clone(),
            short_token_mint: self.short_token_mint.clone(),
            market_token_mint: self.market_token_mint.clone(),
            supply: self.supply,
            market_token_decimals: self.market_token_decimals,
            data_base64: encode_base64(bytes_of(&*self.market)),
            ..Default::default()
        }
    }
}

/// One GLV fetched on-chain: representative market plus GLV-token supply.
#[derive(Debug, Clone)]
pub struct RpcGlv {
    pub glv_token_address: String,
    pub representative_market: Option<String>,
    pub supply: u64,
}

/// Stable on-chain identity of one market (Market PDA + GM-token mint), cached across cheap data refreshes.
#[derive(Debug, Clone)]
pub struct MarketRef {
    pub market_pda: Pubkey,
    pub market_token_mint: Pubkey,
}

/// Stable on-chain identity of one GLV: the Glv account PDA + its GLV-token mint.
#[derive(Debug, Clone)]
pub struct GlvRef {
    pub glv_pda: Pubkey,
    pub glv_token_mint: Pubkey,
}

/// The cached market/GLV universe (PDAs + token mints) discovered via the expensive `getProgramAccounts` scan and reused for cheap data refreshes.
#[derive(Debug, Clone, Default)]
pub struct MarketList {
    pub markets: Vec<MarketRef>,
    pub glvs: Vec<GlvRef>,
}

impl MarketList {
    /// The `getMultipleAccounts` key list in the fixed segment order `[market PDAs] ++ [glv PDAs] ++ [market mints] ++ [glv mints]`.
    pub fn all_keys(&self) -> Vec<Pubkey> {
        let mut keys = Vec::with_capacity(self.markets.len() * 2 + self.glvs.len() * 2);
        keys.extend(self.markets.iter().map(|m| m.market_pda));
        keys.extend(self.glvs.iter().map(|g| g.glv_pda));
        keys.extend(self.markets.iter().map(|m| m.market_token_mint));
        keys.extend(self.glvs.iter().map(|g| g.glv_token_mint));
        keys
    }
}

/// Parse SPL Mint account bytes into `(supply, decimals)`.
pub fn parse_mint(data: &[u8]) -> Option<(u64, u8)> {
    if data.len() < 45 {
        return None;
    }
    let supply = u64::from_le_bytes(data[36..44].try_into().ok()?);
    Some((supply, data[44]))
}

/// Batch `getMultipleAccounts` in chunks of [`MULTI_ACCOUNTS_CHUNK`], preserving order.
pub(crate) async fn get_accounts_chunked(
    rpc: &RpcClient,
    keys: &[Pubkey],
) -> Result<Vec<Option<Account>>> {
    let mut out = Vec::with_capacity(keys.len());
    for chunk in keys.chunks(MULTI_ACCOUNTS_CHUNK) {
        let accts = rpc
            .get_multiple_accounts(chunk)
            .await
            .wrap_err("rpc get_multiple_accounts failed")?;
        out.extend(accts);
    }
    Ok(out)
}

/// Discover the market/GLV universe of `store` via the expensive `getProgramAccounts` scan, returning the stable PDAs + token mints.
pub async fn discover_market_list(rpc_url: &str, store: &str) -> Result<MarketList> {
    let cluster = Cluster::from_str(rpc_url)?;
    // Read-only: a random ephemeral signer is sufficient (never signs a txn).
    let payer = shared_signer(Keypair::new());
    let client = Client::new_with_options(cluster, payer, ClientOptions::default())?;
    let store_pk = Pubkey::from_str(store).wrap_err("invalid store pubkey")?;

    let markets = client
        .markets(&store_pk)
        .await
        .wrap_err("rpc markets fetch failed")?;
    let market_refs: Vec<MarketRef> = markets
        .into_iter()
        .map(|(market_pda, market)| MarketRef {
            market_pda,
            market_token_mint: market.meta.market_token_mint,
        })
        .collect();

    let glvs = client
        .glvs(&store_pk)
        .await
        .wrap_err("rpc glvs fetch failed")?;
    let glv_refs: Vec<GlvRef> = glvs
        .into_iter()
        .map(|(glv_pda, glv)| GlvRef {
            glv_pda,
            glv_token_mint: glv.glv_token,
        })
        .collect();

    Ok(MarketList {
        markets: market_refs,
        glvs: glv_refs,
    })
}

/// Refresh market + GLV account data for the known [`MarketList`] via one cheap batched `getMultipleAccounts`, then decode and assemble.
pub async fn fetch_market_data(
    rpc: &RpcClient,
    list: &MarketList,
) -> Result<(Vec<RpcMarket>, Vec<RpcGlv>)> {
    let keys = list.all_keys();
    let accts = get_accounts_chunked(rpc, &keys).await?;
    Ok(assemble_market_data(list, &accts))
}

/// Pure assembly of the fetched accounts (in [`MarketList::all_keys`] order) into [`RpcMarket`]/[`RpcGlv`], skipping any missing or undecodable entry.
pub fn assemble_market_data(
    list: &MarketList,
    accts: &[Option<Account>],
) -> (Vec<RpcMarket>, Vec<RpcGlv>) {
    let nm = list.markets.len();
    let ng = list.glvs.len();
    // Segment slices mirroring `MarketList::all_keys` ordering, kept panic-free via `.get(..)`.
    let market_accts = accts.get(0..nm).unwrap_or(&[]);
    let glv_accts = accts.get(nm..nm + ng).unwrap_or(&[]);
    let market_mint_accts = accts.get(nm + ng..nm + ng + nm).unwrap_or(&[]);
    let glv_mint_accts = accts.get(nm + ng + nm..nm + ng + nm + ng).unwrap_or(&[]);

    let mut markets_out = Vec::with_capacity(nm);
    for (i, mref) in list.markets.iter().enumerate() {
        let Some(Some(acct)) = market_accts.get(i) else {
            tracing::debug!(pda = %mref.market_pda, "refresh: market account missing; skipping");
            continue;
        };
        let market = match try_deserialize_zero_copy::<Market>(&acct.data) {
            Ok(zc) => Arc::new(zc.into_inner()),
            Err(err) => {
                tracing::debug!(error = %err, pda = %mref.market_pda, "refresh: market decode failed; skipping");
                continue;
            }
        };
        let (supply, decimals) = market_mint_accts
            .get(i)
            .and_then(|o| o.as_ref())
            .and_then(|a| parse_mint(&a.data))
            .unwrap_or((0, 0));
        let meta = market.meta;
        markets_out.push(RpcMarket {
            market_token: meta.market_token_mint.to_string(),
            index_token_mint: meta.index_token_mint.to_string(),
            long_token_mint: meta.long_token_mint.to_string(),
            short_token_mint: meta.short_token_mint.to_string(),
            market_token_mint: meta.market_token_mint.to_string(),
            supply,
            market_token_decimals: decimals,
            market,
        });
    }

    let mut glvs_out = Vec::with_capacity(ng);
    for (i, gref) in list.glvs.iter().enumerate() {
        let Some(Some(acct)) = glv_accts.get(i) else {
            tracing::debug!(pda = %gref.glv_pda, "refresh: glv account missing; skipping");
            continue;
        };
        let glv = match try_deserialize_zero_copy::<Glv>(&acct.data) {
            Ok(zc) => zc.into_inner(),
            Err(err) => {
                tracing::debug!(error = %err, pda = %gref.glv_pda, "refresh: glv decode failed; skipping");
                continue;
            }
        };
        let supply = glv_mint_accts
            .get(i)
            .and_then(|o| o.as_ref())
            .and_then(|a| parse_mint(&a.data))
            .map(|(s, _)| s)
            .unwrap_or(0);
        glvs_out.push(RpcGlv {
            glv_token_address: glv.glv_token.to_string(),
            representative_market: glv_representative(&glv),
            supply,
        });
    }

    (markets_out, glvs_out)
}

/// First market token of a GLV (its "representative" market), as a base58 string.
fn glv_representative(glv: &Glv) -> Option<String> {
    glv.market_tokens().next().map(|m| m.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_mint_reads_supply_and_decimals() {
        // 82-byte SPL Mint with supply=1_000_000 and decimals=9.
        let mut data = vec![0u8; 82];
        data[0] = 1;
        data[36..44].copy_from_slice(&1_000_000u64.to_le_bytes());
        data[44] = 9;
        assert_eq!(parse_mint(&data), Some((1_000_000, 9)));
        // too short -> None.
        assert_eq!(parse_mint(&[0u8; 10]), None);
    }

    /// An 82-byte SPL Mint account with the given supply/decimals.
    fn mint_account(supply: u64, decimals: u8) -> Account {
        let mut d = vec![0u8; 82];
        d[0] = 1;
        d[36..44].copy_from_slice(&supply.to_le_bytes());
        d[44] = decimals;
        Account {
            data: d,
            ..Default::default()
        }
    }

    #[test]
    fn all_keys_orders_segments_markets_glvs_marketmints_glvmints() {
        let m_pda = Pubkey::new_unique();
        let m_mint = Pubkey::new_unique();
        let g_pda = Pubkey::new_unique();
        let g_mint = Pubkey::new_unique();
        let list = MarketList {
            markets: vec![MarketRef {
                market_pda: m_pda,
                market_token_mint: m_mint,
            }],
            glvs: vec![GlvRef {
                glv_pda: g_pda,
                glv_token_mint: g_mint,
            }],
        };
        // [market PDAs] ++ [glv PDAs] ++ [market mints] ++ [glv mints].
        assert_eq!(list.all_keys(), vec![m_pda, g_pda, m_mint, g_mint]);
    }

    #[test]
    fn assemble_pairs_accounts_and_mints_by_segment() {
        use gmsol_sdk::programs::anchor_lang::Discriminator;
        use gmsol_sdk::programs::bytemuck::{bytes_of, Zeroable};
        use gmsol_sdk::programs::gmsol_store::accounts::{Glv, Market};

        let list = MarketList {
            markets: vec![MarketRef {
                market_pda: Pubkey::new_unique(),
                market_token_mint: Pubkey::new_unique(),
            }],
            glvs: vec![GlvRef {
                glv_pda: Pubkey::new_unique(),
                glv_token_mint: Pubkey::new_unique(),
            }],
        };

        // Market account with a distinguishing pool amount to verify it lands in the market slot.
        let mut market = Market::zeroed();
        market.state.pools.primary.pool.long_token_amount = 4242;
        let market_data = [<Market as Discriminator>::DISCRIMINATOR, bytes_of(&market)].concat();
        let glv = Glv::zeroed();
        let glv_data = [<Glv as Discriminator>::DISCRIMINATOR, bytes_of(&glv)].concat();

        // Order mirrors all_keys with distinct mint supplies proving the market pairs with the market mint (111), not the glv mint (222).
        let accts = vec![
            Some(Account {
                data: market_data,
                ..Default::default()
            }),
            Some(Account {
                data: glv_data,
                ..Default::default()
            }),
            Some(mint_account(111, 9)),
            Some(mint_account(222, 6)),
        ];

        let (markets, glvs) = assemble_market_data(&list, &accts);

        assert_eq!(markets.len(), 1);
        assert_eq!(
            markets[0].market.state.pools.primary.pool.long_token_amount, 4242,
            "market account decoded into the market slot"
        );
        assert_eq!(markets[0].supply, 111, "paired with the market mint");
        assert_eq!(markets[0].market_token_decimals, 9);

        assert_eq!(glvs.len(), 1);
        assert_eq!(glvs[0].supply, 222, "paired with the glv mint");
    }

    #[test]
    fn assemble_skips_missing_market_account() {
        let list = MarketList {
            markets: vec![MarketRef {
                market_pda: Pubkey::new_unique(),
                market_token_mint: Pubkey::new_unique(),
            }],
            glvs: vec![],
        };
        // market PDA + market mint both None -> skipped, no panic.
        let (markets, glvs) = assemble_market_data(&list, &[None, None]);
        assert!(markets.is_empty());
        assert!(glvs.is_empty());
    }
}
