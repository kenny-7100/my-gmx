//! Arbitrum GMX tickers price source returning the raw `(min, max)` price per normalized symbol for `data_source = Gmx` tokens.

use std::collections::HashMap;
use std::time::Duration;

use serde::Deserialize;

const DEFAULT_TICKERS_URL: &str = "https://arbitrum-api.gmxinfra2.io/prices/tickers";
const DEFAULT_TIMEOUT_MS: u64 = 10_000;

const DEFAULT_CANDLES_URL: &str = "https://arbitrum-api.gmxinfra2.io/prices/candles";

/// `serde`-defaults to the production URL + 10s timeout.
#[derive(Debug, Clone, Deserialize)]
pub struct ArbitrumConfig {
    #[serde(default = "default_tickers_url")]
    pub tickers_url: String,
    /// Candle endpoint for `data_source = Gmx` tokens (the Data Engine lacks the newest ones).
    #[serde(default = "default_candles_url")]
    pub candles_url: String,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
}

fn default_tickers_url() -> String {
    DEFAULT_TICKERS_URL.to_string()
}

fn default_candles_url() -> String {
    DEFAULT_CANDLES_URL.to_string()
}

fn default_timeout_ms() -> u64 {
    DEFAULT_TIMEOUT_MS
}

impl Default for ArbitrumConfig {
    fn default() -> Self {
        Self {
            tickers_url: default_tickers_url(),
            candles_url: default_candles_url(),
            timeout_ms: default_timeout_ms(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ArbitrumTickerClient {
    http: reqwest::Client,
    url: String,
    candles_url: String,
}

/// Arbitrum candles response: `{ candles: [[ts, o, h, l, c], ...] }` (already real-price f64).
#[derive(Deserialize)]
struct ArbCandlesResp {
    candles: Vec<[f64; 5]>,
}

#[derive(Deserialize)]
struct ArbTicker {
    #[serde(rename = "tokenSymbol")]
    token_symbol: String,
    #[serde(rename = "minPrice")]
    min_price: String,
    #[serde(rename = "maxPrice")]
    max_price: String,
}

impl ArbitrumTickerClient {
    pub fn new(cfg: ArbitrumConfig) -> eyre::Result<Self> {
        let http = Self::http_client(&cfg)?;
        Ok(Self::with_http_client(cfg, http))
    }

    #[cfg(test)]
    pub(crate) fn new_for_tests(cfg: ArbitrumConfig) -> eyre::Result<Self> {
        let http = Self::http_client_builder(&cfg)?.no_proxy().build()?;
        Ok(Self::with_http_client(cfg, http))
    }

    fn http_client(cfg: &ArbitrumConfig) -> eyre::Result<reqwest::Client> {
        Ok(Self::http_client_builder(cfg)?.build()?)
    }

    fn http_client_builder(cfg: &ArbitrumConfig) -> eyre::Result<reqwest::ClientBuilder> {
        // `0` means "no timeout" in reqwest, so fall back to the default instead.
        let timeout_ms = if cfg.timeout_ms == 0 {
            DEFAULT_TIMEOUT_MS
        } else {
            cfg.timeout_ms
        };
        Ok(reqwest::Client::builder().timeout(Duration::from_millis(timeout_ms)))
    }

    fn with_http_client(cfg: ArbitrumConfig, http: reqwest::Client) -> Self {
        Self {
            http,
            url: cfg.tickers_url,
            candles_url: cfg.candles_url,
        }
    }

    /// Fetch real-price OHLC candles `[ts, o, h, l, c]` for `data_source = Gmx` tokens (the Data Engine lacks them).
    pub async fn fetch_candles(
        &self,
        symbol: &str,
        period: &str,
        limit: usize,
    ) -> eyre::Result<Vec<[f64; 5]>> {
        let resp = self
            .http
            .get(&self.candles_url)
            .query(&[
                ("tokenSymbol", symbol),
                ("period", period),
                ("limit", &limit.to_string()),
            ])
            .send()
            .await?
            .error_for_status()?;
        Ok(resp.json::<ArbCandlesResp>().await?.candles)
    }

    /// Fetch the Arbitrum ticker list -> `normalized_symbol -> (min_raw, max_raw)`.
    pub async fn fetch(&self) -> eyre::Result<HashMap<String, (u128, u128)>> {
        let resp = self.http.get(&self.url).send().await?.error_for_status()?;
        let text = resp.text().await?;
        Ok(parse_arbitrum_tickers(&text))
    }
}

/// Operator-configured `our-symbol -> Arbitrum-symbol` alias installed once at startup, with no static fallback in prod.
static ARBITRUM_ALIAS: std::sync::OnceLock<HashMap<String, String>> = std::sync::OnceLock::new();

/// Install the Arbitrum symbol alias map (idempotent: first set wins).
pub fn install_arbitrum_alias(alias: HashMap<String, String>) {
    let _ = ARBITRUM_ALIAS.set(alias);
}

#[cfg(test)]
static TEST_ALIAS: std::sync::OnceLock<HashMap<String, String>> = std::sync::OnceLock::new();
#[cfg(not(test))]
static EMPTY_ALIAS: std::sync::OnceLock<HashMap<String, String>> = std::sync::OnceLock::new();

/// The active alias map: the installed one, else empty in prod or a wrapped-token fixture under `cfg(test)`.
fn arbitrum_alias() -> &'static HashMap<String, String> {
    if let Some(a) = ARBITRUM_ALIAS.get() {
        return a;
    }
    #[cfg(test)]
    {
        TEST_ALIAS.get_or_init(|| {
            ["WSOL", "WETH", "WBTC", "WPUMP", "WGMX"]
                .iter()
                .map(|w| (w.to_string(), w[1..].to_string()))
                .collect()
        })
    }
    #[cfg(not(test))]
    {
        EMPTY_ALIAS.get_or_init(HashMap::new)
    }
}

/// Map `our-symbol -> Arbitrum price-API symbol`: configured alias, else the part before `.`, else identity.
pub fn normalize_symbol(symbol: &str) -> String {
    if let Some(a) = arbitrum_alias().get(symbol) {
        return a.clone();
    }
    match symbol.split_once('.') {
        Some((base, _)) => base.to_string(),
        None => symbol.to_string(),
    }
}

/// Parse the Arbitrum tickers JSON into `normalized_symbol -> (min, max)`, skipping malformed rows (first per symbol wins).
pub fn parse_arbitrum_tickers(text: &str) -> HashMap<String, (u128, u128)> {
    let rows: Vec<ArbTicker> = serde_json::from_str(text).unwrap_or_default();
    let mut out = HashMap::new();
    for r in rows {
        let (Ok(min), Ok(max)) = (r.min_price.parse::<u128>(), r.max_price.parse::<u128>()) else {
            continue;
        };
        out.entry(normalize_symbol(&r.token_symbol))
            .or_insert((min, max));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_strips_wrapped_and_dotted() {
        assert_eq!(normalize_symbol("WSOL"), "SOL");
        assert_eq!(normalize_symbol("WETH"), "ETH");
        assert_eq!(normalize_symbol("WIF"), "WIF"); // not a wrapped prefix
        assert_eq!(normalize_symbol("APE.b"), "APE");
        assert_eq!(normalize_symbol("BTC"), "BTC");
    }

    #[test]
    fn parse_skips_bad_rows_and_dedups() {
        let text = r#"[
            {"tokenSymbol":"ETH","minPrice":"100","maxPrice":"101"},
            {"tokenSymbol":"WSOL","minPrice":"63","maxPrice":"64"},
            {"tokenSymbol":"BAD","minPrice":"x","maxPrice":"1"}
        ]"#;
        let m = parse_arbitrum_tickers(text);
        assert_eq!(m.get("ETH"), Some(&(100u128, 101u128)));
        assert_eq!(m.get("SOL"), Some(&(63u128, 64u128))); // WSOL normalized
        assert!(!m.contains_key("BAD")); // unparseable price skipped
    }
}
