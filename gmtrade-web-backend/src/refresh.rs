//! Snapshot refresh loop: assemble the [`Snapshot`] from on-chain markets plus Arbitrum/Chainlink prices and swap it into [`AppState::snapshot`].

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use gmsol_keeper_client::{FetchedMarket, FetchedPrice};
use tower::ServiceExt;

use crate::ticker::Cadence;
use crate::util::now_unix;

use crate::aggregate::index_info::{build_index_infos, MarketAgg};
use crate::aggregate::market::{
    model_from_account, parse_raw_price, prices_from_raw, value_market,
};
use crate::aggregate::market_info::build_market_info;
use crate::aggregate::raw_market::extract_raw_fields;
use crate::aggregate::scale::u_to_unit_price;
use crate::aggregate::swap::{build_swap_list, Candle24h};
use crate::aggregate::tickers::{build_sol_tickers, build_tickers, build_tickers_v2};
use gmsol_sdk::solana_utils::solana_client::nonblocking::rpc_client::RpcClient;

use crate::sources::rpc_markets::{discover_market_list, fetch_market_data, MarketList, RpcMarket};
use crate::state::{AppState, Snapshot};
use crate::tokens::{token_by_index_token, token_by_mint};

use crate::metrics;

/// Pure assembly of a [`Snapshot`] from already-fetched source data. NO network.
pub fn build_snapshot(
    markets: &[RpcMarket],
    prices: &[FetchedPrice],
    volumes: &HashMap<String, String>,
    percent_change_24h: &HashMap<String, String>,
    candle_24h: &HashMap<String, Candle24h>,
) -> Snapshot {
    // mint -> (min_raw, max_raw); skip prices missing raw fields.
    let mut px_by_mint: HashMap<&str, (u128, u128)> = HashMap::new();
    for p in prices {
        let (Some(min_s), Some(max_s)) = (p.min_raw.as_deref(), p.max_raw.as_deref()) else {
            continue;
        };
        let (Some(min), Some(max)) = (parse_raw_price(min_s), parse_raw_price(max_s)) else {
            continue;
        };
        px_by_mint.insert(p.pubkey.as_str(), (min, max));
    }

    let mut built: Vec<(crate::dto::MarketInfo, bool)> = Vec::new();

    for rpc in markets {
        let Some(index_token) = token_by_index_token(&rpc.index_token_mint) else {
            tracing::debug!(
                index = %rpc.index_token_mint,
                market = %rpc.market_token,
                "refresh: skipping market with unknown index TokenRow"
            );
            continue;
        };
        let Some(long_token) = token_by_mint(&rpc.long_token_mint) else {
            tracing::debug!(
                long = %rpc.long_token_mint,
                market = %rpc.market_token,
                "refresh: skipping market with unknown long TokenRow"
            );
            continue;
        };
        let Some(short_token) = token_by_mint(&rpc.short_token_mint) else {
            tracing::debug!(
                short = %rpc.short_token_mint,
                market = %rpc.market_token,
                "refresh: skipping market with unknown short TokenRow"
            );
            continue;
        };

        // Index leg drives valuation/unit price; skip the market if it is missing.
        let Some(&index_px) = px_by_mint.get(rpc.index_token_mint.as_str()) else {
            tracing::debug!(
                index = %rpc.index_token_mint,
                market = %rpc.market_token,
                "refresh: skipping market with missing index prices"
            );
            continue;
        };
        let Some(&long_px) = px_by_mint.get(rpc.long_token_mint.as_str()) else {
            tracing::debug!(
                long = %rpc.long_token_mint,
                market = %rpc.market_token,
                "refresh: skipping market with missing long prices"
            );
            continue;
        };
        let Some(&short_px) = px_by_mint.get(rpc.short_token_mint.as_str()) else {
            tracing::debug!(
                short = %rpc.short_token_mint,
                market = %rpc.market_token,
                "refresh: skipping market with missing short prices"
            );
            continue;
        };

        // Convert internal U to unit price A (`/10^dec`) at the valuation/marketInfo boundary: the SDK model and indexData `prices` expect on-chain A.
        let to_a = |px: (u128, u128), dec: i8| {
            let d = dec.max(0) as u32;
            (u_to_unit_price(px.0, d), u_to_unit_price(px.1, d))
        };
        let index_a = to_a(index_px, index_token.decimals);
        let long_a = to_a(long_px, long_token.decimals);
        let short_a = to_a(short_px, short_token.decimals);

        let model = model_from_account(rpc.market.clone(), rpc.supply);
        let raw = extract_raw_fields(&model);
        let valuation = match value_market(&model, &prices_from_raw(index_a, long_a, short_a)) {
            Ok(v) => v,
            Err(err) => {
                tracing::debug!(error = %err, market = %rpc.market_token, "refresh: market valuation failed; skipping");
                continue;
            }
        };

        let volume24h = volumes
            .get(&rpc.market_token)
            .map(String::as_str)
            .unwrap_or("0");

        let fetched = rpc.to_fetched();
        let info = build_market_info(
            &fetched,
            &valuation,
            &raw,
            index_token,
            long_token,
            short_token,
            index_a,
            long_a,
            short_a,
            volume24h,
        );
        built.push((info, raw.enabled));
    }

    let market_aggs: Vec<MarketAgg<'_>> = built
        .iter()
        .map(|(info, enabled)| MarketAgg {
            info,
            enabled: *enabled,
        })
        .collect();

    let index_infos = build_index_infos(&market_aggs, percent_change_24h);
    let tickers = build_tickers(prices);
    let tickers_v2 = build_tickers_v2(prices, None);
    let sol_tickers = build_sol_tickers(prices);
    // `build_swap_list` reads only scalar market fields -> FetchedMarket views.
    let fetched_views: Vec<FetchedMarket> = markets.iter().map(RpcMarket::to_fetched).collect();
    let swap_list = build_swap_list(&fetched_views, prices, candle_24h);

    Snapshot {
        index_infos: Arc::new(index_infos),
        tickers: Arc::new(tickers),
        tickers_v2: Arc::new(tickers_v2),
        sol_tickers: Arc::new(sol_tickers),
        swap_list: Arc::new(swap_list),
    }
}

/// Whether a fetched market has its on-chain `Enabled` flag set. Decodes the
/// account via the same path `build_snapshot` uses for field extraction.
pub fn market_enabled(rpc: &RpcMarket) -> bool {
    extract_raw_fields(&model_from_account(rpc.market.clone(), rpc.supply)).enabled
}

/// Drop on-chain-disabled markets when `enabled_only`, matching the old Go
/// enabled-only allowlist; a no-op (returns all) when the toggle is off.
pub fn filter_enabled_markets(markets: Vec<RpcMarket>, enabled_only: bool) -> Vec<RpcMarket> {
    if !enabled_only {
        return markets;
    }
    markets.into_iter().filter(market_enabled).collect()
}

/// Snapshot the live Chainlink Data Engine SSE price map (`query_symbol -> (raw, ts)`), the PRIMARY Chainlink-leg source.
fn chainlink_prices(state: &AppState) -> HashMap<String, (u128, i64)> {
    state
        .cl_prices
        .lock()
        .map(|m| m.clone())
        .unwrap_or_default()
}

/// Snapshot the live keeper (marin) price map (`mint -> (min_unit_price, max_unit_price, ts)`), the Chainlink-leg FALLBACK.
fn keeper_prices(state: &AppState) -> HashMap<String, (u128, u128, i64)> {
    state
        .keeper_prices
        .lock()
        .map(|m| m.clone())
        .unwrap_or_default()
}

/// Rebuild `sol_tickers` from the last Arbitrum prices plus the live Chainlink SSE map (keeper fallback for stale/missing) so the WS push stays sub-second fresh.
pub fn live_sol_tickers(state: &AppState) -> Vec<crate::dto::SolTicker> {
    let arbitrum = state.arbitrum_prices.load();
    let chainlink = chainlink_prices(state);
    let keeper = keeper_prices(state);
    let mut prices = crate::aggregate::price_source::build_prices(
        &arbitrum,
        &chainlink,
        &keeper,
        now_unix(),
        state.config.keeper.stale_secs as i64,
    );
    let priced: std::collections::HashSet<String> =
        prices.iter().map(|p| p.pubkey.clone()).collect();
    for sp in state.streams_prices.load().iter() {
        if !priced.contains(&sp.pubkey) {
            prices.push(sp.clone());
        }
    }
    crate::aggregate::tickers::build_sol_tickers(&prices)
}

/// Rebuild the [`Snapshot`] once from cheap market/GLV data plus Arbitrum/Chainlink prices, keeping the previous snapshot on any failed or empty fetch.
pub async fn rebuild(
    state: &AppState,
    rpc: &RpcClient,
    list: &MarketList,
    refresh_volume: bool,
    refresh_streams: bool,
) {
    let refresh = metrics::RefreshGuard::start(metrics::Worker::Snapshot);
    let upstream =
        metrics::UpstreamGuard::start_if(metrics::UpstreamOperation::FetchMarketAccounts, || {
            !list.markets.is_empty() || !list.glvs.is_empty()
        });
    // Market/GLV account data from the cached list via cheap getMultipleAccounts.
    let fetched = fetch_market_data(rpc, list).await;
    upstream.finish_result(&fetched, |(markets, glvs)| {
        markets.is_empty() && glvs.is_empty()
    });
    let (markets, glvs) = match fetched {
        Ok(mg) => mg,
        Err(err) => {
            tracing::warn!(error = %err, "refresh: rpc market data fetch failed; keeping previous snapshot");
            refresh.finish(metrics::RefreshResult::Failure);
            return;
        }
    };
    // Drop on-chain-disabled markets (default) so the snapshot — and every daily
    // series derived from it — only surfaces enabled markets, matching the old Go
    // allowlist. Toggle via `enabled_markets_only`.
    let markets = filter_enabled_markets(markets, state.config.enabled_markets_only);
    if markets.is_empty() {
        tracing::warn!("refresh: rpc returned no enabled markets; keeping previous snapshot");
        refresh.finish(metrics::RefreshResult::Completed);
        return;
    }
    // Publish GLVs for the daily-refresh loop (representative market + supply).
    state.glvs.store(Arc::new(glvs));

    // Prices come from Arbitrum and the Chainlink live map; keep the previous snapshot on Arbitrum failure rather than serving a half-baked result.
    let upstream = metrics::UpstreamGuard::start(metrics::UpstreamOperation::ArbitrumTickers);
    let fetched = state.arbitrum.fetch().await;
    upstream.finish_result(&fetched, HashMap::is_empty);
    let arbitrum = match fetched {
        Ok(m) => m,
        Err(err) => {
            tracing::warn!(error = %err, "refresh: arbitrum tickers fetch failed; keeping previous snapshot");
            refresh.finish(metrics::RefreshResult::Failure);
            return;
        }
    };
    // Publish raw Arbitrum prices so the WS tickers push can rebuild sol_tickers from the live Chainlink SSE map (keeper fallback) between rebuilds.
    state.arbitrum_prices.store(Arc::new(arbitrum.clone()));
    let chainlink = chainlink_prices(state);
    let keeper = keeper_prices(state);
    let mut prices = crate::aggregate::price_source::build_prices(
        &arbitrum,
        &chainlink,
        &keeper,
        now_unix(),
        state.config.keeper.stale_secs as i64,
    );

    // Low-frequency Chainlink Data Streams fallback for mints no primary source could price, kept last-good and a no-op when credentials are unset.
    if state.chainlink_streams.enabled() {
        let priced: std::collections::HashSet<String> =
            prices.iter().map(|p| p.pubkey.clone()).collect();
        if refresh_streams {
            let mut missing: Vec<String> = markets
                .iter()
                .map(|m| m.index_token_mint.clone())
                .filter(|mint| !priced.contains(mint))
                .collect();
            missing.sort();
            missing.dedup();
            if !missing.is_empty() {
                let fetched = state.chainlink_streams.fetch(&missing, now_unix()).await;
                if !fetched.is_empty() {
                    state.streams_prices.store(Arc::new(fetched));
                }
            }
        }
        // Merge the last-good Data Streams fallback for any mint still unpriced.
        for sp in state.streams_prices.load().iter() {
            if !priced.contains(&sp.pubkey) {
                prices.push(sp.clone());
            }
        }
    }

    // 24h volume runs on its own cadence and is kept last-good, overwriting the cached map only on a non-empty success.
    if refresh_volume {
        let market_tokens: Vec<String> = markets.iter().map(|m| m.market_token.clone()).collect();
        let fetched = fetch_volumes(state, market_tokens).await;
        if !fetched.is_empty() {
            state.volumes.store(Arc::new(fetched));
        }
    }
    let volumes = state.volumes.load_full();

    let cd = state.candle_data.load_full();

    let snap = build_snapshot(
        &markets,
        &prices,
        volumes.as_ref(),
        &cd.percent_change_24h,
        &cd.swap_24h,
    );

    state.snapshot.store(Arc::new(snap));
    state.health.record_tick();
    refresh.finish(metrics::RefreshResult::Completed);
}

/// Fetch 24h volumes via the sqd Tower service, returning an empty map on any upstream error.
async fn fetch_volumes(state: &AppState, market_tokens: Vec<String>) -> HashMap<String, String> {
    if market_tokens.is_empty() {
        return HashMap::new();
    }
    let req = gmsol_sqd_client::SqdRequest { market_tokens };
    let upstream = metrics::UpstreamGuard::start(metrics::UpstreamOperation::SqdVolumes);
    let fetched = state.sqd_volumes.clone().oneshot(req).await;
    upstream.finish_result(&fetched, |response| response.volumes.is_empty());
    match fetched {
        // `volumes` is already `market_token -> raw volume24h string`.
        Ok(resp) => resp.volumes,
        Err(err) => {
            tracing::warn!(error = %err, "refresh: sqd 24h volume fetch failed; using empty map");
            HashMap::new()
        }
    }
}

/// The refresh loop running a cheap per-tick data rebuild and a rarer expensive list re-discovery, keeping the previous list on a discovery failure.
pub async fn run(state: AppState) {
    let refresh_secs = state.config.refresh_secs.max(1);
    // The discovery interval can never be shorter than the data refresh.
    let list_refresh_secs = state.config.market_list_refresh_secs.max(refresh_secs);
    // 24h-volume sqd refresh, decoupled from the 5s snapshot (floored at refresh_secs).
    let volume_refresh_secs = state.config.volume_refresh_secs.max(refresh_secs);
    // Chainlink Data Streams fallback refresh, decoupled from the 5s snapshot.
    let streams_refresh_secs = state
        .config
        .chainlink_streams
        .fallback_secs
        .max(refresh_secs);
    let endpoint = state.config.rpc.endpoint.clone();
    let store = state.config.rpc.store.clone();

    // One reused RPC client for the cheap per-tick getMultipleAccounts.
    let rpc = RpcClient::new(endpoint.clone());

    let mut interval = crate::ticker::interval(refresh_secs);

    // Redact the api-key embedded in the RPC URL before logging.
    let rpc_endpoint = crate::config::redact_url(&endpoint);
    tracing::info!(
        refresh_secs,
        list_refresh_secs,
        rpc_endpoint = %rpc_endpoint,
        "rpc/price refresh loop started"
    );

    let mut list: Option<MarketList> = None;
    // Each gate fires on its first check, then on its own cadence (monotonic clock).
    let mut discovery = Cadence::new(list_refresh_secs);
    let mut feeds = Cadence::new(list_refresh_secs);
    let mut volume = Cadence::new(volume_refresh_secs);
    let mut streams = Cadence::new(streams_refresh_secs);
    loop {
        interval.tick().await;
        let now = Instant::now();

        // (Re)discover the list when missing or stale via the expensive getProgramAccounts; only mark on success so it retries until it lands.
        if list.is_none() || discovery.due(now) {
            let upstream =
                metrics::UpstreamGuard::start(metrics::UpstreamOperation::DiscoverMarkets);
            let discovered = discover_market_list(&endpoint, &store).await;
            upstream.finish_result(&discovered, |list| {
                list.markets.is_empty() && list.glvs.is_empty()
            });
            match discovered {
                Ok(l) => {
                    tracing::info!(
                        markets = l.markets.len(),
                        glvs = l.glvs.len(),
                        "refresh: discovered market/GLV list"
                    );
                    state
                        .token_mints_market_list
                        .store(Some(Arc::new(l.clone())));
                    state.glv_refs.store(Arc::new(Some(l.glvs.clone())));
                    list = Some(l);
                    discovery.mark(now);
                }
                Err(err) => {
                    tracing::warn!(error = %err, "refresh: market/GLV list discovery failed; keeping previous list");
                }
            }
        }

        // Refresh the Data Streams fallback's mint→feed map on the list-discovery cadence, keep-last-good.
        if state.chainlink_streams.enabled() && feeds.due(now) {
            feeds.mark(now);
            match crate::sources::token_map::fetch_chainlink_feeds(&endpoint, &store).await {
                Ok(feeds) => state.chainlink_streams.update_feeds(feeds),
                Err(err) => {
                    tracing::warn!(error = %err, "refresh: chainlink feed-map re-read failed; keeping previous")
                }
            }
        }

        let Some(list_ref) = list.as_ref() else {
            tracing::warn!("refresh: no market list yet; skipping rebuild");
            continue;
        };

        // Gate the sqd volume fetch to `volume_refresh_secs`, stamping the attempt regardless of success so it is never hammered.
        let refresh_volume = volume.due(now);
        if refresh_volume {
            volume.mark(now);
        }
        // Gate the Data Streams fallback fetch to its cadence (keep-last-good in rebuild).
        let refresh_streams = streams.due(now);
        if refresh_streams {
            streams.mark(now);
        }
        rebuild(&state, &rpc, list_ref, refresh_volume, refresh_streams).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use gmsol_sdk::programs::bytemuck::Zeroable;
    use gmsol_sdk::programs::gmsol_store::accounts::Market;

    // SOL: Gmx row, index_token_address; decimals 9/9. wrapped = wrapped-SOL.
    const SOL_INDEX: &str = "So1Zu7vPQQxrguzUehKAyVLpjcc769zxgBuDAsxTUMH";
    // USDC: Gmx, decimals 6/6.
    const USDC_INDEX: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    /// An [`RpcMarket`] over a zeroed `Market` with the given primary-pool amounts.
    fn rpc_market(index: &str, long: &str, short: &str, market_token: &str) -> RpcMarket {
        let mut m = Market::zeroed();
        m.state.pools.primary.pool.long_token_amount = 1000;
        m.state.pools.primary.pool.short_token_amount = 2000;
        RpcMarket {
            market: Arc::new(m),
            market_token: market_token.to_string(),
            index_token_mint: index.to_string(),
            long_token_mint: long.to_string(),
            short_token_mint: short.to_string(),
            market_token_mint: market_token.to_string(),
            supply: 1_000_000,
            market_token_decimals: 9,
        }
    }

    /// A price with MARKET_USD_UNIT-scaled unit prices so `value_market` succeeds.
    fn price(mint: &str) -> FetchedPrice {
        use gmsol_sdk::constants::MARKET_USD_UNIT;
        FetchedPrice {
            pubkey: mint.to_string(),
            min: 0.0,
            max: 0.0,
            mid: 0.0,
            min_raw: Some(MARKET_USD_UNIT.to_string()),
            max_raw: Some(MARKET_USD_UNIT.to_string()),
            ts: Some(1_700),
        }
    }

    #[test]
    fn build_snapshot_candle_maps_flow_into_24h_fields_non_zero() {
        // Non-empty candle maps flow through build_snapshot into the 24h fields (NON-"0").
        let markets = vec![rpc_market(SOL_INDEX, SOL_INDEX, USDC_INDEX, "MKT_SOL")];
        let prices = vec![price(SOL_INDEX), price(USDC_INDEX)];

        // percent_change_24h keyed by index_token_address (SOL).
        let mut pct = HashMap::new();
        pct.insert(SOL_INDEX.to_string(), "1000".to_string());
        // candle_24h keyed by SYMBOL (how build_swap_list looks it up).
        let mut candle = HashMap::new();
        candle.insert(
            "SOL".to_string(),
            Candle24h {
                max_unit_price_24h: "13000000000000".to_string(),
                min_unit_price_24h: "9000000000000".to_string(),
                percent_change_24h: "1000".to_string(),
            },
        );

        let snap = build_snapshot(&markets, &prices, &HashMap::new(), &pct, &candle);

        // IndexInfo percentChange24h flowed in (non-"0").
        let sol = snap
            .index_infos
            .iter()
            .find(|i| i.index_token == SOL_INDEX)
            .expect("SOL IndexInfo present");
        assert_eq!(sol.percent_change24h, "1000");

        // swapList 24h fields flowed in for the SOL swap token (non-"0").
        let sol_swap = snap
            .swap_list
            .iter()
            .find(|s| s.token_address == SOL_INDEX)
            .expect("SOL swap token present");
        assert_eq!(sol_swap.max_unit_price24h, "13000000000000");
        assert_eq!(sol_swap.min_unit_price24h, "9000000000000");
        assert_eq!(sol_swap.percent_change24h, "1000");
    }

    /// An [`RpcMarket`] with the on-chain `Enabled` flag set.
    fn enabled_rpc_market(market_token: &str) -> RpcMarket {
        let mut m = Market::zeroed();
        m.flags
            .set_flag(gmsol_sdk::core::market::MarketFlag::Enabled, true);
        RpcMarket {
            market: Arc::new(m),
            market_token: market_token.to_string(),
            index_token_mint: SOL_INDEX.to_string(),
            long_token_mint: SOL_INDEX.to_string(),
            short_token_mint: USDC_INDEX.to_string(),
            market_token_mint: market_token.to_string(),
            supply: 1_000_000,
            market_token_decimals: 9,
        }
    }

    #[test]
    fn filter_enabled_markets_drops_disabled_only_when_toggled_on() {
        // A zeroed Market has the `Enabled` flag unset -> disabled.
        let disabled = rpc_market(SOL_INDEX, SOL_INDEX, USDC_INDEX, "MKT_DIS");
        assert!(!market_enabled(&disabled));
        assert!(market_enabled(&enabled_rpc_market("MKT_EN")));

        // enabled_only = true -> only the enabled market survives.
        let kept = filter_enabled_markets(
            vec![
                rpc_market(SOL_INDEX, SOL_INDEX, USDC_INDEX, "MKT_DIS"),
                enabled_rpc_market("MKT_EN"),
            ],
            true,
        );
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].market_token, "MKT_EN");

        // enabled_only = false -> both pass through unchanged.
        let all = filter_enabled_markets(
            vec![
                rpc_market(SOL_INDEX, SOL_INDEX, USDC_INDEX, "MKT_DIS"),
                enabled_rpc_market("MKT_EN"),
            ],
            false,
        );
        assert_eq!(all.len(), 2);
    }
}
