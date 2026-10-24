//! Chainlink Data Streams price fallback (keyed by feed id, from the on-chain TokenMap) for mints the Data Engine cannot serve.

use std::collections::HashMap;
use std::sync::Arc;

use gmsol_keeper_client::FetchedPrice;
use gmsol_sdk::client::chainlink::pull_oracle::{ApiReportData, Client, Credential};

use crate::aggregate::scale::chainlink_raw_to_u;

/// Chainlink Data Streams price-fallback client, disabled (no-op) when credentials are absent.
#[derive(Clone)]
pub struct ChainlinkStreamsClient {
    client: Option<Arc<Client>>,
    feeds: Arc<arc_swap::ArcSwap<HashMap<String, String>>>,
}

impl ChainlinkStreamsClient {
    /// Build a Data Streams client from HMAC credentials and the mint->feed-id map (empty credentials -> disabled).
    /// `testnet` selects the testnet Data Streams endpoint (devnet deploy) instead of mainnet.
    pub fn new(
        user_id: String,
        secret: String,
        feeds: HashMap<String, String>,
        testnet: bool,
    ) -> eyre::Result<Self> {
        let feeds = Arc::new(arc_swap::ArcSwap::from_pointee(feeds));
        if user_id.is_empty() || secret.is_empty() {
            return Ok(Self {
                client: None,
                feeds,
            });
        }
        // `Credential`'s fields are private but it derives `Deserialize`, so build it via serde.
        let credential: Credential = serde_json::from_value(serde_json::json!({
            "user_id": user_id,
            "secret": secret,
        }))?;
        // Mainnet (`api.dataengine.chain.link`) vs testnet (`api.testnet-dataengine.chain.link`) base URL.
        let client = if testnet {
            Client::with_testnet_credential(credential)
        } else {
            Client::with_credential(credential)
        };
        Ok(Self {
            client: Some(Arc::new(client)),
            feeds,
        })
    }

    /// Whether credentials are configured.
    pub fn enabled(&self) -> bool {
        self.client.is_some()
    }

    /// Number of mints with a known Data Streams feed (for logging/health).
    pub fn feed_count(&self) -> usize {
        self.feeds.load().len()
    }

    /// Replace the mint->feed-id map, ignoring an empty `feeds` so the previous map survives.
    pub fn update_feeds(&self, feeds: HashMap<String, String>) {
        if !feeds.is_empty() {
            self.feeds.store(Arc::new(feeds));
        }
    }

    /// Fetch Data Streams prices via `latest_report` for the `mints` that have a known feed.
    pub async fn fetch(&self, mints: &[String], now: i64) -> Vec<FetchedPrice> {
        let Some(client) = &self.client else {
            return Vec::new();
        };
        // (mint, feed_id) for the wanted mints that have a known feed.
        let feeds = self.feeds.load();
        let wanted: Vec<(String, String)> = mints
            .iter()
            .filter_map(|mint| {
                let feed = feeds.get(mint)?.clone();
                Some((mint.clone(), feed))
            })
            .collect();
        if wanted.is_empty() {
            return Vec::new();
        }

        let futs = wanted.iter().map(|(mint, feed)| async move {
            match client.latest_report(feed).await {
                Ok(report) => report_to_fetched(&report, mint, now),
                Err(err) => {
                    tracing::warn!(error = %err, feed = %feed, "data streams latest_report failed");
                    None
                }
            }
        });
        let out: Vec<FetchedPrice> = futures_util::future::join_all(futs)
            .await
            .into_iter()
            .flatten()
            .collect();
        tracing::debug!(
            wanted = wanted.len(),
            priced = out.len(),
            "chainlink data streams fetch"
        );
        out
    }
}

/// Decode a Data Streams report into a `U`-price [`FetchedPrice`] for `mint`, `None` on failure.
fn report_to_fetched(report: &ApiReportData, mint: &str, now: i64) -> Option<FetchedPrice> {
    let decoded = report.decode().ok()?;
    let price = decoded.non_negative_price()?;
    let bid = u128::try_from(decoded.non_negative_bid().unwrap_or(price)).ok()?;
    let ask = u128::try_from(decoded.non_negative_ask().unwrap_or(price)).ok()?;
    Some(FetchedPrice {
        pubkey: mint.to_string(),
        min: 0.0,
        max: 0.0,
        mid: 0.0,
        min_raw: Some(chainlink_raw_to_u(bid).to_string()),
        max_raw: Some(chainlink_raw_to_u(ask).to_string()),
        ts: Some(now),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Fake placeholder feed map (no real mint / feed id in source).
    const TEST_MINT: &str = "TestMint1111111111111111111111111111111111";
    fn feeds() -> HashMap<String, String> {
        HashMap::from([(TEST_MINT.to_string(), "0xfeedid".to_string())])
    }

    #[test]
    fn disabled_without_credentials_but_keeps_feeds() {
        let c = ChainlinkStreamsClient::new(String::new(), String::new(), feeds(), false).unwrap();
        assert!(!c.enabled());
        assert_eq!(c.feed_count(), 1);
    }

    #[tokio::test]
    async fn disabled_fetch_is_empty() {
        let c = ChainlinkStreamsClient::new(String::new(), String::new(), feeds(), false).unwrap();
        let out = c.fetch(&[TEST_MINT.to_string()], 0).await;
        assert!(out.is_empty(), "disabled client fetches nothing");
    }
}
