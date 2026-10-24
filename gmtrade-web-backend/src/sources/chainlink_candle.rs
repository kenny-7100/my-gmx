//! Chainlink Data Engine candle client, parsing `10^18`-scaled OHLC big ints as i128 via [`RawValue`] to avoid f64 loss.

use std::time::Duration;

use serde::Deserialize;
use serde_json::value::RawValue;

use crate::tokens::CHAINLINK_DECIMALS;

const DEFAULT_AUTH_URL: &str =
    "https://v4eqik9a1j.execute-api.ap-southeast-1.amazonaws.com/dev/get-cl-access-token";

const DEFAULT_HISTORY_URL: &str = "https://priceapi.dataengine.chain.link/api/v1/history/rows";

const DEFAULT_STREAMING_URL: &str = "https://priceapi.dataengine.chain.link/api/v1/streaming";

const DEFAULT_TIMEOUT_MS: u64 = 10_000;

/// `serde`-defaults to the production URLs + 10s timeout (empty config -> prod).
#[derive(Debug, Clone, Deserialize)]
pub struct ChainlinkCandleConfig {
    #[serde(default = "default_auth_url")]
    pub auth_url: String,
    #[serde(default = "default_history_url")]
    pub history_url: String,
    /// Data Engine SSE price stream (`/streaming`), used by [`crate::candle_stream`] to update the live forming candle.
    #[serde(default = "default_streaming_url")]
    pub streaming_url: String,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
}

fn default_auth_url() -> String {
    DEFAULT_AUTH_URL.to_string()
}

fn default_history_url() -> String {
    DEFAULT_HISTORY_URL.to_string()
}

fn default_streaming_url() -> String {
    DEFAULT_STREAMING_URL.to_string()
}

fn default_timeout_ms() -> u64 {
    DEFAULT_TIMEOUT_MS
}

impl Default for ChainlinkCandleConfig {
    fn default() -> Self {
        Self {
            auth_url: default_auth_url(),
            history_url: default_history_url(),
            streaming_url: default_streaming_url(),
            timeout_ms: default_timeout_ms(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ChainlinkCandleClient {
    http: reqwest::Client,
    /// No request timeout since the SSE stream is long-lived; the caller applies its own per-chunk idle timeout.
    stream_http: reqwest::Client,
    auth_url: String,
    history_url: String,
    streaming_url: String,
}

/// Mainnet Data Engine host, swapped for the testnet host when `enable_devnet` is set.
const DATAENGINE_HOST: &str = "priceapi.dataengine.chain.link";
const DATAENGINE_TESTNET_HOST: &str = "priceapi.testnet-dataengine.chain.link";

/// Rewrite a Data Engine URL to its testnet host (`priceapi.testnet-dataengine.chain.link`);
/// a non-Data-Engine URL (e.g. the auth Lambda) is returned unchanged.
fn to_testnet_url(url: &str) -> String {
    url.replace(DATAENGINE_HOST, DATAENGINE_TESTNET_HOST)
}

impl ChainlinkCandleClient {
    /// `enable_devnet` rewrites the Data Engine candle/stream URLs to their testnet host; the auth URL is
    /// left as configured (the mainnet auth Lambda is not on the Data Engine host, so testnet calls fail
    /// auth and the live price falls back to the keeper leg until a testnet auth is wired).
    pub fn new(cfg: ChainlinkCandleConfig, enable_devnet: bool) -> eyre::Result<Self> {
        let http = Self::http_client_builder(&cfg)?.build()?;
        // Pin the STREAM client to HTTP/1.1 because reqwest/hyper's h2 decoder chokes on Cloudflare's long-lived SSE response.
        let stream_http = reqwest::Client::builder().http1_only().build()?;
        Ok(Self::with_http_clients(
            cfg,
            enable_devnet,
            http,
            stream_http,
        ))
    }

    #[cfg(test)]
    pub(crate) fn new_for_tests(
        cfg: ChainlinkCandleConfig,
        enable_devnet: bool,
    ) -> eyre::Result<Self> {
        let http = Self::http_client_builder(&cfg)?.no_proxy().build()?;
        let stream_http = reqwest::Client::builder().http1_only().no_proxy().build()?;
        Ok(Self::with_http_clients(
            cfg,
            enable_devnet,
            http,
            stream_http,
        ))
    }

    fn http_client_builder(cfg: &ChainlinkCandleConfig) -> eyre::Result<reqwest::ClientBuilder> {
        Ok(reqwest::Client::builder().timeout(Duration::from_millis(cfg.timeout_ms)))
    }

    fn with_http_clients(
        cfg: ChainlinkCandleConfig,
        enable_devnet: bool,
        http: reqwest::Client,
        stream_http: reqwest::Client,
    ) -> Self {
        let (history_url, streaming_url) = if enable_devnet {
            (
                to_testnet_url(&cfg.history_url),
                to_testnet_url(&cfg.streaming_url),
            )
        } else {
            (cfg.history_url, cfg.streaming_url)
        };
        Self {
            http,
            stream_http,
            auth_url: cfg.auth_url,
            history_url,
            streaming_url,
        }
    }

    /// Open the Data Engine SSE price stream for comma-separated query `symbols` with a `Bearer` token, returning the streaming [`reqwest::Response`].
    pub async fn open_stream(&self, symbols: &str, token: &str) -> eyre::Result<reqwest::Response> {
        let resp = self
            .stream_http
            .get(&self.streaming_url)
            .query(&[("symbol", symbols)])
            .bearer_auth(token)
            .header(reqwest::header::CONNECTION, "keep-alive")
            .send()
            .await?;
        let status = resp.status();
        if !status.is_success() {
            eyre::bail!("stream request failed for {symbols}: status {status}");
        }
        Ok(resp)
    }

    /// `GET` the auth Lambda and extract `d.access_token` from the nested `{statusCode, body:"<json>"}` envelope.
    pub async fn fetch_auth_token(&self) -> eyre::Result<String> {
        let resp = self.http.get(&self.auth_url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            eyre::bail!("auth request failed: status {status}");
        }
        let body: serde_json::Value = resp.json().await?;
        parse_auth_token(&body)
            .ok_or_else(|| eyre::eyre!("auth token not found in response envelope"))
    }

    /// `GET history/rows` with a `Bearer` token, parse + scale OHLC rows; `token_digits` is the precision-trim count (`<= 0` = no trim).
    pub async fn fetch_candles(
        &self,
        symbol: &str,
        resolution: &str,
        from: i64,
        to: i64,
        token: &str,
        token_digits: i32,
    ) -> eyre::Result<HistoryOutcome> {
        let resp = self
            .http
            .get(&self.history_url)
            .query(&[
                ("symbol", symbol),
                ("resolution", resolution),
                ("from", &from.to_string()),
                ("to", &to.to_string()),
            ])
            .bearer_auth(token)
            .send()
            .await?;
        let status = resp.status();
        // 404 = the Data Engine has no series for this (symbol, resolution); carry the reason up rather than logging here (every Gmx token 404s before its Arbitrum fallback).
        if status == reqwest::StatusCode::NOT_FOUND {
            return Ok(HistoryOutcome::NotFound);
        }
        if !status.is_success() {
            eyre::bail!("history request failed for {symbol}/{resolution}: status {status}");
        }
        // Parse from response TEXT so big-int digits survive instead of collapsing to lossy f64.
        let text = resp.text().await?;
        let rows = parse_history_text(&text, token_digits);
        Ok(if rows.is_empty() {
            HistoryOutcome::EmptyBody
        } else {
            HistoryOutcome::Rows(rows)
        })
    }
}

/// Result of a Data Engine history fetch, distinguishing "no series" (404) from "empty body" (200) for diagnostics.
pub enum HistoryOutcome {
    Rows(Vec<[f64; 5]>),
    NotFound,
    EmptyBody,
}

/// Inner token-response shape (`TokenResp` in Go): `{"d":{"access_token":...}}`.
#[derive(Deserialize)]
struct InnerTokenResp {
    d: InnerAccessToken,
}

#[derive(Deserialize)]
struct InnerAccessToken {
    access_token: String,
}

/// Extract the access token from the JSON-string `body` (`{"d":{"access_token":"..."}}`), returning `None` on any missing/empty field.
pub fn parse_auth_token(raw: &serde_json::Value) -> Option<String> {
    let body = raw.get("body")?.as_str()?;
    let inner: InnerTokenResp = serde_json::from_str(body).ok()?;
    let token = inner.d.access_token;
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

/// One parsed price tick from the Data Engine SSE stream: query `symbol` (`i`), `10^18`-scaled `price_raw` (`p`), and unix `ts` (`t`).
#[derive(Debug, Clone, PartialEq)]
pub struct StreamTick {
    pub symbol: String,
    pub price_raw: i128,
    pub ts: i64,
}

/// Parse one SSE line into a [`StreamTick`], returning `None` for heartbeats, blank lines, and malformed/missing fields.
pub fn parse_stream_tick(line: &str) -> Option<StreamTick> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }
    // Capture `p` as a RawValue so the unquoted big-int price keeps FULL precision instead of collapsing to a lossy f64.
    #[derive(Deserialize)]
    struct RawTick {
        #[serde(default)]
        heartbeat: i64,
        i: Option<String>,
        p: Option<Box<RawValue>>,
        #[serde(default)]
        t: i64,
    }
    let raw: RawTick = serde_json::from_str(line).ok()?;
    // Heartbeat keepalive carries no price.
    if raw.heartbeat != 0 {
        return None;
    }
    let symbol = raw.i.filter(|s| !s.is_empty())?;
    if raw.t <= 0 {
        return None;
    }
    let price_raw = raw_to_i128(raw.p.as_deref()?)?;
    Some(StreamTick {
        symbol,
        price_raw,
        ts: raw.t,
    })
}

/// Scale a `10^18` raw price into an f64 USD price with the same precision trim as the history rows.
pub fn stream_price_to_f64(price_raw: i128, token_digits: i32) -> f64 {
    let unit = 10f64.powi(CHAINLINK_DECIMALS as i32);
    trim_precision_i128(price_raw, token_digits) as f64 / unit
}

/// Each element is a [`RawValue`] so big-int digits survive (see module note).
#[derive(Deserialize)]
struct HistoryResp {
    #[serde(default)]
    candles: Vec<Vec<Box<RawValue>>>,
}

/// Parse a raw JSON candle value (number or quoted string) into a full-precision `i128`.
fn raw_to_i128(v: &RawValue) -> Option<i128> {
    let txt = v.get().trim();
    let txt = txt
        .strip_prefix('"')
        .and_then(|s| s.strip_suffix('"'))
        .unwrap_or(txt)
        .trim();
    // Plain integer (SOL etc.): parse EXACTLY.
    if let Ok(n) = txt.parse::<i128>() {
        return Some(n);
    }
    // Large prices arrive in scientific notation that `i128::parse` rejects, so round-trip those through f64.
    let f = txt.parse::<f64>().ok()?;
    f.is_finite().then(|| f.round() as i128)
}

/// Trim the lowest `digits` decimal digits of `n` to zero (`digits <= 0` is a no-op).
fn trim_precision_i128(n: i128, digits: i32) -> i128 {
    if digits <= 0 {
        return n;
    }
    match 10i128.checked_pow(digits as u32) {
        Some(factor) if factor != 0 => (n / factor) * factor,
        // Overflow / absurd digit count: skip the trim rather than panic.
        _ => n,
    }
}

/// Parse + scale `candles` big-int rows into OHLC `[ts, o, h, l, c]` f64 rows; malformed rows are skipped (no panic).
pub fn parse_history_text(text: &str, token_digits: i32) -> Vec<[f64; 5]> {
    let parsed: HistoryResp = match serde_json::from_str(text) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    build_rows(&parsed.candles, token_digits)
}

fn build_rows(candles: &[Vec<Box<RawValue>>], token_digits: i32) -> Vec<[f64; 5]> {
    let unit = 10f64.powi(CHAINLINK_DECIMALS as i32);
    let mut out = Vec::with_capacity(candles.len());

    for row in candles {
        // Each row must be [ts, open, high, low, close] (5 elements, NO volume).
        if row.len() < 5 {
            continue;
        }
        let ts = match raw_to_i128(&row[0]) {
            Some(t) => t as f64,
            None => continue,
        };
        let mut ohlc = [0.0f64; 4];
        let mut ok = true;
        for (i, slot) in ohlc.iter_mut().enumerate() {
            match raw_to_i128(&row[i + 1]) {
                Some(v) => {
                    let trimmed = trim_precision_i128(v, token_digits);
                    *slot = trimmed as f64 / unit;
                }
                None => {
                    ok = false;
                    break;
                }
            }
        }
        if !ok {
            continue;
        }
        out.push([ts, ohlc[0], ohlc[1], ohlc[2], ohlc[3]]);
    }

    out
}

/// Seconds per resolution string (`1m/5m/15m/30m/1h/2h/4h/1d`). `None` for unknown.
pub fn resolution_seconds(period: &str) -> Option<i64> {
    Some(match period {
        "1m" => 60,
        "5m" => 5 * 60,
        "15m" => 15 * 60,
        "30m" => 30 * 60,
        "1h" => 60 * 60,
        "2h" => 2 * 60 * 60,
        "4h" => 4 * 60 * 60,
        "1d" => 24 * 60 * 60,
        _ => return None,
    })
}

/// Single-shot `(from, to)` window for up to `limit` candles of `period` (`None` for unknown period).
pub fn candle_window(now: i64, period: &str, limit: i64) -> Option<(i64, i64)> {
    let secs = resolution_seconds(period)?;
    let to = now + 60;
    let from = to - limit.max(0) * secs;
    Some((from, to))
}

/// Chainlink query symbol: `USD`-prefixed FX pairs pass through, everything else gets the `<X>USD` suffix.
pub fn data_source_symbol(base_symbol: &str) -> String {
    if base_symbol.starts_with("USD") {
        base_symbol.to_string()
    } else {
        format!("{base_symbol}USD")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_auth_token_extracts_nested_string_body() {
        let raw: serde_json::Value = serde_json::from_str(
            r#"{"statusCode":200,"body":"{\"d\":{\"access_token\":\"TOK123\"},\"s\":\"ok\",\"expiration\":123}"}"#,
        )
        .unwrap();
        assert_eq!(parse_auth_token(&raw), Some("TOK123".to_string()));
    }

    #[test]
    fn parse_history_text_scales_big_ints_by_1e18() {
        let text = r#"{"s":"SOLUSD","candles":[[1748736000, 150000000000000000000, 151000000000000000000, 149000000000000000000, 150500000000000000000]]}"#;
        let rows = parse_history_text(text, 0); // digits=0 -> no trim
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0], [1_748_736_000.0, 150.0, 151.0, 149.0, 150.5]);
    }

    #[test]
    fn parse_history_text_precision_trim_zeros_low_digits() {
        let text = r#"{"s":"X","candles":[[1748736000, 150500000000000000077, 150500000000000000077, 150500000000000000077, 150500000000000000077]]}"#;
        let trimmed = parse_history_text(text, 2);
        assert_eq!(trimmed[0][1], 150.5);

        // f64 rounds either way, so check integer math to prove the trim fires.
        assert_eq!(
            trim_precision_i128(150_500_000_000_000_000_077, 2),
            150_500_000_000_000_000_000
        );
        assert_eq!(trim_precision_i128(123, -5), 123);
    }

    #[test]
    fn resolution_seconds_known_periods() {
        assert_eq!(resolution_seconds("1m"), Some(60));
        assert_eq!(resolution_seconds("4h"), Some(14400));
        assert_eq!(resolution_seconds("1d"), Some(86400));
        assert_eq!(resolution_seconds("nope"), None);
    }

    #[test]
    fn data_source_symbol_usd_suffix() {
        assert_eq!(data_source_symbol("SOL"), "SOLUSD");
        assert_eq!(data_source_symbol("USDJPY"), "USDJPY");
    }

    #[test]
    fn to_testnet_url_swaps_only_dataengine_host() {
        // Data Engine history/stream URLs get the testnet host.
        assert_eq!(
            to_testnet_url(DEFAULT_HISTORY_URL),
            "https://priceapi.testnet-dataengine.chain.link/api/v1/history/rows"
        );
        assert_eq!(
            to_testnet_url(DEFAULT_STREAMING_URL),
            "https://priceapi.testnet-dataengine.chain.link/api/v1/streaming"
        );
        // The auth Lambda is not on the Data Engine host -> left unchanged.
        assert_eq!(to_testnet_url(DEFAULT_AUTH_URL), DEFAULT_AUTH_URL);
    }

    #[test]
    fn parse_stream_tick_extracts_symbol_price_ts() {
        // price as a quoted big-int string, full precision preserved.
        let line = r#"{"f":"r","i":"SOLUSD","p":"65790000000000000000","t":1780660812}"#;
        assert_eq!(
            parse_stream_tick(line),
            Some(StreamTick {
                symbol: "SOLUSD".to_string(),
                price_raw: 65_790_000_000_000_000_000,
                ts: 1_780_660_812,
            })
        );
    }

    #[test]
    fn parse_stream_tick_preserves_unquoted_bigint_price() {
        // The real stream sends `p` as an unquoted ~20-digit integer exceeding u64::MAX that must keep full precision.
        let line = r#"{"f":"t","i":"SOLUSD","p":66065693564861050000,"t":1780978503,"s":1}"#;
        assert_eq!(
            parse_stream_tick(line),
            Some(StreamTick {
                symbol: "SOLUSD".to_string(),
                price_raw: 66_065_693_564_861_050_000,
                ts: 1_780_978_503,
            })
        );
    }

    #[test]
    fn raw_to_i128_handles_scientific_and_exact_integers() {
        // Large prices come back in scientific notation that i128::parse rejects, so the f64 fallback covers them.
        let sci: Box<RawValue> = serde_json::from_str("6.320641823335779e+22").unwrap();
        let n = raw_to_i128(&sci).expect("scientific notation must parse");
        assert!((n as f64 - 6.320641823335779e22).abs() / 6.32e22 < 1e-12);
        // Plain integers (SOL path) still parse EXACTLY — no f64 round-trip.
        let int: Box<RawValue> = serde_json::from_str("66975653991601200000").unwrap();
        assert_eq!(raw_to_i128(&int), Some(66_975_653_991_601_200_000));
    }

    #[test]
    fn parse_stream_tick_skips_heartbeat_and_malformed() {
        assert_eq!(
            parse_stream_tick(r#"{"heartbeat":1780660812}"#),
            None // heartbeat -> no price
        );
        assert_eq!(parse_stream_tick(""), None); // blank
        assert_eq!(parse_stream_tick("not json"), None); // garbage
        assert_eq!(parse_stream_tick(r#"{"i":"SOLUSD","t":123}"#), None); // missing p
        assert_eq!(parse_stream_tick(r#"{"i":"","p":"1","t":1}"#), None); // empty symbol
    }

    #[test]
    fn stream_price_to_f64_matches_history_scaling() {
        // 65.79e18 / 1e18 = 65.79 (digits=0 -> no trim), same as history rows.
        assert_eq!(stream_price_to_f64(65_790_000_000_000_000_000, 0), 65.79);
    }
}
