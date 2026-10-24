//! HTTP endpoints serving the legacy Go web-backend contract.

pub mod candles;
pub mod daily;
pub mod glvs;
pub mod index_data;
pub mod keeper_metrics;
pub mod log_p;
pub mod share;
pub mod store_balances;
pub mod tickers;
pub mod token_mints;
pub mod upload;

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

use crate::state::AppState;

pub fn routes(router: Router<AppState>) -> Router<AppState> {
    let router = router
        .route("/cache/prices/tickers", get(tickers::tickers_v1))
        .route("/v2/cache/prices/tickers", get(tickers::tickers_v2))
        .route("/v2/cache/prices/indexData", get(index_data::index_data))
        .route("/v2/cache/prices/candles", get(candles::candles))
        .route(
            "/v2/cache/daily/annPerformance",
            get(daily::ann_performance),
        )
        .route("/v2/cache/daily/feeApy", get(daily::fee_apy))
        .route("/v2/cache/daily/gmPrices", get(daily::gm_prices))
        .route("/v2/cache/daily/glvPrices", get(daily::glv_prices))
        .route("/v2/cache/daily/gtUpdates", get(daily::gt_updates))
        .route("/log/p", get(log_p::log_p))
        .route("/api/s", get(share::share))
        .route("/v2/upload", post(upload::upload));
    let router = router.route(
        "/v2/cache/store/balances",
        get(store_balances::store_balances),
    );
    let router = router.route("/v2/cache/store/tokenMints", get(token_mints::token_mints));
    let router = router.route("/v2/cache/glvs", get(glvs::glvs));
    router.route("/v2/cache/keeper/metrics", get(keeper_metrics::metrics))
}

/// Reject an over-long string query param (`> max` bytes) with `400`, bounding Redis-key / allocation /
/// log growth from abnormal input (e.g. a megabyte-long `token`). `max` is config-driven (`limits.max_param_len`).
pub(crate) fn check_param_len(value: &str, max: usize) -> Result<(), axum::http::StatusCode> {
    if value.len() > max {
        Err(axum::http::StatusCode::BAD_REQUEST)
    } else {
        Ok(())
    }
}

/// Base58 alphabet (Bitcoin/Solana) — the ASCII alnum set minus the ambiguous `0 O I l`.
fn is_base58(value: &str) -> bool {
    value.bytes().all(|b| {
        matches!(b,
            b'1'..=b'9' | b'A'..=b'H' | b'J'..=b'N' | b'P'..=b'Z' | b'a'..=b'k' | b'm'..=b'z')
    })
}

/// Validate a token-pubkey param: `> max` bytes, outside the 32..=44 base58-length band, or any
/// non-base58 byte → `400`. Rejects garbage before it is concatenated into a Redis key and run
/// against the store, while a real base58 pubkey (43-44 chars) always passes.
pub(crate) fn check_pubkey(value: &str, max: usize) -> Result<(), axum::http::StatusCode> {
    check_param_len(value, max)?;
    if (32..=44).contains(&value.len()) && is_base58(value) {
        Ok(())
    } else {
        Err(axum::http::StatusCode::BAD_REQUEST)
    }
}

/// Validate a token-symbol param: `> max` bytes, empty, longer than 32, or any non-ASCII-alphanumeric
/// byte → `400`. Every real symbol is short ASCII alnum (e.g. `SOL`, `FARTCOIN`), so this rejects
/// garbage Redis-key fragments without touching legitimate input; digits are allowed for forward
/// compatibility (e.g. a future `1000PEPE`).
pub(crate) fn check_symbol(value: &str, max: usize) -> Result<(), axum::http::StatusCode> {
    check_param_len(value, max)?;
    if (1..=32).contains(&value.len()) && value.bytes().all(|b| b.is_ascii_alphanumeric()) {
        Ok(())
    } else {
        Err(axum::http::StatusCode::BAD_REQUEST)
    }
}

/// CORS layer matching the Go `CorsMiddleware` (allow-origin `*`, listed methods/headers, max-age 86400).
pub fn cors_layer() -> CorsLayer {
    use axum::http::{header, HeaderName, Method};

    CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([
            Method::POST,
            Method::GET,
            Method::OPTIONS,
            Method::PUT,
            Method::DELETE,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
        .expose_headers([
            header::CONTENT_LENGTH,
            header::CONTENT_TYPE,
            HeaderName::from_static("x-user-country"),
        ])
        .max_age(std::time::Duration::from_secs(86400))
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use axum::{
        body::Body,
        http::{Method, Request, StatusCode},
    };
    use serde_json::Value;
    use tower::ServiceExt;

    use super::*;
    use crate::state::{AppState, Snapshot};

    fn test_http_client() -> reqwest::Client {
        reqwest::Client::builder().no_proxy().build().unwrap()
    }

    fn test_sqd_service() -> gmsol_sqd_client::SqdService {
        gmsol_sqd_client::SqdService::with_http_client(Default::default(), test_http_client())
    }

    fn test_price_candle_service() -> gmsol_price_candle_client::PriceCandleService {
        gmsol_price_candle_client::PriceCandleService::with_http_client(
            Default::default(),
            test_http_client(),
        )
        .unwrap()
    }

    fn app_with_snapshot(snapshot: Snapshot) -> Router {
        app_with_snapshot_and_uploader(snapshot, Arc::new(crate::s3::AwsS3UploaderUnused))
    }

    fn app_with_snapshot_and_uploader(
        snapshot: Snapshot,
        uploader: Arc<dyn crate::s3::S3Uploader>,
    ) -> Router {
        let config = crate::config::Config::from_figment(figment::Figment::new()).unwrap();
        let sqd = test_sqd_service();
        let candle_cache = Arc::new(arc_swap::ArcSwap::from_pointee(
            crate::state::CandleCache::default(),
        ));
        let candle_tip = crate::state::new_candle_tip();
        let cl_prices = crate::state::new_cl_prices();
        let keeper_prices = crate::state::new_keeper_prices();
        let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
            Default::default(),
        )
        .unwrap();
        let glvs = Arc::new(arc_swap::ArcSwap::from_pointee(Vec::<
            crate::sources::rpc_markets::RpcGlv,
        >::new()));
        let chainlink_candle =
            crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
                Default::default(),
                false,
            )
            .unwrap();
        let state = AppState {
            config: Arc::new(config),
            sqd: crate::sources::sqd::SqdSource::new(sqd.clone()),
            candles: crate::sources::candles::CandleSource::new(
                candle_cache.clone(),
                candle_tip.clone(),
            ),
            sqd_volumes: sqd,
            snapshot: Arc::new(arc_swap::ArcSwap::from_pointee(snapshot)),
            candle_data: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            daily_cache: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            store_balances: crate::sources::store_balances::StoreBalancesHandle::default(),
            token_mints: crate::token_mints::TokenMintsHandle::default(),
            token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
            glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle::default(),
            candle_cache,
            candle_tip,
            arbitrum,
            cl_prices,
            keeper_prices,
            keeper_execution_time:
                crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::default(),
            arbitrum_prices: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            glvs,
            glv_refs: Arc::new(arc_swap::ArcSwap::from_pointee(
                None::<Vec<crate::sources::rpc_markets::GlvRef>>,
            )),
            volumes: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            cl_auth_token: Arc::new(arc_swap::ArcSwap::from_pointee(None)),
            chainlink_candle,
            price_candle: test_price_candle_service(),
            uploader,
            health: crate::health::Health::new(30),
            ws: crate::ws::WsBroadcast::new(),
            redis: None,
            chainlink_streams: crate::sources::chainlink_streams::ChainlinkStreamsClient::new(
                String::new(),
                String::new(),
                std::collections::HashMap::new(),
                false,
            )
            .unwrap(),
            streams_prices: Arc::new(arc_swap::ArcSwap::from_pointee(Vec::new())),
        };
        routes(Router::new()).layer(cors_layer()).with_state(state)
    }

    fn app_with_snapshot_and_uploader_and_keeper_execution_time(
        snapshot: Snapshot,
        uploader: Arc<dyn crate::s3::S3Uploader>,
        keeper_execution_time: crate::sources::keeper_execution_time::KeeperExecutionTimeHandle,
    ) -> Router {
        let config = crate::config::Config::from_figment(figment::Figment::new()).unwrap();
        let sqd = test_sqd_service();
        let candle_cache = Arc::new(arc_swap::ArcSwap::from_pointee(
            crate::state::CandleCache::default(),
        ));
        let candle_tip = crate::state::new_candle_tip();
        let cl_prices = crate::state::new_cl_prices();
        let keeper_prices = crate::state::new_keeper_prices();
        let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
            Default::default(),
        )
        .unwrap();
        let glvs = Arc::new(arc_swap::ArcSwap::from_pointee(Vec::<
            crate::sources::rpc_markets::RpcGlv,
        >::new()));
        let chainlink_candle =
            crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
                Default::default(),
                false,
            )
            .unwrap();
        let state = AppState {
            config: Arc::new(config),
            sqd: crate::sources::sqd::SqdSource::new(sqd.clone()),
            candles: crate::sources::candles::CandleSource::new(
                candle_cache.clone(),
                candle_tip.clone(),
            ),
            sqd_volumes: sqd,
            snapshot: Arc::new(arc_swap::ArcSwap::from_pointee(snapshot)),
            candle_data: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            daily_cache: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            store_balances: crate::sources::store_balances::StoreBalancesHandle::default(),
            token_mints: crate::token_mints::TokenMintsHandle::default(),
            token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
            glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle::default(),
            candle_cache,
            candle_tip,
            arbitrum,
            cl_prices,
            keeper_prices,
            keeper_execution_time,
            arbitrum_prices: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            glvs,
            glv_refs: Arc::new(arc_swap::ArcSwap::from_pointee(
                None::<Vec<crate::sources::rpc_markets::GlvRef>>,
            )),
            volumes: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            cl_auth_token: Arc::new(arc_swap::ArcSwap::from_pointee(None)),
            chainlink_candle,
            price_candle: test_price_candle_service(),
            uploader,
            health: crate::health::Health::new(30),
            ws: crate::ws::WsBroadcast::new(),
            redis: None,
            chainlink_streams: crate::sources::chainlink_streams::ChainlinkStreamsClient::new(
                String::new(),
                String::new(),
                std::collections::HashMap::new(),
                false,
            )
            .unwrap(),
            streams_prices: Arc::new(arc_swap::ArcSwap::from_pointee(Vec::new())),
        };
        routes(Router::new()).layer(cors_layer()).with_state(state)
    }

    fn app_with_keeper_execution_time(
        keeper_execution_time: crate::sources::keeper_execution_time::KeeperExecutionTimeHandle,
    ) -> Router {
        app_with_snapshot_and_uploader_and_keeper_execution_time(
            Snapshot::default(),
            Arc::new(crate::s3::AwsS3UploaderUnused),
            keeper_execution_time,
        )
    }

    /// Seed `daily_cache` with an empty snapshot to prove the handlers read only the cache.
    fn app_with_daily_cache(daily: crate::state::DailyCache) -> Router {
        let config = crate::config::Config::from_figment(figment::Figment::new()).unwrap();
        let sqd = test_sqd_service();
        let candle_cache = Arc::new(arc_swap::ArcSwap::from_pointee(
            crate::state::CandleCache::default(),
        ));
        let candle_tip = crate::state::new_candle_tip();
        let cl_prices = crate::state::new_cl_prices();
        let keeper_prices = crate::state::new_keeper_prices();
        let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
            Default::default(),
        )
        .unwrap();
        let glvs = Arc::new(arc_swap::ArcSwap::from_pointee(Vec::<
            crate::sources::rpc_markets::RpcGlv,
        >::new()));
        let chainlink_candle =
            crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
                Default::default(),
                false,
            )
            .unwrap();
        let state = AppState {
            config: Arc::new(config),
            sqd: crate::sources::sqd::SqdSource::new(sqd.clone()),
            candles: crate::sources::candles::CandleSource::new(
                candle_cache.clone(),
                candle_tip.clone(),
            ),
            sqd_volumes: sqd,
            snapshot: Arc::new(arc_swap::ArcSwap::from_pointee(Snapshot::default())),
            candle_data: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            daily_cache: Arc::new(arc_swap::ArcSwap::from_pointee(daily)),
            store_balances: crate::sources::store_balances::StoreBalancesHandle::default(),
            token_mints: crate::token_mints::TokenMintsHandle::default(),
            token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
            glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle::default(),
            candle_cache,
            candle_tip,
            arbitrum,
            cl_prices,
            keeper_prices,
            keeper_execution_time:
                crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::default(),
            arbitrum_prices: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            glvs,
            glv_refs: Arc::new(arc_swap::ArcSwap::from_pointee(
                None::<Vec<crate::sources::rpc_markets::GlvRef>>,
            )),
            volumes: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            cl_auth_token: Arc::new(arc_swap::ArcSwap::from_pointee(None)),
            chainlink_candle,
            price_candle: test_price_candle_service(),
            uploader: Arc::new(crate::s3::AwsS3UploaderUnused),
            health: crate::health::Health::new(30),
            ws: crate::ws::WsBroadcast::new(),
            redis: None,
            chainlink_streams: crate::sources::chainlink_streams::ChainlinkStreamsClient::new(
                String::new(),
                String::new(),
                std::collections::HashMap::new(),
                false,
            )
            .unwrap(),
            streams_prices: Arc::new(arc_swap::ArcSwap::from_pointee(Vec::new())),
        };
        routes(Router::new()).layer(cors_layer()).with_state(state)
    }

    fn app_with_store_balances(
        store_balances: crate::sources::store_balances::StoreBalancesHandle,
    ) -> Router {
        let config = crate::config::Config::from_figment(figment::Figment::new()).unwrap();
        let sqd = test_sqd_service();
        let candle_cache = Arc::new(arc_swap::ArcSwap::from_pointee(
            crate::state::CandleCache::default(),
        ));
        let candle_tip = crate::state::new_candle_tip();
        let cl_prices = crate::state::new_cl_prices();
        let keeper_prices = crate::state::new_keeper_prices();
        let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
            Default::default(),
        )
        .unwrap();
        let glvs = Arc::new(arc_swap::ArcSwap::from_pointee(Vec::<
            crate::sources::rpc_markets::RpcGlv,
        >::new()));
        let chainlink_candle =
            crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
                Default::default(),
                false,
            )
            .unwrap();
        let state = AppState {
            config: Arc::new(config),
            sqd: crate::sources::sqd::SqdSource::new(sqd.clone()),
            candles: crate::sources::candles::CandleSource::new(
                candle_cache.clone(),
                candle_tip.clone(),
            ),
            sqd_volumes: sqd,
            snapshot: Arc::new(arc_swap::ArcSwap::from_pointee(Snapshot::default())),
            candle_data: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            daily_cache: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            store_balances,
            token_mints: crate::token_mints::TokenMintsHandle::default(),
            token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
            glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle::default(),
            candle_cache,
            candle_tip,
            arbitrum,
            cl_prices,
            keeper_prices,
            keeper_execution_time:
                crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::default(),
            arbitrum_prices: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            glvs,
            glv_refs: Arc::new(arc_swap::ArcSwap::from_pointee(
                None::<Vec<crate::sources::rpc_markets::GlvRef>>,
            )),
            volumes: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            cl_auth_token: Arc::new(arc_swap::ArcSwap::from_pointee(None)),
            chainlink_candle,
            price_candle: test_price_candle_service(),
            uploader: Arc::new(crate::s3::AwsS3UploaderUnused),
            health: crate::health::Health::new(30),
            ws: crate::ws::WsBroadcast::new(),
            redis: None,
            chainlink_streams: crate::sources::chainlink_streams::ChainlinkStreamsClient::new(
                String::new(),
                String::new(),
                std::collections::HashMap::new(),
                false,
            )
            .unwrap(),
            streams_prices: Arc::new(arc_swap::ArcSwap::from_pointee(Vec::new())),
        };
        routes(Router::new()).layer(cors_layer()).with_state(state)
    }

    fn app_with_token_mints(token_mints: crate::token_mints::TokenMintsHandle) -> Router {
        let config = crate::config::Config::from_figment(figment::Figment::new()).unwrap();
        let sqd = test_sqd_service();
        let candle_cache = Arc::new(arc_swap::ArcSwap::from_pointee(
            crate::state::CandleCache::default(),
        ));
        let candle_tip = crate::state::new_candle_tip();
        let cl_prices = crate::state::new_cl_prices();
        let keeper_prices = crate::state::new_keeper_prices();
        let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
            Default::default(),
        )
        .unwrap();
        let glvs = Arc::new(arc_swap::ArcSwap::from_pointee(Vec::<
            crate::sources::rpc_markets::RpcGlv,
        >::new()));
        let chainlink_candle =
            crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
                Default::default(),
                false,
            )
            .unwrap();
        let state = AppState {
            config: Arc::new(config),
            sqd: crate::sources::sqd::SqdSource::new(sqd.clone()),
            candles: crate::sources::candles::CandleSource::new(
                candle_cache.clone(),
                candle_tip.clone(),
            ),
            sqd_volumes: sqd,
            snapshot: Arc::new(arc_swap::ArcSwap::from_pointee(Snapshot::default())),
            candle_data: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            daily_cache: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            store_balances: crate::sources::store_balances::StoreBalancesHandle::default(),
            token_mints,
            token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
            glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle::default(),
            candle_cache,
            candle_tip,
            arbitrum,
            cl_prices,
            keeper_prices,
            keeper_execution_time:
                crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::default(),
            arbitrum_prices: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            glvs,
            glv_refs: Arc::new(arc_swap::ArcSwap::from_pointee(
                None::<Vec<crate::sources::rpc_markets::GlvRef>>,
            )),
            volumes: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            cl_auth_token: Arc::new(arc_swap::ArcSwap::from_pointee(None)),
            chainlink_candle,
            price_candle: test_price_candle_service(),
            uploader: Arc::new(crate::s3::AwsS3UploaderUnused),
            health: crate::health::Health::new(30),
            ws: crate::ws::WsBroadcast::new(),
            redis: None,
            chainlink_streams: crate::sources::chainlink_streams::ChainlinkStreamsClient::new(
                String::new(),
                String::new(),
                std::collections::HashMap::new(),
                false,
            )
            .unwrap(),
            streams_prices: Arc::new(arc_swap::ArcSwap::from_pointee(Vec::new())),
        };
        routes(Router::new()).layer(cors_layer()).with_state(state)
    }

    fn store_balances_payload() -> crate::sources::store_balances::StoreBalancesPayload {
        crate::sources::store_balances::StoreBalancesPayload {
            store: "store111".to_string(),
            sol_balance: "123".to_string(),
            token_balances: vec![crate::sources::store_balances::StoreTokenBalance {
                mint: "mint111".to_string(),
                account: "account111".to_string(),
                amount: "456".to_string(),
                program_id: "program111".to_string(),
            }],
            is_snapshot: true,
            is_last_snapshot: true,
            has_last_snapshot: true,
        }
    }

    fn token_mints_cache(first: &str, second: &str) -> crate::token_mints::TokenMintsCache {
        let mut token_mints = std::collections::BTreeMap::new();
        token_mints.insert(
            first.to_string(),
            crate::token_mints::TokenMintRecord {
                pubkey: first.to_string(),
                program_id: anchor_spl::token::ID.to_string(),
                decimals: 9,
                supply: "100".to_string(),
                data_base64: "AAAA".to_string(),
            },
        );
        token_mints.insert(
            second.to_string(),
            crate::token_mints::TokenMintRecord {
                pubkey: second.to_string(),
                program_id: anchor_spl::token_2022::ID.to_string(),
                decimals: 6,
                supply: "200".to_string(),
                data_base64: "BBBB".to_string(),
            },
        );
        crate::token_mints::TokenMintsCache { token_mints }
    }

    fn token_mints_handle_ready(first: &str, second: &str) -> crate::token_mints::TokenMintsHandle {
        crate::token_mints::TokenMintsHandle::new(crate::token_mints::TokenMintsCacheState::Ready(
            token_mints_cache(first, second),
        ))
    }

    fn app_with_glv_accounts(
        glv_accounts: crate::sources::glv_accounts::GlvAccountsHandle,
    ) -> Router {
        let config = crate::config::Config::from_figment(figment::Figment::new()).unwrap();
        let sqd = test_sqd_service();
        let candle_cache = Arc::new(arc_swap::ArcSwap::from_pointee(
            crate::state::CandleCache::default(),
        ));
        let candle_tip = crate::state::new_candle_tip();
        let cl_prices = crate::state::new_cl_prices();
        let keeper_prices = crate::state::new_keeper_prices();
        let arbitrum = crate::sources::arbitrum_tickers::ArbitrumTickerClient::new_for_tests(
            Default::default(),
        )
        .unwrap();
        let glvs = Arc::new(arc_swap::ArcSwap::from_pointee(Vec::<
            crate::sources::rpc_markets::RpcGlv,
        >::new()));
        let chainlink_candle =
            crate::sources::chainlink_candle::ChainlinkCandleClient::new_for_tests(
                Default::default(),
                false,
            )
            .unwrap();
        let state = AppState {
            config: Arc::new(config),
            sqd: crate::sources::sqd::SqdSource::new(sqd.clone()),
            candles: crate::sources::candles::CandleSource::new(
                candle_cache.clone(),
                candle_tip.clone(),
            ),
            sqd_volumes: sqd,
            snapshot: Arc::new(arc_swap::ArcSwap::from_pointee(Snapshot::default())),
            candle_data: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            daily_cache: Arc::new(arc_swap::ArcSwap::from_pointee(Default::default())),
            store_balances: crate::sources::store_balances::StoreBalancesHandle::default(),
            token_mints: crate::token_mints::TokenMintsHandle::default(),
            token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
            glv_accounts,
            candle_cache,
            candle_tip,
            arbitrum,
            cl_prices,
            keeper_prices,
            keeper_execution_time:
                crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::default(),
            arbitrum_prices: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            glvs,
            glv_refs: Arc::new(arc_swap::ArcSwap::from_pointee(
                None::<Vec<crate::sources::rpc_markets::GlvRef>>,
            )),
            volumes: Arc::new(arc_swap::ArcSwap::from_pointee(
                std::collections::HashMap::new(),
            )),
            cl_auth_token: Arc::new(arc_swap::ArcSwap::from_pointee(None)),
            chainlink_candle,
            price_candle: test_price_candle_service(),
            uploader: Arc::new(crate::s3::AwsS3UploaderUnused),
            health: crate::health::Health::new(30),
            ws: crate::ws::WsBroadcast::new(),
            redis: None,
            chainlink_streams: crate::sources::chainlink_streams::ChainlinkStreamsClient::new(
                String::new(),
                String::new(),
                std::collections::HashMap::new(),
                false,
            )
            .unwrap(),
            streams_prices: Arc::new(arc_swap::ArcSwap::from_pointee(Vec::new())),
        };
        routes(Router::new()).layer(cors_layer()).with_state(state)
    }

    fn glv_accounts_payload() -> crate::sources::glv_accounts::GlvsPayload {
        crate::sources::glv_accounts::GlvsPayload {
            glvs: vec![crate::sources::glv_accounts::GlvAccountRecordPayload {
                glv: "glv111".to_string(),
                data: "AQID".to_string(),
                config: crate::sources::glv_accounts::GlvConfigPayload {
                    glv_token: "glvToken111".to_string(),
                    long_token: "long111".to_string(),
                    short_token: "short111".to_string(),
                    min_tokens_for_first_deposit: "1".to_string(),
                    shift_last_executed_at: "2".to_string(),
                },
                markets: Vec::new(),
                is_snapshot: true,
                is_last_snapshot: true,
                has_last_snapshot: true,
            }],
        }
    }

    async fn body_json(resp: axum::response::Response) -> Value {
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        serde_json::from_slice(&bytes).unwrap()
    }

    async fn get(app: &Router, uri: &str) -> axum::response::Response {
        app.clone()
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn log_p_with_query_returns_200_empty_json_string() {
        let app = app_with_snapshot(Snapshot::default());
        let resp = get(&app, "/log/p?s=hello").await;
        assert_eq!(resp.status(), StatusCode::OK);
        // Go's httpx.OkJson(w, "") emits the JSON-encoded empty string: `""`.
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        assert_eq!(&bytes[..], b"\"\"");
    }

    #[tokio::test]
    async fn store_balances_disabled_returns_503_unavailable_json() {
        let app = app_with_store_balances(
            crate::sources::store_balances::StoreBalancesHandle::disabled("disabled by test"),
        );

        let resp = get(&app, "/v2/cache/store/balances").await;

        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            body_json(resp).await,
            serde_json::json!({
                "error": "store balances unavailable",
                "reason": "disabled by test",
            })
        );
    }

    #[tokio::test]
    async fn store_balances_initializing_returns_503_unavailable_json() {
        let app =
            app_with_store_balances(crate::sources::store_balances::StoreBalancesHandle::new(
                crate::sources::store_balances::StoreBalancesCacheState::Initializing {
                    reason: "waiting for test".to_string(),
                },
            ));

        let resp = get(&app, "/v2/cache/store/balances").await;

        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            body_json(resp).await,
            serde_json::json!({
                "error": "store balances unavailable",
                "reason": "waiting for test",
            })
        );
    }

    #[tokio::test]
    async fn store_balances_ready_returns_payload_matching_ws_envelope_payload() {
        let payload = store_balances_payload();
        let app =
            app_with_store_balances(crate::sources::store_balances::StoreBalancesHandle::new(
                crate::sources::store_balances::StoreBalancesCacheState::Ready(payload.clone()),
            ));

        let resp = get(&app, "/v2/cache/store/balances").await;

        assert_eq!(resp.status(), StatusCode::OK);
        let http_payload = body_json(resp).await;
        assert_eq!(http_payload, serde_json::to_value(&payload).unwrap());

        let ws_frame = crate::ws::envelope_json(
            crate::ws_protocol::Topic::StoreBalances.type_str(),
            &payload,
        );
        let ws_json: Value = serde_json::from_str(&ws_frame).unwrap();
        assert_eq!(ws_json["type"], "storeBalances");
        assert_eq!(http_payload, ws_json["payload"]);
    }

    #[tokio::test]
    async fn token_mints_disabled_returns_503_unavailable_json() {
        let app = app_with_token_mints(crate::token_mints::TokenMintsHandle::disabled(
            "disabled by test",
        ));

        let resp = get(&app, "/v2/cache/store/tokenMints").await;

        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            body_json(resp).await,
            serde_json::json!({
                "error": "token mints unavailable",
                "reason": "disabled by test",
            })
        );
    }

    #[tokio::test]
    async fn glv_accounts_disabled_returns_503_unavailable_json() {
        let app = app_with_glv_accounts(crate::sources::glv_accounts::GlvAccountsHandle::disabled(
            "disabled by test",
        ));

        let resp = get(&app, "/v2/cache/glvs").await;

        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            body_json(resp).await,
            serde_json::json!({
                "error": "glv accounts disabled",
                "reason": "disabled by test",
            })
        );
    }

    #[tokio::test]
    async fn token_mints_invalid_pubkeys_returns_400() {
        let app = app_with_token_mints(crate::token_mints::TokenMintsHandle::disabled(
            "disabled by test",
        ));

        let resp = get(&app, "/v2/cache/store/tokenMints?pubkeys=not-a-pubkey").await;

        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let body = body_json(resp).await;
        assert_eq!(body["error"], "invalid token mints request");
        assert!(body["reason"].as_str().unwrap().contains("invalid pubkey"));
    }

    #[tokio::test]
    async fn token_mints_ready_filters_and_controls_data_field() {
        let first = gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey::new_unique().to_string();
        let second = gmsol_sdk::solana_utils::solana_sdk::pubkey::Pubkey::new_unique().to_string();
        let app = app_with_token_mints(token_mints_handle_ready(&first, &second));

        let resp = get(
            &app,
            &format!("/v2/cache/store/tokenMints?pubkeys={second},{first}&withData=true"),
        )
        .await;

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp).await;
        let items = body["tokenMints"].as_array().unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0]["pubkey"], second);
        assert_eq!(
            items[0]["programId"],
            anchor_spl::token_2022::ID.to_string()
        );
        assert_eq!(items[0]["decimals"], 6);
        assert_eq!(items[0]["supply"], "200");
        assert_eq!(items[0]["data"], "BBBB");
        assert_eq!(items[0]["isSnapshot"], true);
        assert_eq!(items[0]["isLastSnapshot"], false);
        assert_eq!(items[0]["hasLastSnapshot"], true);
        assert_eq!(items[1]["pubkey"], first);
        assert_eq!(items[1]["isLastSnapshot"], true);
        assert!(items[0].get("totalSupply").is_none());
        assert!(items[0].get("maxMintable").is_none());

        let resp = get(
            &app,
            &format!("/v2/cache/store/tokenMints?pubkeys={second}"),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp).await;
        let item = &body["tokenMints"][0];
        assert!(item.get("data").is_none());
        assert!(item.get("dataBase64").is_none());
    }

    #[tokio::test]
    async fn glv_accounts_initializing_returns_503_unavailable_json() {
        let app = app_with_glv_accounts(crate::sources::glv_accounts::GlvAccountsHandle::new(
            crate::sources::glv_accounts::GlvAccountsCacheState::Initializing {
                reason: "waiting for test".to_string(),
            },
        ));

        let resp = get(&app, "/v2/cache/glvs").await;

        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            body_json(resp).await,
            serde_json::json!({
                "error": "glv accounts initializing",
                "reason": "waiting for test",
            })
        );
    }

    #[tokio::test]
    async fn glv_accounts_ready_returns_payload_matching_ws_envelope_payload() {
        let payload = glv_accounts_payload();
        let ws_frame = crate::sources::glv_accounts::glvs_ws_frame(&payload);
        let app = app_with_glv_accounts(crate::sources::glv_accounts::GlvAccountsHandle::new(
            crate::sources::glv_accounts::GlvAccountsCacheState::Ready(
                crate::sources::glv_accounts::GlvAccountsCache {
                    payload: payload.clone(),
                    ws_frame: ws_frame.clone(),
                },
            ),
        ));

        let resp = get(&app, "/v2/cache/glvs").await;

        assert_eq!(resp.status(), StatusCode::OK);
        let http_payload = body_json(resp).await;
        assert_eq!(http_payload, serde_json::to_value(&payload).unwrap());

        let ws_json: Value = serde_json::from_str(&ws_frame).unwrap();
        assert_eq!(ws_json["type"], "glvs");
        assert_eq!(http_payload, ws_json["payload"]);
    }

    #[tokio::test]
    async fn candles_missing_required_period_is_400() {
        // Missing required form param → 400 (matches Go's httpx.Parse).
        let app = app_with_snapshot(Snapshot::default());
        let resp = get(&app, "/v2/cache/prices/candles?tokenSymbol=SOL").await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    use crate::dto::{GtUpdate, PoolLineData, PriceLineData};

    #[tokio::test]
    async fn ann_performance_missing_duration_is_400() {
        // `duration` is required (Go non-optional form tag) → missing is a 400.
        let app = app_with_snapshot(Snapshot::default());
        let resp = get(&app, "/v2/cache/daily/annPerformance").await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn gt_updates_negative_limit_is_clamped_still_200() {
        // A negative limit is clamped to the default 1000; endpoint stays 200.
        let app = app_with_snapshot(Snapshot::default());
        let resp = get(&app, "/v2/cache/daily/gtUpdates?limit=-5").await;
        assert_eq!(resp.status(), StatusCode::OK);
        let actual = body_json(resp).await;
        let _: Vec<GtUpdate> = serde_json::from_value(actual).unwrap();
    }

    #[test]
    fn check_param_len_rejects_only_over_limit() {
        assert!(super::check_param_len("So11111111111111111111111111111111111111112", 256).is_ok());
        assert!(super::check_param_len(&"x".repeat(256), 256).is_ok());
        assert!(super::check_param_len(&"x".repeat(257), 256).is_err());
    }

    #[test]
    fn check_pubkey_accepts_base58_pubkeys_and_rejects_garbage() {
        // Real 43/44-char base58 pubkeys pass.
        assert!(super::check_pubkey("So11111111111111111111111111111111111111112", 256).is_ok());
        assert!(super::check_pubkey("2Ek8kU98XKeH4ErvQcEGoEf2Q2xqBMEK6bfjanypVeZP", 256).is_ok());
        // Non-base58 byte (`0`/`O`/`I`/`l` or punctuation) -> rejected even at a legal length.
        assert!(super::check_pubkey("So1111111111111111111111111111111111111111l0", 256).is_err());
        assert!(
            super::check_pubkey("../../../etc/passwd*drop*key*aaaaaaaaaaaaaaaaa", 256).is_err()
        );
        // Too short / too long for the 32..=44 pubkey band.
        assert!(super::check_pubkey("abc", 256).is_err());
        assert!(super::check_pubkey(&"A".repeat(45), 256).is_err());
        // Over the configured byte cap -> rejected by the length gate first.
        assert!(super::check_pubkey(&"A".repeat(300), 256).is_err());
    }

    #[test]
    fn check_symbol_accepts_alnum_and_rejects_garbage() {
        assert!(super::check_symbol("SOL", 256).is_ok());
        assert!(super::check_symbol("FARTCOIN", 256).is_ok());
        assert!(super::check_symbol("1000PEPE", 256).is_ok()); // digits allowed for forward compat
                                                               // Empty, punctuation, or whitespace -> rejected.
        assert!(super::check_symbol("", 256).is_err());
        assert!(super::check_symbol("SOL:*", 256).is_err());
        assert!(super::check_symbol("a b", 256).is_err());
        assert!(super::check_symbol(&"A".repeat(33), 256).is_err());
    }

    #[tokio::test]
    async fn over_long_token_param_is_400() {
        // An abusive over-long `token` is rejected with 400, never reaching Redis-key assembly.
        let app = app_with_snapshot(Snapshot::default());
        let long = "x".repeat(300); // > default max_param_len (256)
        let resp = get(
            &app,
            &format!("/v2/cache/daily/gmPrices?token={long}&duration=30"),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn normal_token_param_is_not_rejected() {
        // A real-length pubkey is well under the limit -> not a 400.
        let app = app_with_snapshot(Snapshot::default());
        let resp = get(
            &app,
            "/v2/cache/daily/gmPrices?token=So11111111111111111111111111111111111111112&duration=30",
        )
        .await;
        assert_ne!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn log_p_over_long_s_is_truncated_still_200() {
        // An abusive long `s` is truncated (not rejected) -> still 200, logs stay bounded.
        let app = app_with_snapshot(Snapshot::default());
        let long = "y".repeat(5000);
        let resp = get(&app, &format!("/log/p?s={long}")).await;
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn illegal_charset_token_is_400_before_redis() {
        // An in-length-bound but non-base58 `token` is rejected before any Redis-key assembly.
        let app = app_with_snapshot(Snapshot::default());
        let resp = get(
            &app,
            "/v2/cache/daily/gmPrices?token=not*a*valid*base58*pubkey*string&duration=30",
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn illegal_charset_candle_symbol_is_400() {
        // A `tokenSymbol` with punctuation is rejected before the candlestick Redis key is built.
        let app = app_with_snapshot(Snapshot::default());
        let resp = get(
            &app,
            "/v2/cache/prices/candles?tokenSymbol=SOL%3A%2A&period=1m",
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn overlong_duration_is_400() {
        // An over-long `duration` is rejected on annPerformance (which otherwise ignores unknown values).
        let app = app_with_snapshot(Snapshot::default());
        let long = "9".repeat(300);
        let resp = get(
            &app,
            &format!("/v2/cache/daily/annPerformance?duration={long}"),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    use crate::dto::LineChartData;
    use crate::state::DailyCache;

    fn sample_pool(token: &str) -> PoolLineData {
        PoolLineData {
            token_address: token.to_string(),
            annualized: 0.12,
            line_charts: vec![LineChartData {
                time_stamp: 86_400,
                ydata: 0.0,
            }],
        }
    }

    fn sample_price(ts: i64, y: &str) -> PriceLineData {
        PriceLineData {
            time_stamp: ts,
            ydata: y.to_string(),
        }
    }

    fn sample_gt(total: &str, ts: &str) -> GtUpdate {
        GtUpdate {
            total_minted: total.to_string(),
            timestamp: ts.to_string(),
            day_timestamp: 0,
        }
    }

    #[tokio::test]
    async fn ann_performance_reads_seeded_cache() {
        let mut daily = DailyCache::default();
        daily.ann_performance.insert(30, vec![sample_pool("MT1")]);
        let app = app_with_daily_cache(daily);
        let resp = get(&app, "/v2/cache/daily/annPerformance?duration=30").await;
        assert_eq!(resp.status(), StatusCode::OK);
        let actual = body_json(resp).await;
        let v: Vec<PoolLineData> = serde_json::from_value(actual).unwrap();
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].token_address, "MT1");
    }

    #[tokio::test]
    async fn gm_prices_reads_seeded_cache_keyed_on_token_and_days() {
        // Real base58 pubkeys, since the handler now charset-validates `token`.
        let seeded = "So11111111111111111111111111111111111111112";
        let other = "2Ek8kU98XKeH4ErvQcEGoEf2Q2xqBMEK6bfjanypVeZP";
        let mut daily = DailyCache::default();
        daily
            .gm_prices
            .insert((seeded.to_string(), 90), vec![sample_price(86_400, "1.5")]);
        let app = app_with_daily_cache(daily);
        let resp = get(
            &app,
            &format!("/v2/cache/daily/gmPrices?token={seeded}&duration=90"),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);
        let v: Vec<PriceLineData> = serde_json::from_value(body_json(resp).await).unwrap();
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].ydata, "1.5");
        // A DIFFERENT token (not seeded) → empty, proving the (token,days) key.
        let other: Vec<PriceLineData> = serde_json::from_value(
            body_json(
                get(
                    &app,
                    &format!("/v2/cache/daily/gmPrices?token={other}&duration=90"),
                )
                .await,
            )
            .await,
        )
        .unwrap();
        assert!(other.is_empty());
    }

    #[tokio::test]
    async fn gt_updates_truncates_to_requested_limit_keeping_newest() {
        // Cache holds 3 rows (ascending by day); limit=2 → newest 2 (the tail).
        let daily = DailyCache {
            gt_updates: vec![
                sample_gt("1", "2026-02-04T00:00:00Z"),
                sample_gt("2", "2026-02-05T00:00:00Z"),
                sample_gt("3", "2026-02-06T00:00:00Z"),
            ],
            ..Default::default()
        };
        let app = app_with_daily_cache(daily);
        let v: Vec<GtUpdate> = serde_json::from_value(
            body_json(get(&app, "/v2/cache/daily/gtUpdates?limit=2").await).await,
        )
        .unwrap();
        assert_eq!(v.len(), 2);
        assert_eq!(v[0].total_minted, "2");
        assert_eq!(v[1].total_minted, "3");
    }

    #[tokio::test]
    async fn daily_cold_cache_returns_empty_arrays_200() {
        // Every endpoint over an EMPTY (cold) cache → `[]` 200 (no sqd call).
        let app = app_with_daily_cache(DailyCache::default());
        for uri in [
            "/v2/cache/daily/annPerformance?duration=30",
            "/v2/cache/daily/feeApy?duration=all",
            "/v2/cache/daily/gmPrices?token=So11111111111111111111111111111111111111112&duration=90",
            "/v2/cache/daily/glvPrices?token=2Ek8kU98XKeH4ErvQcEGoEf2Q2xqBMEK6bfjanypVeZP&duration=180",
            "/v2/cache/daily/gtUpdates?limit=100",
        ] {
            let resp = get(&app, uri).await;
            assert_eq!(resp.status(), StatusCode::OK, "uri {uri}");
            let actual = body_json(resp).await;
            assert_eq!(actual.as_array().unwrap().len(), 0, "uri {uri} → []");
        }
    }

    #[tokio::test]
    async fn cors_preflight_sets_expected_allow_headers() {
        let app = app_with_snapshot(Snapshot::default());
        let resp = app
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/cache/prices/tickers")
                    .header("Origin", "https://gmtrade.xyz")
                    .header("Access-Control-Request-Method", "GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let headers = resp.headers();
        assert_eq!(
            headers
                .get("access-control-allow-origin")
                .map(|v| v.to_str().unwrap()),
            Some("*")
        );
        let methods = headers
            .get("access-control-allow-methods")
            .unwrap()
            .to_str()
            .unwrap()
            .to_ascii_uppercase();
        for m in ["GET", "POST", "OPTIONS", "PUT", "DELETE"] {
            assert!(methods.contains(m), "missing method {m} in {methods}");
        }
        assert_eq!(
            headers
                .get("access-control-max-age")
                .map(|v| v.to_str().unwrap()),
            Some("86400")
        );
    }

    use std::sync::Mutex;

    #[derive(Default)]
    struct MockUploader {
        calls: Mutex<Vec<(String, Vec<u8>)>>,
    }

    #[async_trait::async_trait]
    impl crate::s3::S3Uploader for MockUploader {
        async fn put_jpeg(&self, key: &str, bytes: Vec<u8>) -> eyre::Result<()> {
            self.calls.lock().unwrap().push((key.to_string(), bytes));
            Ok(())
        }
    }

    fn multipart_body(
        field_name: &str,
        filename: &str,
        part_content_type: &str,
        data: &[u8],
    ) -> (Vec<u8>, String) {
        let boundary = "TESTBOUNDARY123456";
        let mut body = Vec::new();
        body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        body.extend_from_slice(
            format!(
                "Content-Disposition: form-data; name=\"{field_name}\"; filename=\"{filename}\"\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(format!("Content-Type: {part_content_type}\r\n\r\n").as_bytes());
        body.extend_from_slice(data);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
        let header = format!("multipart/form-data; boundary={boundary}");
        (body, header)
    }

    async fn post_multipart(
        app: &Router,
        uri: &str,
        body: Vec<u8>,
        content_type: &str,
    ) -> axum::response::Response {
        app.clone()
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri(uri)
                    .header("content-type", content_type)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn upload_valid_jpeg_returns_key_and_url_and_records_put() {
        let mock = Arc::new(MockUploader::default());
        let app = app_with_snapshot_and_uploader(Snapshot::default(), mock.clone());

        let payload = b"\xff\xd8\xff\xe0fakejpegbytes";
        let (body, ct) = multipart_body("file", "photo.jpg", "image/jpeg", payload);
        let resp = post_multipart(&app, "/v2/upload", body, &ct).await;
        assert_eq!(resp.status(), StatusCode::OK);

        let actual = body_json(resp).await;
        // Default config: prefix `positionsharing/`, host positionsharing.gmxsolana.io.
        let key = actual["key"].as_str().unwrap();
        assert_eq!(key.len(), 20, "key is the bare 20-char name");
        assert!(
            key.bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit()),
            "key is lowercase base-36: {key}"
        );
        // The url points at the actual stored object (single `.jpg`); legacy Go doubled it.
        assert_eq!(
            actual["url"].as_str().unwrap(),
            format!("https://positionsharing.gmxsolana.io/positionsharing/{key}.jpg")
        );

        // One put with the prefixed single-`.jpg` key and exact bytes.
        let calls = mock.calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, format!("positionsharing/{key}.jpg"));
        assert_eq!(calls[0].1, payload);
    }

    #[tokio::test]
    async fn upload_non_jpeg_is_400_and_does_not_put() {
        let mock = Arc::new(MockUploader::default());
        let app = app_with_snapshot_and_uploader(Snapshot::default(), mock.clone());

        let (body, ct) = multipart_body("file", "photo.png", "image/png", b"pngdata");
        let resp = post_multipart(&app, "/v2/upload", body, &ct).await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        assert!(
            mock.calls.lock().unwrap().is_empty(),
            "must not put on reject"
        );
    }

    async fn body_text(resp: axum::response::Response) -> String {
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        String::from_utf8(bytes.to_vec()).unwrap()
    }

    #[tokio::test]
    async fn share_with_p_g_redirects_to_gmtrade() {
        let app = app_with_snapshot(Snapshot::default());
        let resp = get(&app, "/api/s?id=abc&p=g").await;
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(
            resp.headers()
                .get(axum::http::header::CONTENT_TYPE)
                .unwrap(),
            "text/html; charset=utf-8"
        );
        let body = body_text(resp).await;
        assert!(body.contains(r#"window.location.href = "https://gmtrade.xyz/""#));
        assert!(body.contains("https://positionsharing.gmxsolana.io/abc.jpg"));
    }

    #[tokio::test]
    async fn share_missing_id_is_4xx_matching_go() {
        // Go's `form:"id"` is required; httpx.Parse 400s on a missing id.
        let app = app_with_snapshot(Snapshot::default());
        let resp = get(&app, "/api/s").await;
        assert!(resp.status().is_client_error());
    }

    #[tokio::test]
    async fn keeper_metrics_route_returns_weighted_payload() {
        let handle =
            crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::for_source_count(2);
        let now = tokio::time::Instant::now();
        handle.update_snapshot(0, 10, 1, 8_000, now);
        handle.update_snapshot(1, 10, 3, 9_500, now);
        let app = app_with_keeper_execution_time(handle);

        let response = get(&app, "/v2/cache/keeper/metrics").await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            body_json(response).await,
            serde_json::json!({ "estimatedExecutionTimeSeconds": 9.125 })
        );
    }

    #[tokio::test]
    async fn keeper_metrics_route_returns_503_for_global_config_reasons() {
        use crate::config::KeeperExecutionTimeConfig;
        use crate::sources::keeper_execution_time::KeeperExecutionTimeHandle;

        for (config, shared_endpoint, reason) in [
            (
                KeeperExecutionTimeConfig::default(),
                "not parsed while disabled",
                "runtime disabled",
            ),
            (
                KeeperExecutionTimeConfig {
                    enabled: true,
                    graphql_ws_endpoints: Vec::new(),
                    stale_secs: 30,
                },
                "",
                "endpoint missing",
            ),
            (
                KeeperExecutionTimeConfig {
                    enabled: true,
                    graphql_ws_endpoints: vec!["https://keeper.example/graphql-ws".into()],
                    stale_secs: 30,
                },
                "wss://shared.example/graphql-ws",
                "endpoint invalid",
            ),
        ] {
            let handle = KeeperExecutionTimeHandle::from_config(&config, shared_endpoint);
            let app = app_with_keeper_execution_time(handle);
            let response = get(&app, "/v2/cache/keeper/metrics").await;
            assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
            assert_eq!(
                body_json(response).await,
                serde_json::json!({
                    "error": "keeper metrics unavailable",
                    "reason": reason
                })
            );
        }
    }

    #[tokio::test]
    async fn keeper_metrics_route_returns_503_while_any_source_is_waiting() {
        let handle =
            crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::for_source_count(2);
        handle.update_snapshot(0, 10, 1, 1_000, tokio::time::Instant::now());
        let app = app_with_keeper_execution_time(handle);

        let response = get(&app, "/v2/cache/keeper/metrics").await;
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            body_json(response).await,
            serde_json::json!({
                "error": "keeper metrics unavailable",
                "reason": "waiting for first snapshot"
            })
        );
    }

    #[tokio::test]
    async fn keeper_metrics_route_returns_503_when_all_sources_are_empty() {
        let handle =
            crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::for_source_count(2);
        let now = tokio::time::Instant::now();
        handle.update_snapshot(0, 10, 0, 0, now);
        handle.update_snapshot(1, 10, 0, 0, now);
        let app = app_with_keeper_execution_time(handle);

        let response = get(&app, "/v2/cache/keeper/metrics").await;
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            body_json(response).await,
            serde_json::json!({
                "error": "keeper metrics unavailable",
                "reason": "empty snapshot"
            })
        );
    }

    #[tokio::test]
    async fn keeper_metrics_route_returns_503_when_sources_are_misaligned() {
        let handle =
            crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::for_source_count(2);
        let now = tokio::time::Instant::now();
        handle.update_snapshot(0, 10, 1, 1_000, now - std::time::Duration::from_secs(10));
        handle.update_snapshot(1, 10, 1, 2_000, now);
        let app = app_with_keeper_execution_time(handle);

        let response = get(&app, "/v2/cache/keeper/metrics").await;
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            body_json(response).await,
            serde_json::json!({
                "error": "keeper metrics unavailable",
                "reason": "snapshot misaligned"
            })
        );
    }

    #[tokio::test]
    async fn keeper_metrics_route_returns_fixed_503_for_stale_contract_and_transport() {
        let now = tokio::time::Instant::now();
        let stale =
            crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::for_source_count(1);
        stale.update_snapshot(0, 10, 1, 1_000, now - std::time::Duration::from_secs(31));
        let contract =
            crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::for_source_count(1);
        contract.set_contract_unavailable(0);
        let transport =
            crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::for_source_count(1);
        transport.note_transport_failure(0);

        for (handle, reason) in [
            (stale, "snapshot stale"),
            (contract, "contract incompatible"),
            (transport, "transport unavailable"),
        ] {
            let app = app_with_keeper_execution_time(handle);
            let response = get(&app, "/v2/cache/keeper/metrics").await;
            assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
            assert_eq!(
                body_json(response).await,
                serde_json::json!({
                    "error": "keeper metrics unavailable",
                    "reason": reason
                })
            );
        }
    }

    #[tokio::test]
    async fn keeper_metrics_route_uses_deterministic_reason_precedence() {
        let handle =
            crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::for_source_count(3);
        handle.update_snapshot(
            0,
            10,
            1,
            1_000,
            tokio::time::Instant::now() - std::time::Duration::from_secs(31),
        );
        handle.set_contract_unavailable(2);
        let app = app_with_keeper_execution_time(handle);

        let response = get(&app, "/v2/cache/keeper/metrics").await;
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            body_json(response).await,
            serde_json::json!({
                "error": "keeper metrics unavailable",
                "reason": "contract incompatible"
            })
        );
    }

    #[tokio::test]
    async fn keeper_metrics_route_preserves_cors_contract() {
        let app = app_with_keeper_execution_time(
            crate::sources::keeper_execution_time::KeeperExecutionTimeHandle::default(),
        );
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/v2/cache/keeper/metrics")
                    .header("Origin", "https://gmtrade.xyz")
                    .header("Access-Control-Request-Method", "GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            response
                .headers()
                .get("access-control-allow-origin")
                .map(|value| value.to_str().unwrap()),
            Some("*")
        );
    }
}
