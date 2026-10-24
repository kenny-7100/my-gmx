//! Shared application state and the in-memory [`Snapshot`] DTO blob, atomically swapped by the refresh loop via [`arc_swap::ArcSwap`].

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use arc_swap::ArcSwap;

use crate::aggregate::swap::Candle24h;
use crate::config::Config;
use crate::dto::{GtUpdate, PoolLineData, PriceLineData};
use crate::health::Health;
use crate::sources::{candles::CandleSource, sqd::SqdSource};

/// The atomically-swapped DTO blob handlers read; holds only the hot keeper/sqd aggregates (daily series and candle windows are served on-demand, NOT stored here).
///
/// Fields are `Arc<Vec<_>>` so HTTP handlers and the WS push serve them by cloning an `Arc`
/// (a refcount bump) instead of deep-cloning the whole Vec on every request/tick.
#[derive(Clone, Default)]
pub struct Snapshot {
    /// Per-index-token rollups — HTTP `indexData` / WS `indexTokens`.
    pub index_infos: Arc<Vec<crate::dto::IndexInfo>>,
    /// HTTP v1 `tickers`.
    pub tickers: Arc<Vec<crate::dto::Ticker>>,
    /// HTTP v2 `tickers`.
    pub tickers_v2: Arc<Vec<crate::dto::Ticker>>,
    /// WS `tickers` topic.
    pub sol_tickers: Arc<Vec<crate::dto::SolTicker>>,
    /// WS `swapList` topic.
    pub swap_list: Arc<Vec<crate::dto::SwapTokenResp>>,
}

/// Candle-derived 24h aggregates in their own ArcSwap, written by the candle-refresh ticker and read by the main refresh loop.
#[derive(Clone, Default)]
pub struct CandleData {
    /// `index_token_address -> percentChange24h` bps string, present only for symbols with exactly 24 1h candles (absent -> "0").
    pub percent_change_24h: HashMap<String, String>,
    /// `token_symbol -> Candle24h` for the swap list, keyed by SYMBOL for `build_swap_list` lookup.
    pub swap_24h: HashMap<String, Candle24h>,
}

/// Pre-aggregated candle cache keyed `(query_symbol, period)` with newest-first `[ts,o,h,l,c]` rows, read only by [`crate::sources::candles::CandleSource`].
#[derive(Clone, Default)]
pub struct CandleCache {
    /// `(query_symbol, period) -> newest-first OHLC rows`.
    pub candles: HashMap<(String, String), Vec<[f64; 5]>>,
}

/// Live forming-candle tip keyed `(query_symbol, period)`, written by the active live-price subscription and merged into the newest candle by the read paths.
pub type CandleTip = Arc<Mutex<HashMap<(String, String), [f64; 5]>>>;

/// A fresh, empty [`CandleTip`].
pub fn new_candle_tip() -> CandleTip {
    Arc::new(Mutex::new(HashMap::new()))
}

/// Live Chainlink Data Engine SSE spot prices keyed by query symbol with value `(price_raw, ts)` (single price, no spread; `ts` is the stream tick time). Written by the candle stream task, the PRIMARY price for the `data_source = Chainlink` leg.
pub type ClPrices = Arc<Mutex<HashMap<String, (u128, i64)>>>;

/// A fresh, empty [`ClPrices`].
pub fn new_cl_prices() -> ClPrices {
    Arc::new(Mutex::new(HashMap::new()))
}

/// Live keeper (marin) spot prices for the `data_source = Chainlink` leg, keyed by token mint pubkey with value `(min_unit_price, max_unit_price, ts)`. `min/max` are the keeper GraphQL `to_unit_price` (`P*10^(20-decimals)`). Written by the keeper graphql-ws subscription, the FALLBACK used only when the SSE price is missing or stale (matching the old Go backend's `fillMissingFromKeeper`).
pub type KeeperPrices = Arc<Mutex<HashMap<String, (u128, u128, i64)>>>;

/// A fresh, empty [`KeeperPrices`].
pub fn new_keeper_prices() -> KeeperPrices {
    Arc::new(Mutex::new(HashMap::new()))
}

/// Pre-aggregated daily-series cache for `GET /v2/cache/daily/*`, background-warmed so requests never hit sqd.
#[derive(Clone, Default)]
pub struct DailyCache {
    /// `days` (resolved window `30/90/180`, `-1` = "all") → annPerformance series.
    pub ann_performance: HashMap<i64, Vec<PoolLineData>>,
    /// `days` → feeApy series.
    pub fee_apy: HashMap<i64, Vec<PoolLineData>>,
    /// `(market_token, days)` → gmPrices series.
    pub gm_prices: HashMap<(String, i64), Vec<PriceLineData>>,
    /// `(glv_token, days)` → glvPrices series.
    pub glv_prices: HashMap<(String, i64), Vec<PriceLineData>>,
    /// Global gtUpdates series, pre-warmed at the default limit.
    pub gt_updates: Vec<GtUpdate>,
}

/// Cloneable, `Arc`-backed handle to all shared service state, passed by value into the router state and refresh task.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub sqd: SqdSource,
    /// Reader over the pre-aggregated [`CandleCache`]; call sites read the cache, never the network.
    pub candles: CandleSource,
    /// Tower service for the sqd 24h-volume path, driven via `oneshot` per refresh tick.
    pub sqd_volumes: gmsol_sqd_client::SqdService,
    pub snapshot: Arc<ArcSwap<Snapshot>>,
    /// Candle-derived 24h aggregates in their own ArcSwap, written by the candle-refresh ticker and read by the main refresh loop.
    pub candle_data: Arc<ArcSwap<CandleData>>,
    /// Pre-aggregated daily series in their own ArcSwap, feeding the `daily/*` handlers (see [`DailyCache`]).
    pub daily_cache: Arc<ArcSwap<DailyCache>>,
    /// Store raw balances cache, warmed by a dedicated Solana RPC refresh loop when enabled.
    pub store_balances: crate::sources::store_balances::StoreBalancesHandle,
    /// GM/GLV token mint metadata cache, warmed from the market/GLV refresh loop.
    pub token_mints: crate::token_mints::TokenMintsHandle,
    /// Latest discovered market/GLV universe for the independent token mints refresh loop.
    pub token_mints_market_list:
        Arc<arc_swap::ArcSwapOption<crate::sources::rpc_markets::MarketList>>,
    /// GLV account body cache, warmed by a dedicated Solana RPC refresh loop.
    pub glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle,
    /// Pre-aggregated candle windows (prefetch ticker → read only via [`AppState::candles`]). Separate ArcSwap. See [`CandleCache`].
    pub candle_cache: Arc<ArcSwap<CandleCache>>,
    /// Live forming-candle tip (active live-price subscription → merged by the candle read paths). See [`CandleTip`].
    pub candle_tip: CandleTip,
    /// Arbitrum GMX tickers client (price source for `data_source = Gmx` tokens).
    pub arbitrum: crate::sources::arbitrum_tickers::ArbitrumTickerClient,
    /// Live Chainlink Data Engine SSE spot prices — PRIMARY source for `data_source = Chainlink` tokens. See [`ClPrices`].
    pub cl_prices: ClPrices,
    /// Live keeper (marin) spot prices — FALLBACK for `data_source = Chainlink` tokens (SSE missing/stale). See [`KeeperPrices`].
    pub keeper_prices: KeeperPrices,
    /// Keeper market-order execution-time cache.
    pub keeper_execution_time: crate::sources::keeper_execution_time::KeeperExecutionTimeHandle,
    /// Last Arbitrum ticker raw prices (`symbol -> (min,max)`), published each rebuild so the WS `tickers` push stays sub-second for Chainlink tokens.
    pub arbitrum_prices: Arc<ArcSwap<HashMap<String, (u128, u128)>>>,
    /// On-chain GLVs (RPC), published by the refresh loop for [`crate::daily_refresh`].
    pub glvs: Arc<ArcSwap<Vec<crate::sources::rpc_markets::RpcGlv>>>,
    /// Last discovered GLV PDA universe, published by the market-list discovery loop for the GLV account body refresh.
    pub glv_refs: Arc<ArcSwap<Option<Vec<crate::sources::rpc_markets::GlvRef>>>>,
    /// Last-good 24h volume map (`market_token -> raw volume24h`), kept across sqd failures (overwritten only on non-empty success) so a flaky sqd never zeroes displayed volume.
    pub volumes: Arc<ArcSwap<HashMap<String, String>>>,
    /// Current Chainlink Data Engine access token (`None` before first fetch), refreshed on `cl_auth_refresh_secs`, keep-previous-on-error. Separate ArcSwap.
    pub cl_auth_token: Arc<ArcSwap<Option<String>>>,
    /// The Chainlink Data Engine candle client (auth + `history/rows`), used off the request path by the auth refresher and prefetch ticker.
    pub chainlink_candle: crate::sources::chainlink_candle::ChainlinkCandleClient,
    /// price-candle GraphQL candle fallback used by the prefetch ticker when the Data Engine + Arbitrum
    /// return nothing for a token (keeper-priced markets). Disabled when the endpoint is empty.
    pub price_candle: gmsol_price_candle_client::PriceCandleService,
    /// S3 image uploader for `POST /v2/upload`, a trait object so tests can inject a mock.
    pub uploader: Arc<dyn crate::s3::S3Uploader>,
    pub health: Health,
    /// Shared-topic broadcast senders for the WS `/ws` push engine (see [`crate::ws`]).
    pub ws: crate::ws::WsBroadcast,
    /// Durable Redis (MemoryDB) history store, `None` when disabled to run purely in-memory (see [`crate::redis_store`]).
    pub redis: Option<crate::redis_store::RedisStore>,
    /// Chainlink Data Streams price-fallback client for exotic mints, disabled when credentials are empty (see [`crate::sources::chainlink_streams`]).
    pub chainlink_streams: crate::sources::chainlink_streams::ChainlinkStreamsClient,
    /// Last-good Data Streams fallback prices, kept across failures and merged into the price set by the rebuild for unpriced mints.
    pub streams_prices: Arc<ArcSwap<Vec<gmsol_keeper_client::FetchedPrice>>>,
}

impl AppState {
    /// Load the current snapshot (wait-free `Arc` clone).
    pub fn snapshot(&self) -> Arc<Snapshot> {
        self.snapshot.load_full()
    }

    /// Load the current pre-aggregated daily cache (wait-free `Arc` clone).
    pub fn daily_cache(&self) -> Arc<DailyCache> {
        self.daily_cache.load_full()
    }
}

#[cfg(test)]
pub(crate) fn extra_candle_test_state(config: Config) -> AppState {
    let test_http = || reqwest::Client::builder().no_proxy().build().unwrap();
    let sqd_service =
        gmsol_sqd_client::SqdService::with_http_client(config.sqd.clone(), test_http());
    let candle_cache = Arc::new(ArcSwap::from_pointee(CandleCache::default()));
    let candle_tip = new_candle_tip();
    let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
        config.arbitrum.clone(),
    )
    .unwrap();
    let chainlink_candle = crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
        config.chainlink_candle.clone(),
        config.enable_devnet,
    )
    .unwrap();
    let price_candle = gmsol_price_candle_client::PriceCandleService::with_http_client(
        config.price_candle.clone(),
        test_http(),
    )
    .unwrap();
    let chainlink_streams = crate::sources::chainlink_streams::ChainlinkStreamsClient::new(
        String::new(),
        String::new(),
        HashMap::new(),
        config.enable_devnet,
    )
    .unwrap();
    let config = Arc::new(config);

    AppState {
        config,
        sqd: SqdSource::new(sqd_service.clone()),
        candles: CandleSource::new(candle_cache.clone(), candle_tip.clone()),
        sqd_volumes: sqd_service,
        snapshot: Arc::new(ArcSwap::from_pointee(Snapshot::default())),
        candle_data: Arc::new(ArcSwap::from_pointee(CandleData::default())),
        daily_cache: Arc::new(ArcSwap::from_pointee(DailyCache::default())),
        store_balances: crate::sources::store_balances::StoreBalancesHandle::default(),
        token_mints: crate::token_mints::TokenMintsHandle::default(),
        token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
        glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle::default(),
        candle_cache,
        candle_tip,
        arbitrum,
        cl_prices: new_cl_prices(),
        keeper_prices: new_keeper_prices(),
        keeper_execution_time:
            crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::default(),
        arbitrum_prices: Arc::new(ArcSwap::from_pointee(HashMap::new())),
        glvs: Arc::new(ArcSwap::from_pointee(Vec::new())),
        glv_refs: Arc::new(ArcSwap::from_pointee(None)),
        volumes: Arc::new(ArcSwap::from_pointee(HashMap::new())),
        cl_auth_token: Arc::new(ArcSwap::from_pointee(None)),
        chainlink_candle,
        price_candle,
        uploader: Arc::new(crate::s3::AwsS3UploaderUnused),
        health: Health::new(30),
        ws: crate::ws::WsBroadcast::new(),
        redis: None,
        chainlink_streams,
        streams_prices: Arc::new(ArcSwap::from_pointee(Vec::new())),
    }
}

// Lets axum extract `Health` as a sub-state of the `AppState` router state.
impl axum::extract::FromRef<AppState> for Health {
    fn from_ref(state: &AppState) -> Health {
        state.health.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A refresh tick stores a snapshot AND calls `record_tick`; after both, the health gate reports fresh and the snapshot reflects the store.
    #[test]
    fn store_and_record_tick_mechanics() {
        let snapshot = Arc::new(ArcSwap::from_pointee(Snapshot::default()));
        let health = Health::new(30);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        assert!(!health.is_fresh_now(now), "must start not-fresh");

        let new_snap = Snapshot {
            sol_tickers: Arc::new(vec![crate::dto::SolTicker {
                symbol: "SOL".to_string(),
                min_unit_price: "1".to_string(),
                max_unit_price: "2".to_string(),
                price: "1".to_string(),
                unit_price: "1".to_string(),
                timestamp: 1,
            }]),
            ..Default::default()
        };
        snapshot.store(Arc::new(new_snap));
        health.record_tick();

        assert_eq!(snapshot.load_full().sol_tickers.len(), 1);
        let now2 = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        assert!(health.is_fresh_now(now2), "must be fresh after record_tick");
    }
}
