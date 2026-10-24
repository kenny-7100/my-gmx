//! Compose internal-`U` `FetchedPrice`s from Arbitrum GMX tickers and Chainlink Data Engine sources; all scaling via [`crate::aggregate::scale`].

use std::collections::HashMap;

use gmsol_keeper_client::FetchedPrice;

use crate::aggregate::scale::{arb_raw_to_u, chainlink_raw_to_u, unit_price_to_u};
use crate::sources::arbitrum_tickers::normalize_symbol;
use crate::sources::chainlink_candle::data_source_symbol;
use crate::tokens::{token_rows, DataSource};

/// Build the per-mint internal-`U` `FetchedPrice` list over the token table, emitted under each token's index and wrapped addresses.
///
/// `arbitrum` prices the `data_source = Gmx`/`None` leg by normalized symbol. The `data_source = Chainlink`
/// leg prices off the Chainlink Data Engine SSE (`chainlink`, `query_symbol -> (raw, ts)`, the PRIMARY,
/// single price); when that is missing or stale (older than `stale_secs`) it falls back to `keeper`
/// (marin graphql-ws, `mint -> (min_unit_price, max_unit_price, ts)`), stamped with `now`. `stale_secs`
/// is config-driven (`keeper.stale_secs`, default 2, matching the old Go backend's `staleSec`).
pub fn build_prices(
    arbitrum: &HashMap<String, (u128, u128)>,
    chainlink: &HashMap<String, (u128, i64)>,
    keeper: &HashMap<String, (u128, u128, i64)>,
    now: i64,
    stale_secs: i64,
) -> Vec<FetchedPrice> {
    let mut out = Vec::new();
    for row in token_rows() {
        // `gmx` decodes the gmx-scaled Arbitrum input; `dec` lifts the keeper unit price to internal U.
        let gmx = row.decimals_gmx as i32;
        let dec = row.decimals.max(0) as u32;

        let (min_unit, max_unit, ts) = match row.data_source {
            // Gmx-source and None-source wrapped collateral both price off Arbitrum by normalized symbol.
            DataSource::Gmx | DataSource::None => {
                let Some((min, max)) = arbitrum.get(&normalize_symbol(row.symbol)) else {
                    continue;
                };
                (arb_raw_to_u(*min, gmx), arb_raw_to_u(*max, gmx), now)
            }
            DataSource::Chainlink => {
                // PRIMARY: Chainlink Data Engine SSE — single price (min == max), stream tick `ts`.
                let fresh_sse = chainlink
                    .get(&data_source_symbol(row.symbol))
                    .filter(|(_, ts)| now.saturating_sub(*ts) <= stale_secs);
                if let Some((raw, ts)) = fresh_sse {
                    let u = chainlink_raw_to_u(*raw);
                    (u, u, *ts)
                } else {
                    // FALLBACK: keeper, when SSE is missing or stale (older than `stale_secs`). Keeper feeds
                    // under the wrapped mint (e.g. wSOL), else the index mint; stamped `now` (matching old).
                    let Some((min_u, max_u, _kts)) = keeper
                        .get(row.wrapped_address)
                        .or_else(|| keeper.get(row.index_token_address))
                    else {
                        continue;
                    };
                    (
                        unit_price_to_u(*min_u, dec),
                        unit_price_to_u(*max_u, dec),
                        now,
                    )
                }
            }
        };

        for mint in [row.index_token_address, row.wrapped_address] {
            if mint.is_empty() {
                continue;
            }
            out.push(FetchedPrice {
                pubkey: mint.to_string(),
                min: 0.0,
                max: 0.0,
                mid: 0.0,
                min_raw: Some(min_unit.to_string()),
                max_raw: Some(max_unit.to_string()),
                ts: Some(ts),
            });
            if row.wrapped_address == row.index_token_address {
                break; // avoid a duplicate when both fields are identical
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_prices_covers_none_source_wrapped_collateral() {
        // None-source wrapped collateral (WBTC) must be priced off Arbitrum via its base symbol (BTC).
        let mut arb = HashMap::new();
        arb.insert("BTC".to_string(), (1_000u128, 1_000u128));
        let prices = build_prices(&arb, &HashMap::new(), &HashMap::new(), 1_000, 2);
        // WBTC mint (tokens.rs WBTC row, data_source = None) is now priced.
        let wbtc_mint = "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh";
        assert!(
            prices.iter().any(|p| p.pubkey == wbtc_mint),
            "WBTC None-source collateral must be priced via Arbitrum(BTC)"
        );
    }

    /// A Chainlink token: fresh SSE wins (single price min==max, stream ts); when SSE is stale the keeper
    /// fallback fills in (real min/max spread, stamped `now`).
    #[test]
    fn chainlink_leg_prefers_fresh_sse_then_falls_back_to_keeper() {
        // Pick any Chainlink-source row from the static table to drive the test.
        let Some(cl) = token_rows()
            .iter()
            .find(|r| r.data_source == DataSource::Chainlink)
        else {
            return; // no Chainlink token configured in this build's table
        };
        let now = 1_000_000;
        let stale_secs = 2; // exercise the configurable threshold
        let sse_key = data_source_symbol(cl.symbol);
        let keeper_key = if !cl.wrapped_address.is_empty() {
            cl.wrapped_address
        } else {
            cl.index_token_address
        };
        let pubkey = if cl.wrapped_address.is_empty() {
            cl.index_token_address
        } else {
            cl.wrapped_address
        };

        // Fresh SSE (ts == now): primary wins, min == max.
        let mut sse = HashMap::new();
        sse.insert(sse_key.clone(), (1_000u128, now));
        let mut keeper = HashMap::new();
        keeper.insert(keeper_key.to_string(), (5u128, 7u128, now - 100));
        let primary = build_prices(&HashMap::new(), &sse, &keeper, now, stale_secs);
        let p = primary.iter().find(|p| p.pubkey == pubkey).expect("priced");
        assert_eq!(
            p.min_raw, p.max_raw,
            "fresh SSE is a single price (min == max)"
        );
        assert_eq!(p.ts, Some(now), "fresh SSE keeps the stream tick ts");

        // Stale SSE (older than stale_secs): keeper fallback, spread, stamped now.
        let mut stale = HashMap::new();
        stale.insert(sse_key, (1_000u128, now - stale_secs - 1));
        let fb = build_prices(&HashMap::new(), &stale, &keeper, now, stale_secs);
        let p = fb
            .iter()
            .find(|p| p.pubkey == pubkey)
            .expect("priced via keeper");
        assert_ne!(
            p.min_raw, p.max_raw,
            "keeper fallback carries a real min/max spread"
        );
        assert_eq!(p.ts, Some(now), "keeper fallback is stamped now");
    }
}
