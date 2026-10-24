use figment::{
    providers::{Env, Format, Json, Toml},
    Figment,
};
use serde::Deserialize;
use std::path::Path;

const ENV_PREFIX: &str = "GMSOL_WEB_";
const DOT_ALIAS: &str = "__";

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[serde(default = "default_api_address")]
    pub api_address: String,
    #[serde(default)]
    pub sqd: gmsol_sqd_client::Config,
    /// Chainlink Data Engine candle client; serde-defaults to the Go production URLs + 10s timeout.
    #[serde(default)]
    pub chainlink_candle: crate::sources::chainlink_candle::ChainlinkCandleConfig,
    /// Redis (MemoryDB) history store; disabled by default (in-memory only).
    #[serde(default)]
    pub redis: crate::redis_store::RedisConfig,
    /// On-chain token table source (RPC TokenMap + config overlay); disabled by default.
    #[serde(default)]
    pub token_source: TokenSourceConfig,
    /// Solana RPC for the market/GLV account source (replaces keeper/marin). See [`RpcConfig`].
    #[serde(default)]
    pub rpc: RpcConfig,
    /// Store raw balances source. Disabled by default and enabled at runtime via config.
    #[serde(default)]
    pub store_balances: StoreBalancesConfig,
    /// GM/GLV token mint metadata source. Disabled by default and enabled at runtime via config.
    #[serde(default)]
    pub token_mints: TokenMintsConfig,
    /// GLV account body source. Disabled by default and enabled at runtime via config.
    #[serde(default)]
    pub glv_accounts: GlvAccountsConfig,
    /// Runtime-configured extra candle universe. Disabled by default.
    #[serde(default)]
    pub extra_token_candles: ExtraTokenCandlesConfig,
    /// Arbitrum GMX tickers price source for `data_source = Gmx` tokens.
    #[serde(default)]
    pub arbitrum: crate::sources::arbitrum_tickers::ArbitrumConfig,
    /// Keeper (marin) graphql-ws price subscription source for `data_source = Chainlink` tokens.
    #[serde(default)]
    pub keeper: KeeperConfig,
    /// Keeper market-order execution-time subscription.
    #[serde(default)]
    pub keeper_execution_time: KeeperExecutionTimeConfig,
    /// Process metrics exporter and heartbeat worker.
    #[serde(default)]
    pub metrics: MetricsConfig,
    /// price-candle GraphQL candle fallback for tokens the Data Engine + Arbitrum can't price
    /// (keeper-priced markets: USDMXN/WTI/precious metals). Empty endpoint disables it.
    #[serde(default)]
    pub price_candle: gmsol_price_candle_client::Config,
    /// Abnormal-input limits (query-param length, log-string length, upload body size). All configurable.
    #[serde(default)]
    pub limits: LimitsConfig,
    #[serde(default = "default_staleness_secs")]
    pub staleness_secs: u64,
    /// Period (s) of the cheap snapshot refresh loop (default ~5s).
    #[serde(default = "default_refresh_secs")]
    pub refresh_secs: u64,
    /// Period (s) of the expensive market/GLV list re-discovery scan (default 300s, floored at `refresh_secs`).
    #[serde(default = "default_market_list_refresh_secs")]
    pub market_list_refresh_secs: u64,
    /// Period (s) of the slow 24h-volume sqd refresh (default 60s, floored at `refresh_secs`, last-good kept).
    #[serde(default = "default_volume_refresh_secs")]
    pub volume_refresh_secs: u64,
    /// Debounce floor (ms) coalescing marin price pushes to one rebuild per window.
    #[serde(default = "default_rebuild_min_interval_ms")]
    pub rebuild_min_interval_ms: u64,
    /// Period (s) of the candle-refresh ticker populating the 24h fields (Go's `RefreshCandlesticks1h`).
    #[serde(default = "default_candle_refresh_secs")]
    pub candle_refresh_secs: u64,
    /// Cadence (s) of the Chainlink candle-prefetch ticker.
    #[serde(default = "default_candle_prefetch_secs")]
    pub candle_prefetch_secs: u64,
    /// Number of candles requested and retained per `(symbol, period)` prefetch window.
    /// Values below 1 are clamped to 1 by the refresh and restore paths.
    #[serde(default = "default_candle_prefetch_limit")]
    pub candle_prefetch_limit: i64,
    /// Max in-flight candle fetches per prefetch tick.
    #[serde(default = "default_candle_prefetch_concurrency")]
    pub candle_prefetch_concurrency: usize,
    /// Web-backend side guard for price-candle `candlesBatch` calls. 0 disables the guard;
    /// deploy can set this below price-candle's own max to avoid slow over-large batches.
    #[serde(default)]
    pub price_candle_batch_max_rows: i64,
    /// Target estimated rows per price-candle `candlesBatch` request. The prefetcher
    /// splits the token set to stay near this target; 0 disables target-based splitting.
    #[serde(default = "default_price_candle_batch_target_rows")]
    pub price_candle_batch_target_rows: i64,
    /// Maximum in-flight price-candle chunks within one candle period.
    #[serde(default = "default_price_candle_batch_concurrency")]
    pub price_candle_batch_concurrency: usize,
    /// Cadence (s) of the Chainlink auth-token refresher (default 6h, keep-previous-on-error).
    #[serde(default = "default_cl_auth_refresh_secs")]
    pub cl_auth_refresh_secs: u64,
    #[serde(default = "default_daily_ann_secs")]
    pub daily_ann_secs: u64,
    #[serde(default = "default_daily_fee_apy_secs")]
    pub daily_fee_apy_secs: u64,
    #[serde(default = "default_daily_gt_updates_secs")]
    pub daily_gt_updates_secs: u64,
    #[serde(default = "default_daily_prices_secs")]
    pub daily_prices_secs: u64,
    /// Per-token row limit for the annPerformance long/short history backfill.
    #[serde(default = "default_daily_mtp_backfill_limit")]
    pub daily_mtp_backfill_limit: i64,
    /// Max in-flight per-token fetches during that backfill (`buffer_unordered`). `.max(1)` guarded.
    #[serde(default = "default_daily_mtp_backfill_concurrency")]
    pub daily_mtp_backfill_concurrency: usize,
    /// Hard timeout (s) per backfill fetch; a stall counts as a retriable failure.
    #[serde(default = "default_daily_mtp_fetch_timeout_secs")]
    pub daily_mtp_fetch_timeout_secs: u64,
    /// Base-tick period (ms) of the WS push engine (Go's 1s base ticker).
    #[serde(default = "default_ws_tick_ms")]
    pub ws_tick_ms: u64,
    #[serde(default)]
    pub s3: S3Config,
    /// Chainlink Data Streams price fallback for mints the Data Engine can't price (empty credentials disable it).
    #[serde(default)]
    pub chainlink_streams: ChainlinkStreamsConfig,
    /// Candle periods the WS subscription accepts (default = the 8 standard resolutions).
    #[serde(default = "default_valid_periods")]
    pub valid_periods: Vec<String>,
    /// Candle periods computed/streamed directly (must be alignable by `align_ts`).
    #[serde(default = "default_direct_periods")]
    pub direct_periods: Vec<String>,
    /// Chainlink stream subscription batch size (default 5).
    #[serde(default = "default_stream_group_size")]
    pub stream_group_size: usize,
    /// Position-share Open Graph image host.
    #[serde(default = "default_share_image_host")]
    pub share_image_host: String,
    /// Position-share default redirect target.
    #[serde(default = "default_share_redirect_default")]
    pub share_redirect_default: String,
    /// Position-share redirect when `p=g`.
    #[serde(default = "default_share_redirect_gmtrade")]
    pub share_redirect_gmtrade: String,
    /// When true (default), markets whose on-chain `Enabled` flag is unset are
    /// dropped from the snapshot, so indexData / swapList / gtEnabled and every
    /// daily series derived from the snapshot only surface enabled markets —
    /// matching the old Go backend's enabled-only allowlist. Set false to also
    /// surface disabled markets.
    #[serde(default = "default_enabled_markets_only")]
    pub enabled_markets_only: bool,
    /// When true, point the Chainlink legs at their TESTNET endpoints for a devnet/testnet deploy:
    /// the Data Streams client uses `with_testnet_credential` and the Data Engine candle/stream URLs
    /// are rewritten to `priceapi.testnet-dataengine.chain.link`. The Data Engine auth URL is left as
    /// configured (the mainnet auth Lambda yields no testnet-valid token, so those calls fail and the
    /// live price simply falls back to the keeper leg until a testnet auth is wired). Default false
    /// (mainnet). Independent of [`Self::price_candle_first`].
    #[serde(default)]
    pub enable_devnet: bool,
    /// When true, price-candle is the sole direct candle source; Data Engine history, Arbitrum candle
    /// fallback, auth refresh, and candle SSE are disabled. Cluster-agnostic (works on mainnet too).
    /// Default false, which keeps Data Engine first, then Arbitrum and price-candle fallbacks.
    #[serde(default)]
    pub price_candle_first: bool,
}

/// Define a serde-default fn pulling one field from `RuntimeParams::default()`.
macro_rules! runtime_default {
    ($name:ident, $ty:ty, $field:ident) => {
        fn $name() -> $ty {
            crate::runtime::RuntimeParams::default().$field
        }
    };
}

/// Define a serde-default fn returning a constant expression.
macro_rules! const_default {
    ($name:ident, $ty:ty, $value:expr) => {
        fn $name() -> $ty {
            $value
        }
    };
}

runtime_default!(default_valid_periods, Vec<String>, valid_periods);
runtime_default!(default_direct_periods, Vec<String>, direct_periods);
runtime_default!(default_stream_group_size, usize, stream_group_size);
runtime_default!(default_share_image_host, String, share_image_host);
runtime_default!(
    default_share_redirect_default,
    String,
    share_redirect_default
);
runtime_default!(
    default_share_redirect_gmtrade,
    String,
    share_redirect_gmtrade
);
const_default!(default_enabled_markets_only, bool, true);

/// Chainlink Data Streams fallback config: HMAC credentials + refresh cadence (empty credentials disable it).
#[derive(Clone, Default, Deserialize)]
pub struct ChainlinkStreamsConfig {
    /// Data Streams API user id (HMAC). Empty disables the fallback.
    #[serde(default)]
    pub user_id: String,
    /// Data Streams API secret (HMAC). Empty disables the fallback.
    #[serde(default)]
    pub secret: String,
    /// Cadence (s) of the Data Streams bulk_report fetch (default 60, floored at `refresh_secs`).
    #[serde(default = "default_streams_fallback_secs")]
    pub fallback_secs: u64,
}

/// Runtime selection for non-displayable tokens that still need candle history.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ExtraTokenCandlesConfig {
    /// Explicit runtime switch. The capability remains off when this field is omitted.
    #[serde(default)]
    pub enabled: bool,
    /// Token symbols resolved against the Store-authorized TokenMap.
    #[serde(default)]
    pub symbols: Vec<String>,
}

// Keep the HMAC credentials out of `Debug` output.
impl std::fmt::Debug for ChainlinkStreamsConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ChainlinkStreamsConfig")
            .field("user_id", &redacted(&self.user_id))
            .field("secret", &redacted(&self.secret))
            .field("fallback_secs", &self.fallback_secs)
            .finish()
    }
}

/// Render a secret as `"<set>"`/`"<unset>"` for `Debug` (never the value).
fn redacted(value: &str) -> &'static str {
    if value.is_empty() {
        "<unset>"
    } else {
        "<set>"
    }
}

/// Redact an RPC URL for `Debug`/logs: keep `scheme://host`, drop path/query/
/// userinfo (where api keys like `?api-key=` live). Non-URL values (e.g.
/// `"devnet"`) pass through unchanged.
pub(crate) fn redact_url(url: &str) -> String {
    match url.split_once("://") {
        Some((scheme, rest)) => {
            let authority = rest.split(['/', '?']).next().unwrap_or(rest);
            let host = authority.rsplit('@').next().unwrap_or(authority);
            format!("{scheme}://{host}")
        }
        None => url.to_string(),
    }
}

fn default_streams_fallback_secs() -> u64 {
    60
}

/// On-chain token-table source: when enabled, builds the dynamic token table from the store's TokenMap plus the per-token overlay.
#[derive(Clone, Default, Deserialize)]
pub struct TokenSourceConfig {
    #[serde(default)]
    pub enable: bool,
    #[serde(default)]
    pub rpc_url: String,
    #[serde(default)]
    pub store: String,
    /// Per-token operator overrides (decimals_gmx / view_excludes / wrapped / synthetic).
    #[serde(default)]
    pub overlay: crate::tokens::TokenOverlayConfig,
}

// Keep the RPC URL's key out of `Debug`/log output.
impl std::fmt::Debug for TokenSourceConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TokenSourceConfig")
            .field("enable", &self.enable)
            .field("rpc_url", &redact_url(&self.rpc_url))
            .field("store", &self.store)
            .field("overlay", &self.overlay)
            .finish()
    }
}

/// Solana RPC market/GLV source config: `endpoint` (RPC URL) + `store` (store pubkey).
#[derive(Clone, Default, Deserialize)]
pub struct RpcConfig {
    #[serde(default)]
    pub endpoint: String,
    #[serde(default)]
    pub store: String,
}

// Keep the RPC URL's key (e.g. `?api-key=`) out of `Debug`/log output.
impl std::fmt::Debug for RpcConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RpcConfig")
            .field("endpoint", &redact_url(&self.endpoint))
            .field("store", &self.store)
            .finish()
    }
}

fn default_store_balances_refresh_secs() -> u64 {
    60
}

/// Store raw balances cache config. This runtime switch decides whether the background RPC refresh runs.
#[derive(Debug, Clone, Deserialize)]
pub struct StoreBalancesConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_store_balances_refresh_secs")]
    pub refresh_secs: u64,
}

impl Default for StoreBalancesConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            refresh_secs: default_store_balances_refresh_secs(),
        }
    }
}

fn default_token_mints_refresh_secs() -> u64 {
    60
}

fn default_token_mints_max_pubkeys() -> usize {
    256
}

fn default_token_mints_max_pubkeys_param_len() -> usize {
    12 * 1024
}

/// GM/GLV token mint metadata cache config. This runtime switch decides whether
/// refresh and endpoints are live.
#[derive(Debug, Clone, Deserialize)]
pub struct TokenMintsConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_token_mints_refresh_secs")]
    pub refresh_secs: u64,
    #[serde(default = "default_token_mints_max_pubkeys")]
    pub max_pubkeys: usize,
    #[serde(default = "default_token_mints_max_pubkeys_param_len")]
    pub max_pubkeys_param_len: usize,
}

impl Default for TokenMintsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            refresh_secs: default_token_mints_refresh_secs(),
            max_pubkeys: default_token_mints_max_pubkeys(),
            max_pubkeys_param_len: default_token_mints_max_pubkeys_param_len(),
        }
    }
}

fn default_glv_accounts_refresh_secs() -> u64 {
    30
}

/// GLV account body cache config. The runtime switch controls whether the
/// background RPC refresh runs.
#[derive(Debug, Clone, Deserialize)]
pub struct GlvAccountsConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_glv_accounts_refresh_secs")]
    pub refresh_secs: u64,
}

impl Default for GlvAccountsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            refresh_secs: default_glv_accounts_refresh_secs(),
        }
    }
}

/// Default Chainlink-SSE staleness (seconds) after which the keeper fallback fills in — the old Go backend's `staleSec`.
fn default_keeper_stale_secs() -> u64 {
    2
}

/// Keeper (marin) price source config. The graphql-ws subscription feeds the `data_source = Chainlink` price leg, replacing the old Go backend's keeper price subscription.
#[derive(Debug, Clone, Deserialize)]
pub struct KeeperConfig {
    /// Keeper api-server graphql-ws endpoint, e.g. `ws://host:8080/graphql-ws`. Empty disables the keeper price subscription (Chainlink tokens stay unpriced until a fallback fills them).
    #[serde(default)]
    pub graphql_ws_endpoint: String,
    /// Seconds after which a Chainlink Data Engine SSE price is treated as stale and the keeper fallback fills
    /// in for that token (matches the old Go backend's `fillMissingFromKeeper` `staleSec`). Default 2.
    #[serde(default = "default_keeper_stale_secs")]
    pub stale_secs: u64,
}

impl Default for KeeperConfig {
    fn default() -> Self {
        Self {
            graphql_ws_endpoint: String::new(),
            stale_secs: default_keeper_stale_secs(),
        }
    }
}

fn default_keeper_execution_time_stale_secs() -> u64 {
    30
}

/// Keeper market-order execution-time source.
#[derive(Clone, Deserialize)]
pub struct KeeperExecutionTimeConfig {
    /// Explicit runtime switch. Omitted configuration remains disabled.
    #[serde(default)]
    pub enabled: bool,
    /// Required GraphQL WebSocket sources when non-empty. An empty list reuses
    /// `keeper.graphql_ws_endpoint` as one source.
    #[serde(default)]
    pub graphql_ws_endpoints: Vec<String>,
    /// Freshness TTL for the most recently received schema-valid snapshot.
    #[serde(default = "default_keeper_execution_time_stale_secs")]
    pub stale_secs: u64,
}

impl Default for KeeperExecutionTimeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            graphql_ws_endpoints: Vec::new(),
            stale_secs: default_keeper_execution_time_stale_secs(),
        }
    }
}

impl std::fmt::Debug for KeeperExecutionTimeConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("KeeperExecutionTimeConfig")
            .field("enabled", &self.enabled)
            .field("endpoint_count", &self.graphql_ws_endpoints.len())
            .field("stale_secs", &self.stale_secs)
            .finish()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum KeeperExecutionTimeEndpointSource {
    OverrideList,
    SharedKeeper,
}

impl KeeperExecutionTimeEndpointSource {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::OverrideList => "override_list",
            Self::SharedKeeper => "shared_keeper",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum KeeperExecutionTimeEndpointError {
    RuntimeDisabled,
    EndpointMissing,
    EndpointInvalid,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResolvedKeeperExecutionTimeEndpoint {
    pub source_index: usize,
    pub url: url::Url,
    pub source: KeeperExecutionTimeEndpointSource,
    pub log_target: String,
}

const MAX_KEEPER_EXECUTION_TIME_ENDPOINTS: usize = 32;

fn keeper_execution_time_log_target(
    url: &url::Url,
) -> Result<String, KeeperExecutionTimeEndpointError> {
    let host = url
        .host_str()
        .ok_or(KeeperExecutionTimeEndpointError::EndpointInvalid)?;
    let host = if host.contains(':') {
        format!("[{host}]")
    } else {
        host.to_string()
    };
    let port = url
        .port()
        .map(|port| format!(":{port}"))
        .unwrap_or_default();
    Ok(format!("{}://{host}{port}", url.scheme()))
}

fn keeper_execution_time_canonical_key(
    url: &url::Url,
) -> Result<String, KeeperExecutionTimeEndpointError> {
    let mut canonical = url.clone();
    let default_port = match canonical.scheme() {
        "ws" => 80,
        "wss" => 443,
        _ => return Err(KeeperExecutionTimeEndpointError::EndpointInvalid),
    };
    if canonical.port() == Some(default_port) {
        canonical
            .set_port(None)
            .map_err(|_| KeeperExecutionTimeEndpointError::EndpointInvalid)?;
    }
    Ok(canonical.into())
}

pub fn resolve_keeper_execution_time_endpoints(
    config: &KeeperExecutionTimeConfig,
    shared_keeper_endpoint: &str,
) -> Result<Vec<ResolvedKeeperExecutionTimeEndpoint>, KeeperExecutionTimeEndpointError> {
    if !config.enabled {
        return Err(KeeperExecutionTimeEndpointError::RuntimeDisabled);
    }

    let (raw_endpoints, source) = if config.graphql_ws_endpoints.is_empty() {
        let shared = shared_keeper_endpoint.trim();
        if shared.is_empty() {
            return Err(KeeperExecutionTimeEndpointError::EndpointMissing);
        }
        (
            vec![shared],
            KeeperExecutionTimeEndpointSource::SharedKeeper,
        )
    } else {
        (
            config
                .graphql_ws_endpoints
                .iter()
                .map(String::as_str)
                .collect(),
            KeeperExecutionTimeEndpointSource::OverrideList,
        )
    };

    if raw_endpoints.is_empty() || raw_endpoints.len() > MAX_KEEPER_EXECUTION_TIME_ENDPOINTS {
        return Err(KeeperExecutionTimeEndpointError::EndpointInvalid);
    }

    let mut canonical_urls = std::collections::HashSet::with_capacity(raw_endpoints.len());
    let mut resolved = Vec::with_capacity(raw_endpoints.len());
    for (source_index, raw_endpoint) in raw_endpoints.into_iter().enumerate() {
        let raw_endpoint = raw_endpoint.trim();
        if raw_endpoint.is_empty() {
            return Err(KeeperExecutionTimeEndpointError::EndpointInvalid);
        }

        let url = url::Url::parse(raw_endpoint)
            .map_err(|_| KeeperExecutionTimeEndpointError::EndpointInvalid)?;
        if !matches!(url.scheme(), "ws" | "wss") || url.host().is_none() || url.fragment().is_some()
        {
            return Err(KeeperExecutionTimeEndpointError::EndpointInvalid);
        }
        let canonical = keeper_execution_time_canonical_key(&url)?;
        if !canonical_urls.insert(canonical) {
            return Err(KeeperExecutionTimeEndpointError::EndpointInvalid);
        }

        resolved.push(ResolvedKeeperExecutionTimeEndpoint {
            source_index,
            log_target: keeper_execution_time_log_target(&url)?,
            url,
            source,
        });
    }
    Ok(resolved)
}

/// Max length (bytes) for a string query param (`token`/`tokenSymbol`/`period`/`id`); over -> 400. A real pubkey is ~44 chars, a symbol/period far fewer, so 256 is generous headroom while still rejecting abusive blobs.
fn default_max_param_len() -> usize {
    256
}
/// Max length (bytes) of the `/log/p` client string kept in logs; longer is truncated (guards against log flooding).
fn default_max_log_str_len() -> usize {
    2048
}
/// Max upload request-body size (bytes); over -> 413. Default 5 MiB (position-share JPEGs are small).
fn default_max_upload_bytes() -> usize {
    5 * 1024 * 1024
}

/// Abnormal-input limits, all configurable so they can be retuned without a rebuild.
#[derive(Debug, Clone, Deserialize)]
pub struct LimitsConfig {
    #[serde(default = "default_max_param_len")]
    pub max_param_len: usize,
    #[serde(default = "default_max_log_str_len")]
    pub max_log_str_len: usize,
    #[serde(default = "default_max_upload_bytes")]
    pub max_upload_bytes: usize,
}

impl Default for LimitsConfig {
    fn default() -> Self {
        Self {
            max_param_len: default_max_param_len(),
            max_log_str_len: default_max_log_str_len(),
            max_upload_bytes: default_max_upload_bytes(),
        }
    }
}

/// S3 image-upload config (mirrors Go `Config.S3` plus `public_host`); defaults are the Go production values.
#[derive(Debug, Clone, Deserialize)]
pub struct S3Config {
    #[serde(default = "default_s3_region")]
    pub region: String,
    /// Bucket / access-point alias to PutObject into (Go `S3.AccessPointAlias`).
    #[serde(default = "default_s3_bucket")]
    pub bucket: String,
    /// Object key prefix (Go `S3.Prefix`); typically ends with `/`.
    #[serde(default = "default_s3_prefix")]
    pub prefix: String,
    /// Public host the stored object is served from; no trailing slash.
    #[serde(default = "default_s3_public_host")]
    pub public_host: String,
}

impl Default for S3Config {
    fn default() -> Self {
        Self {
            region: default_s3_region(),
            bucket: default_s3_bucket(),
            prefix: default_s3_prefix(),
            public_host: default_s3_public_host(),
        }
    }
}

const_default!(default_s3_region, String, "ap-southeast-1".to_string());
const_default!(default_s3_bucket, String, "gm-data-frontend-sp".to_string());
const_default!(default_s3_prefix, String, "positionsharing/".to_string());
const_default!(
    default_s3_public_host,
    String,
    "https://positionsharing.gmxsolana.io".to_string()
);
const_default!(default_api_address, String, "0.0.0.0:8888".to_string());
const_default!(default_staleness_secs, u64, 30);
const_default!(default_refresh_secs, u64, 5);
const_default!(default_market_list_refresh_secs, u64, 300);
const_default!(default_volume_refresh_secs, u64, 60);
const_default!(default_rebuild_min_interval_ms, u64, 1000);
const_default!(default_candle_refresh_secs, u64, 60);
const_default!(default_candle_prefetch_secs, u64, 30);
const_default!(default_candle_prefetch_limit, i64, 1_000);
const_default!(default_candle_prefetch_concurrency, usize, 8);
const_default!(default_price_candle_batch_target_rows, i64, 10_000);
const_default!(default_price_candle_batch_concurrency, usize, 2);
const_default!(default_cl_auth_refresh_secs, u64, 21600);
const_default!(default_daily_ann_secs, u64, 3600);
const_default!(default_daily_fee_apy_secs, u64, 360);
const_default!(default_daily_gt_updates_secs, u64, 120);
const_default!(default_daily_prices_secs, u64, 3540);
const_default!(default_daily_mtp_backfill_limit, i64, 30_000);
const_default!(default_daily_mtp_backfill_concurrency, usize, 8);
const_default!(default_daily_mtp_fetch_timeout_secs, u64, 30);
const_default!(default_ws_tick_ms, u64, 1000);

fn default_metrics_exporter() -> String {
    "prometheus".to_string()
}

fn default_metrics_port() -> u16 {
    9000
}

fn default_dogstatsd_address() -> String {
    "127.0.0.1:8125".to_string()
}

fn default_heartbeat_interval_secs() -> u64 {
    10
}

/// Process metrics exporter configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct MetricsConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_metrics_exporter")]
    pub exporter: String,
    #[serde(default = "default_metrics_port")]
    pub port: u16,
    #[serde(default = "default_dogstatsd_address")]
    pub dogstatsd_address: String,
    #[serde(default = "default_heartbeat_interval_secs")]
    pub heartbeat_interval_secs: u64,
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            exporter: default_metrics_exporter(),
            port: default_metrics_port(),
            dogstatsd_address: default_dogstatsd_address(),
            heartbeat_interval_secs: default_heartbeat_interval_secs(),
        }
    }
}

impl Config {
    pub fn load(path: &Path) -> eyre::Result<Self> {
        let mut fig = Figment::new();
        if path.exists() {
            fig = fig.merge(Toml::file(path));
        }
        // Structured token overlay as a JSON file (path via env), merged before env so env still wins.
        if let Ok(json_path) = std::env::var("GMSOL_WEB_CONFIG_JSON") {
            fig = fig.merge(Json::file(json_path));
        }
        Self::from_figment(fig.merge(Env::prefixed(ENV_PREFIX).split(DOT_ALIAS)))
    }

    pub fn from_figment(fig: Figment) -> eyre::Result<Self> {
        Ok(fig.extract()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chainlink_streams_debug_redacts_credentials() {
        let cfg = ChainlinkStreamsConfig {
            user_id: "e8c83bb4-secret-id".into(),
            secret: "super-secret-hmac-value".into(),
            fallback_secs: 60,
        };
        let dbg = format!("{cfg:?}");
        // Debug output must not contain either credential value.
        assert!(
            !dbg.contains("e8c83bb4-secret-id"),
            "user_id in debug: {dbg}"
        );
        assert!(
            !dbg.contains("super-secret-hmac-value"),
            "secret in debug: {dbg}"
        );
        assert!(dbg.contains("<set>"), "should mark creds as set: {dbg}");
        // An unset secret reads as <unset>.
        let empty = ChainlinkStreamsConfig::default();
        assert!(format!("{empty:?}").contains("<unset>"));
    }

    #[test]
    fn defaults_apply_when_no_file() {
        let cfg = Config::from_figment(figment::Figment::new()).unwrap();
        assert_eq!(cfg.api_address, "0.0.0.0:8888");
        assert_eq!(cfg.staleness_secs, 30);
        assert_eq!(cfg.refresh_secs, 5);
        assert_eq!(cfg.market_list_refresh_secs, 300);
        assert_eq!(cfg.volume_refresh_secs, 60);
        assert_eq!(cfg.rebuild_min_interval_ms, 1000);
        assert_eq!(cfg.candle_refresh_secs, 60);
        assert_eq!(cfg.candle_prefetch_secs, 30);
        assert_eq!(cfg.candle_prefetch_limit, 1_000);
        assert_eq!(cfg.candle_prefetch_concurrency, 8);
        assert_eq!(cfg.price_candle_batch_max_rows, 0);
        assert_eq!(cfg.price_candle_batch_target_rows, 10_000);
        assert_eq!(cfg.price_candle_batch_concurrency, 2);
        assert!(!cfg.store_balances.enabled);
        assert_eq!(cfg.store_balances.refresh_secs, 60);
        assert!(!cfg.token_mints.enabled);
        assert_eq!(cfg.token_mints.refresh_secs, 60);
        assert_eq!(cfg.token_mints.max_pubkeys, 256);
        assert_eq!(cfg.token_mints.max_pubkeys_param_len, 12 * 1024);
        assert!(!cfg.glv_accounts.enabled);
        assert_eq!(cfg.glv_accounts.refresh_secs, 30);
        assert!(!cfg.extra_token_candles.enabled);
        assert!(cfg.extra_token_candles.symbols.is_empty());
        assert_eq!(cfg.cl_auth_refresh_secs, 21600);
        assert_eq!(cfg.daily_ann_secs, 3600);
        assert_eq!(cfg.daily_fee_apy_secs, 360);
        assert_eq!(cfg.daily_gt_updates_secs, 120);
        assert_eq!(cfg.daily_prices_secs, 3540);
        assert_eq!(cfg.ws_tick_ms, 1000);
    }

    #[test]
    fn env_overrides_default() {
        figment::Jail::expect_with(|jail| {
            jail.set_env("GMSOL_WEB_API_ADDRESS", "127.0.0.1:9999");
            jail.set_env("GMSOL_WEB_CANDLE_PREFETCH_LIMIT", "750");
            jail.set_env("GMSOL_WEB_PRICE_CANDLE_BATCH_MAX_ROWS", "100000");
            jail.set_env("GMSOL_WEB_PRICE_CANDLE_BATCH_TARGET_ROWS", "12500");
            jail.set_env("GMSOL_WEB_PRICE_CANDLE_BATCH_CONCURRENCY", "3");
            let cfg = Config::load(std::path::Path::new("/nonexistent.toml")).unwrap();
            assert_eq!(cfg.api_address, "127.0.0.1:9999");
            assert_eq!(cfg.candle_prefetch_limit, 750);
            assert_eq!(cfg.price_candle_batch_max_rows, 100_000);
            assert_eq!(cfg.price_candle_batch_target_rows, 12_500);
            assert_eq!(cfg.price_candle_batch_concurrency, 3);
            Ok(())
        });
    }

    #[test]
    fn metrics_config_defaults_when_section_is_missing() {
        let cfg = Config::from_figment(figment::Figment::new()).unwrap();

        assert!(!cfg.metrics.enabled);
        assert_eq!(cfg.metrics.exporter, "prometheus");
        assert_eq!(cfg.metrics.port, 9000);
        assert_eq!(cfg.metrics.dogstatsd_address, "127.0.0.1:8125");
        assert_eq!(cfg.metrics.heartbeat_interval_secs, 10);
    }

    #[test]
    fn metrics_config_defaults_when_section_is_partial() {
        let fig = figment::Figment::new().merge(figment::providers::Serialized::defaults(
            serde_json::json!({
                "metrics": {
                    "enabled": true
                }
            }),
        ));
        let cfg = Config::from_figment(fig).unwrap();

        assert!(cfg.metrics.enabled);
        assert_eq!(cfg.metrics.exporter, "prometheus");
        assert_eq!(cfg.metrics.port, 9000);
        assert_eq!(cfg.metrics.dogstatsd_address, "127.0.0.1:8125");
        assert_eq!(cfg.metrics.heartbeat_interval_secs, 10);
    }

    #[test]
    fn metrics_config_loads_nested_environment_overrides() {
        figment::Jail::expect_with(|jail| {
            jail.set_env("GMSOL_WEB_METRICS__ENABLED", "true");
            jail.set_env("GMSOL_WEB_METRICS__EXPORTER", "dogstatsd");
            jail.set_env("GMSOL_WEB_METRICS__PORT", "9100");
            jail.set_env("GMSOL_WEB_METRICS__DOGSTATSD_ADDRESS", "127.0.0.1:18125");
            jail.set_env("GMSOL_WEB_METRICS__HEARTBEAT_INTERVAL_SECS", "7");

            let cfg = Config::load(std::path::Path::new("/nonexistent.toml")).unwrap();

            assert!(cfg.metrics.enabled);
            assert_eq!(cfg.metrics.exporter, "dogstatsd");
            assert_eq!(cfg.metrics.port, 9100);
            assert_eq!(cfg.metrics.dogstatsd_address, "127.0.0.1:18125");
            assert_eq!(cfg.metrics.heartbeat_interval_secs, 7);
            Ok(())
        });
    }

    #[test]
    fn store_balances_config_defaults_disabled_and_can_enable() {
        figment::Jail::expect_with(|jail| {
            jail.create_file(
                "config.toml",
                r#"
                    [store_balances]
                    enabled = true
                    refresh_secs = 15
                "#,
            )?;
            let cfg = Config::load(std::path::Path::new("config.toml")).unwrap();
            assert!(cfg.store_balances.enabled);
            assert_eq!(cfg.store_balances.refresh_secs, 15);
            Ok(())
        });
    }

    #[test]
    fn glv_accounts_config_defaults_disabled_and_can_enable() {
        figment::Jail::expect_with(|jail| {
            jail.create_file(
                "config.toml",
                r#"
                    [glv_accounts]
                    enabled = true
                    refresh_secs = 15
                "#,
            )?;
            let cfg = Config::load(std::path::Path::new("config.toml")).unwrap();
            assert!(cfg.glv_accounts.enabled);
            assert_eq!(cfg.glv_accounts.refresh_secs, 15);
            Ok(())
        });
    }

    #[test]
    fn token_mints_config_defaults_disabled_and_can_enable() {
        let fig = figment::Figment::new().merge(figment::providers::Serialized::defaults(
            serde_json::json!({
                "token_mints": {
                    "enabled": true,
                    "refresh_secs": 15,
                    "max_pubkeys": 3,
                    "max_pubkeys_param_len": 128
                }
            }),
        ));
        let cfg = Config::from_figment(fig).unwrap();
        assert!(cfg.token_mints.enabled);
        assert_eq!(cfg.token_mints.refresh_secs, 15);
        assert_eq!(cfg.token_mints.max_pubkeys, 3);
        assert_eq!(cfg.token_mints.max_pubkeys_param_len, 128);
    }

    #[test]
    fn extra_token_candles_config_defaults_disabled_and_empty() {
        let cfg = Config::from_figment(figment::Figment::new()).unwrap();
        assert!(!cfg.extra_token_candles.enabled);
        assert!(cfg.extra_token_candles.symbols.is_empty());
    }

    #[test]
    fn extra_token_candles_config_can_enable_with_symbols() {
        let fig = figment::Figment::new().merge(figment::providers::Serialized::defaults(
            serde_json::json!({
                "extra_token_candles": {
                    "enabled": true,
                    "symbols": ["USDC"]
                }
            }),
        ));
        let cfg = Config::from_figment(fig).unwrap();
        assert!(cfg.extra_token_candles.enabled);
        assert_eq!(cfg.extra_token_candles.symbols, ["USDC"]);
    }

    #[test]
    fn keeper_execution_time_config_defaults_disabled() {
        let cfg = Config::from_figment(figment::Figment::new()).unwrap();
        assert!(!cfg.keeper_execution_time.enabled);
        assert!(cfg.keeper_execution_time.graphql_ws_endpoints.is_empty());
        assert_eq!(cfg.keeper_execution_time.stale_secs, 30);
    }

    #[test]
    fn keeper_execution_time_config_deserializes_endpoint_list() {
        let fig = figment::Figment::new().merge(figment::providers::Serialized::defaults(
            serde_json::json!({
                "keeper_execution_time": {
                    "enabled": true,
                    "graphql_ws_endpoints": [
                        "wss://execution-a.example/graphql-ws",
                        "wss://execution-b.example/graphql-ws"
                    ],
                    "stale_secs": 45
                }
            }),
        ));
        let cfg = Config::from_figment(fig).unwrap();
        assert!(cfg.keeper_execution_time.enabled);
        assert_eq!(
            cfg.keeper_execution_time.graphql_ws_endpoints,
            [
                "wss://execution-a.example/graphql-ws",
                "wss://execution-b.example/graphql-ws"
            ]
        );
        assert_eq!(cfg.keeper_execution_time.stale_secs, 45);
    }

    #[test]
    fn keeper_execution_time_config_deserializes_endpoint_list_from_env_json() {
        figment::Jail::expect_with(|jail| {
            jail.set_env("GMSOL_WEB_KEEPER_EXECUTION_TIME__ENABLED", "true");
            jail.set_env(
                "GMSOL_WEB_KEEPER_EXECUTION_TIME__GRAPHQL_WS_ENDPOINTS",
                r#"["wss://execution-a.example/graphql-ws","wss://execution-b.example/graphql-ws"]"#,
            );
            let cfg = Config::load(std::path::Path::new("/nonexistent.toml")).unwrap();
            assert_eq!(
                cfg.keeper_execution_time.graphql_ws_endpoints,
                [
                    "wss://execution-a.example/graphql-ws",
                    "wss://execution-b.example/graphql-ws"
                ]
            );
            Ok(())
        });
    }

    #[test]
    fn keeper_execution_time_endpoint_resolution_precedence() {
        let disabled = KeeperExecutionTimeConfig {
            enabled: false,
            graphql_ws_endpoints: vec!["not a url".into()],
            stale_secs: 30,
        };
        assert_eq!(
            resolve_keeper_execution_time_endpoints(&disabled, "also invalid"),
            Err(KeeperExecutionTimeEndpointError::RuntimeDisabled)
        );

        let override_config = KeeperExecutionTimeConfig {
            enabled: true,
            graphql_ws_endpoints: vec![
                "wss://user:password@override-a.example:8443/graphql-ws?token=secret".into(),
                "wss://override-b.example/graphql-ws".into(),
            ],
            stale_secs: 30,
        };
        let resolved = resolve_keeper_execution_time_endpoints(
            &override_config,
            "wss://shared.example/graphql-ws",
        )
        .unwrap();
        assert_eq!(resolved.len(), 2);
        assert_eq!(resolved[0].source_index, 0);
        assert_eq!(
            resolved[0].source,
            KeeperExecutionTimeEndpointSource::OverrideList
        );
        assert_eq!(resolved[0].log_target, "wss://override-a.example:8443");
        assert_eq!(resolved[1].source_index, 1);

        let shared_config = KeeperExecutionTimeConfig {
            enabled: true,
            graphql_ws_endpoints: Vec::new(),
            stale_secs: 30,
        };
        let resolved = resolve_keeper_execution_time_endpoints(
            &shared_config,
            "wss://shared.example/graphql-ws",
        )
        .unwrap();
        assert_eq!(resolved.len(), 1);
        assert_eq!(
            resolved[0].source,
            KeeperExecutionTimeEndpointSource::SharedKeeper
        );
        assert_eq!(resolved[0].log_target, "wss://shared.example");

        assert_eq!(
            resolve_keeper_execution_time_endpoints(&shared_config, ""),
            Err(KeeperExecutionTimeEndpointError::EndpointMissing)
        );
        assert_eq!(
            resolve_keeper_execution_time_endpoints(&shared_config, "https://shared.example"),
            Err(KeeperExecutionTimeEndpointError::EndpointInvalid)
        );

        let invalid_override = KeeperExecutionTimeConfig {
            enabled: true,
            graphql_ws_endpoints: vec!["https://override.example".into()],
            stale_secs: 30,
        };
        assert_eq!(
            resolve_keeper_execution_time_endpoints(
                &invalid_override,
                "wss://shared.example/graphql-ws"
            ),
            Err(KeeperExecutionTimeEndpointError::EndpointInvalid)
        );
    }

    #[test]
    fn keeper_execution_time_endpoint_list_validation() {
        let config = |graphql_ws_endpoints: Vec<String>| KeeperExecutionTimeConfig {
            enabled: true,
            graphql_ws_endpoints,
            stale_secs: 30,
        };

        let endpoints = (0..32)
            .map(|index| format!("wss://keeper-{index}.example/graphql-ws"))
            .collect();
        assert_eq!(
            resolve_keeper_execution_time_endpoints(&config(endpoints), "")
                .unwrap()
                .len(),
            32
        );
        let too_many = (0..33)
            .map(|index| format!("wss://keeper-{index}.example/graphql-ws"))
            .collect();
        assert_eq!(
            resolve_keeper_execution_time_endpoints(&config(too_many), ""),
            Err(KeeperExecutionTimeEndpointError::EndpointInvalid)
        );

        for invalid in [
            vec!["".into()],
            vec!["https://keeper.example/graphql-ws".into()],
            vec!["wss://keeper.example/graphql-ws#fragment".into()],
            vec![
                "wss://keeper.example/graphql-ws".into(),
                "WSS://KEEPER.EXAMPLE:443/graphql-ws".into(),
            ],
        ] {
            assert_eq!(
                resolve_keeper_execution_time_endpoints(
                    &config(invalid),
                    "wss://shared.example/graphql-ws"
                ),
                Err(KeeperExecutionTimeEndpointError::EndpointInvalid)
            );
        }

        let distinct_resources = config(vec![
            "wss://keeper.example/graphql-ws?role=a".into(),
            "wss://keeper.example/other?role=a".into(),
        ]);
        assert_eq!(
            resolve_keeper_execution_time_endpoints(&distinct_resources, "")
                .unwrap()
                .len(),
            2
        );
    }

    #[test]
    fn keeper_execution_time_config_debug_redacts_endpoints() {
        let cfg = KeeperExecutionTimeConfig {
            enabled: true,
            graphql_ws_endpoints: vec![
                "wss://user:password@example.com/graphql-ws?token=super-secret".into(),
            ],
            stale_secs: 30,
        };
        let debug = format!("{cfg:?}");
        assert!(debug.contains("endpoint_count: 1"));
        assert!(!debug.contains("user"));
        assert!(!debug.contains("password"));
        assert!(!debug.contains("example.com"));
        assert!(!debug.contains("super-secret"));

        let empty = KeeperExecutionTimeConfig::default();
        assert!(format!("{empty:?}").contains("endpoint_count: 0"));
    }

    #[test]
    fn json_overlay_file_populates_token_source_overlay() {
        figment::Jail::expect_with(|jail| {
            jail.create_file(
                "overlay.json",
                r#"{"token_source":{"overlay":{
                    "decimals_gmx":{"ZEC":18},
                    "synthetic":["ZEC"],
                    "data_source_gmx":["SOL"],
                    "data_source_none":["WSOL"],
                    "usd_based_false":["USDJPY"],
                    "view_excludes":["USDC"],
                    "wrapped":{"SOL":"wsolMint"}
                }}}"#,
            )?;
            let path = jail.directory().join("overlay.json");
            jail.set_env("GMSOL_WEB_CONFIG_JSON", path.to_str().unwrap());
            let cfg = Config::load(std::path::Path::new("/nonexistent.toml")).unwrap();
            let ov = &cfg.token_source.overlay;
            assert_eq!(ov.decimals_gmx.get("ZEC"), Some(&18));
            assert!(ov.synthetic.contains("ZEC"));
            assert!(ov.data_source_gmx.contains("SOL"));
            assert!(ov.data_source_none.contains("WSOL"));
            assert!(ov.usd_based_false.contains("USDJPY"));
            assert!(ov.view_excludes.contains("USDC"));
            assert_eq!(ov.wrapped.get("SOL").map(String::as_str), Some("wsolMint"));
            Ok(())
        });
    }
}
