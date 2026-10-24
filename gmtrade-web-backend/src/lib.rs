//! gmtrade-web-backend library of wire-contract DTOs, WS protocol, and service modules, fronted by [`run`].

pub mod dto;
pub mod ws_protocol;

pub mod aggregate;
pub mod candle_refresh;
pub mod candle_source_refresh;
pub mod candle_stream;
pub mod config;
pub mod daily_refresh;
pub mod geoip;
pub mod health;
pub mod http;
mod metrics;
pub mod redis_store;
pub mod refresh;
pub mod runtime;
pub mod s3;
pub mod sources;
pub mod state;
pub mod ticker;
pub mod token_mints;
pub mod tokens;
pub mod util;
pub mod ws;

use std::sync::Arc;

use clap::Parser;
use eyre::{Result, WrapErr};

use gmsol_sqd_client::SqdService;

use sources::chainlink_candle::ChainlinkCandleClient;

#[derive(Parser, Debug)]
pub struct Args {
    #[arg(short, long, default_value = "config.toml")]
    pub config: std::path::PathBuf,
    #[arg(long, default_value_t = false)]
    pub pretty: bool,
}

pub async fn run(args: Args) -> Result<()> {
    // Install `ring` as the process-wide rustls crypto provider before any TLS is used.
    let _ = rustls::crypto::ring::default_provider().install_default();

    let sub = tracing_subscriber::fmt::fmt().with_env_filter(
        tracing_subscriber::EnvFilter::builder()
            .with_default_directive(tracing::level_filters::LevelFilter::INFO.into())
            .from_env_lossy(),
    );
    if args.pretty {
        sub.pretty().init()
    } else {
        sub.compact().init()
    }
    tracing::info!(config = ?args.config, "gmtrade-web-backend starting");

    let config = config::Config::load(&args.config)?;
    tracing::info!(?config, "config loaded");

    let heartbeat_interval = metrics::install_if_enabled(&config.metrics)?;

    // Arbitrum price-symbol alias (e.g. WSOL->SOL) used by the price composer.
    sources::arbitrum_tickers::install_arbitrum_alias(
        config.token_source.overlay.arbitrum_alias.clone(),
    );
    // Candle period contracts + share URLs (operator-tunable, default = prior values).
    runtime::install(runtime::RuntimeParams {
        valid_periods: config.valid_periods.clone(),
        direct_periods: config.direct_periods.clone(),
        stream_group_size: config.stream_group_size,
        share_image_host: config.share_image_host.clone(),
        share_redirect_default: config.share_redirect_default.clone(),
        share_redirect_gmtrade: config.share_redirect_gmtrade.clone(),
    });

    let sqd = SqdService::new(config.sqd.clone()).wrap_err("failed to construct SqdService")?;
    let chainlink_candle =
        ChainlinkCandleClient::new(config.chainlink_candle.clone(), config.enable_devnet)
            .wrap_err("failed to construct ChainlinkCandleClient")?;
    // price-candle GraphQL candle fallback for keeper-priced markets the Data Engine + Arbitrum lack.
    let price_candle =
        gmsol_price_candle_client::PriceCandleService::new(config.price_candle.clone())
            .wrap_err("failed to construct PriceCandleService")?;
    match price_candle.is_configured() {
        true => tracing::info!(
            endpoint = %config.price_candle.endpoint,
            "price-candle candle fallback enabled"
        ),
        false => tracing::info!("price-candle candle fallback disabled (no endpoint)"),
    }
    // Shared candle cache the prefetch ticker writes and CandleSource reads.
    let candle_cache = Arc::new(arc_swap::ArcSwap::from_pointee(
        state::CandleCache::default(),
    ));
    // Live forming-candle tip: written by the streaming task, merged on read.
    let candle_tip = state::new_candle_tip();
    // Live Chainlink Data Engine SSE spot prices (data_source=Chainlink PRIMARY), written by the candle stream task.
    let cl_prices = state::new_cl_prices();
    // Live keeper (marin) spot prices (data_source=Chainlink FALLBACK), written by the keeper graphql-ws subscription.
    let keeper_prices = state::new_keeper_prices();
    // Arbitrum GMX tickers client (data_source=Gmx price leg).
    let arbitrum = sources::arbitrum_tickers::ArbitrumTickerClient::new(config.arbitrum.clone())
        .wrap_err("failed to construct ArbitrumTickerClient")?;
    // Chainlink Data Streams price fallback, with the mint->feed-id map read from the on-chain TokenMap.
    let cl_feeds = match sources::token_map::fetch_chainlink_feeds(
        &config.rpc.endpoint,
        &config.rpc.store,
    )
    .await
    {
        Ok(feeds) => feeds,
        Err(err) => {
            tracing::warn!(error = %err, "failed to read on-chain chainlink feed map; data streams fallback has no feeds");
            std::collections::HashMap::new()
        }
    };
    let chainlink_streams = sources::chainlink_streams::ChainlinkStreamsClient::new(
        config.chainlink_streams.user_id.clone(),
        config.chainlink_streams.secret.clone(),
        cl_feeds,
        config.enable_devnet,
    )
    .wrap_err("failed to construct ChainlinkStreamsClient")?;
    match chainlink_streams.enabled() {
        true => tracing::info!(
            fallback_secs = config.chainlink_streams.fallback_secs,
            feeds = chainlink_streams.feed_count(),
            "chainlink data streams price fallback enabled"
        ),
        false => tracing::info!("chainlink data streams price fallback disabled (no credentials)"),
    }
    // On-chain GLVs published by the refresh loop, consumed by daily-refresh.
    let glvs = Arc::new(arc_swap::ArcSwap::from_pointee(Vec::<
        sources::rpc_markets::RpcGlv,
    >::new()));
    let glv_refs = Arc::new(arc_swap::ArcSwap::from_pointee(
        None::<Vec<sources::rpc_markets::GlvRef>>,
    ));

    // Loads AWS creds/region from the environment.
    let uploader =
        Arc::new(s3::AwsS3Uploader::new(config.s3.region.clone(), config.s3.bucket.clone()).await);

    let health = health::Health::new(config.staleness_secs);

    // Token table from the store's TokenMap enriched by the config overlay. On failure, token-dependent
    // outputs remain empty while the existing health contract continues to reflect refresh-loop freshness.
    let mut token_table_ready = false;
    if config.token_source.enable {
        match sources::token_map::fetch_onchain_tokens(
            &config.token_source.rpc_url,
            &config.token_source.store,
        )
        .await
        {
            Ok(onchain) => {
                let rows = tokens::build_token_rows(&onchain, &config.token_source.overlay);
                tracing::info!(
                    count = rows.len(),
                    "installed token table from on-chain TokenMap"
                );
                // Audit dump of every token's resolved fields plus mint-default decimals_gmx warnings.
                tokens::log_resolved_token_table(&rows, &config.token_source.overlay);
                tokens::install_dynamic_token_rows(rows);
                token_table_ready = true;
            }
            Err(err) => {
                tracing::error!(error = %err, "on-chain token map fetch failed; token table empty");
            }
        }
    }
    if config.extra_token_candles.enabled {
        candle_source_refresh::audit_extra_candle_resolution(&config, token_table_ready);
    }

    let redis = redis_store::RedisStore::connect(&config.redis)
        .wrap_err("failed to construct RedisStore")?;
    match &redis {
        Some(_) => tracing::info!(
            key_prefix = %config.redis.key_prefix,
            nodes = config.redis.cluster_nodes.len(),
            "redis history store enabled"
        ),
        None => tracing::info!("redis history store disabled (in-memory only)"),
    }

    // Health starts not-fresh (503) until the first successful refresh tick; do not pre-tick.
    let app_state = state::AppState {
        config: Arc::new(config.clone()),
        sqd: sources::sqd::SqdSource::new(sqd.clone()),
        candles: sources::candles::CandleSource::new(candle_cache.clone(), candle_tip.clone()),
        sqd_volumes: sqd,
        snapshot: Arc::new(arc_swap::ArcSwap::from_pointee(state::Snapshot::default())),
        candle_data: Arc::new(arc_swap::ArcSwap::from_pointee(state::CandleData::default())),
        daily_cache: Arc::new(arc_swap::ArcSwap::from_pointee(state::DailyCache::default())),
        store_balances: sources::store_balances::StoreBalancesHandle::from_config(&config),
        token_mints: token_mints::TokenMintsHandle::from_config(&config),
        token_mints_market_list: Arc::new(arc_swap::ArcSwapOption::empty()),
        glv_accounts: sources::glv_accounts::GlvAccountsHandle::from_config(&config),
        candle_cache,
        candle_tip,
        arbitrum,
        cl_prices,
        keeper_prices,
        keeper_execution_time:
            sources::keeper_execution_time::KeeperExecutionTimeHandle::from_config(
                &config.keeper_execution_time,
                &config.keeper.graphql_ws_endpoint,
            ),
        arbitrum_prices: Arc::new(arc_swap::ArcSwap::from_pointee(
            std::collections::HashMap::new(),
        )),
        glvs,
        glv_refs,
        volumes: Arc::new(arc_swap::ArcSwap::from_pointee(
            std::collections::HashMap::new(),
        )),
        cl_auth_token: Arc::new(arc_swap::ArcSwap::from_pointee(None)),
        chainlink_candle,
        price_candle,
        uploader,
        health: health.clone(),
        ws: ws::WsBroadcast::new(),
        redis,
        chainlink_streams,
        streams_prices: Arc::new(arc_swap::ArcSwap::from_pointee(Vec::new())),
    };

    if let Some(period) = heartbeat_interval {
        tokio::spawn(metrics::run_heartbeat(health.clone(), period));
    }
    if metrics::critical_path_enabled() {
        tokio::spawn(metrics::run_event_loop_lag());
    }

    // Snapshot refresh loop pulling markets/GLVs from RPC and prices from Arbitrum/Chainlink, driving `health.record_tick()`.
    tokio::spawn(refresh::run(app_state.clone()));
    tokio::spawn(candle_refresh::run_candle_refresh(app_state.clone()));
    // Data Engine auth-token refresher. Only needed by the SSE stream + the prefetch's Data Engine leg,
    // both of which are disabled under price_candle_first -- so skip it then (the token would go unused).
    if !app_state.config.price_candle_first {
        tokio::spawn(candle_source_refresh::run_auth_token_refresh(
            app_state.clone(),
        ));
    }
    tokio::spawn(candle_source_refresh::run_candle_prefetch(
        app_state.clone(),
    ));
    // Chainlink SSE price stream feeding live forming-candle updates + live Chainlink spot prices,
    // reusing the prefetcher's auth token. Skipped under `price_candle_first`: price-candle is then the
    // candle source (forming tip refreshed by the prefetch), the live Chainlink spot price falls to the
    // keeper leg, and the Data Engine SSE would only hot-loop (e.g. 401 against the testnet endpoint with
    // no testnet auth) for no benefit.
    if app_state.config.price_candle_first {
        tracing::info!("candle stream (Data Engine SSE) disabled: price_candle_first -- candles from price-candle, live Chainlink price from keeper");
    } else {
        tokio::spawn(candle_stream::run_candle_stream(app_state.clone()));
    }
    // Keeper (marin) graphql-ws price subscription feeding the data_source=Chainlink price leg (lastprice).
    tokio::spawn(sources::keeper_price::run_keeper_price_subscription(
        app_state.clone(),
    ));
    if app_state.keeper_execution_time.resolved_sources().is_some() {
        tokio::spawn(
            sources::keeper_execution_time::run_keeper_execution_time_subscriptions(
                app_state.keeper_execution_time.clone(),
            ),
        );
    } else {
        tracing::info!("keeper execution time subscriptions disabled");
    }
    tokio::spawn(sources::store_balances::run_store_balances_refresh(
        app_state.clone(),
    ));
    tokio::spawn(sources::token_mints::run_token_mints_refresh(
        app_state.clone(),
    ));
    tokio::spawn(sources::glv_accounts::run_glv_accounts_refresh(
        app_state.clone(),
    ));
    tokio::spawn(daily_refresh::run_daily_refresh(app_state.clone()));
    tokio::spawn(ws::run_push_engine(app_state.clone()));

    // Global request-body cap (bounds `/v2/upload` and any future POST) — configurable, returns 413 over limit.
    let max_body_bytes = app_state.config.limits.max_upload_bytes;
    let router = axum::Router::new()
        .route("/healthz", axum::routing::get(health::healthz))
        .route("/healthz/active", axum::routing::get(health::healthz))
        .route("/ws", axum::routing::get(ws::ws_handler));
    let app = http::routes(router)
        .layer(axum::extract::DefaultBodyLimit::max(max_body_bytes))
        // GeoIP `x-user-country` header layer, applied globally like CORS.
        .layer(geoip::geoip_layer())
        .layer(http::cors_layer())
        .with_state(app_state);
    let app = if metrics::critical_path_enabled() {
        app.layer(axum::middleware::from_fn(metrics::http_middleware))
    } else {
        app
    };
    let listener = tokio::net::TcpListener::bind(&config.api_address).await?;
    tracing::info!(address = %config.api_address, "listening");
    // `into_make_service_with_connect_info` wires the peer `SocketAddr` into request extensions for the GeoIP fallback.
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;
    Ok(())
}
