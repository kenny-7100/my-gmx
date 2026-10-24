//! Aggregate the WS `swapList` contract (`SwapTokenResp`).

use std::collections::{HashMap, HashSet};

use crate::dto::SwapTokenResp;
use gmsol_keeper_client::{FetchedMarket, FetchedPrice};

use crate::aggregate::market::{model_from_fetched, parse_raw_price};
use crate::aggregate::raw_market::extract_raw_fields;
use crate::aggregate::scale::u_to_unit_price;
use crate::tokens::{token_by_index_token, token_rows, TokenRow};

/// Candle-derived 24h fields for one token, keyed by symbol.
#[derive(Debug, Clone, Default)]
pub struct Candle24h {
    /// `get24HMaxUnitPrice` (high), as a decimal-integer unit-price string.
    pub max_unit_price_24h: String,
    /// `get24HMinUnitPrice` (low), as a decimal-integer unit-price string.
    pub min_unit_price_24h: String,
    /// bps string (e.g. `"1000"`, `"-50"`).
    pub percent_change_24h: String,
}

/// Build the WS `swapList` (`SwapTokenResp`) list in static token-table order.
pub fn build_swap_list(
    markets: &[FetchedMarket],
    prices: &[FetchedPrice],
    candle_24h: &HashMap<String, Candle24h>,
) -> Vec<SwapTokenResp> {
    let decoded: Vec<DecodedMarket> = markets.iter().filter_map(decode_market).collect();

    // token mint -> the balanced markets containing it.
    let mut balanced: HashMap<&str, Vec<&DecodedMarket>> = HashMap::new();
    for m in &decoded {
        if m.long_mint == m.short_mint {
            continue; // pure pool: not balanced.
        }
        balanced.entry(m.long_mint.as_str()).or_default().push(m);
        balanced.entry(m.short_mint.as_str()).or_default().push(m);
    }

    // WrappedAddress -> IndexTokenAddress for non-synthetic rows.
    let wrapped_map: HashMap<&str, &str> = token_rows()
        .iter()
        .filter(|r| !r.is_synthetic && !r.wrapped_address.is_empty())
        .map(|r| (r.wrapped_address, r.index_token_address))
        .collect();

    let price_by_mint: HashMap<&str, &FetchedPrice> =
        prices.iter().map(|p| (p.pubkey.as_str(), p)).collect();

    let mut out = Vec::new();
    // Addresses already emitted (primary or mapped), so the per-address guard is O(1) instead of scanning `out`.
    let mut emitted: HashSet<&str> = HashSet::new();
    // Iterate the static table for deterministic order (Go iterates a map randomly).
    for row in token_rows() {
        let addr = row.index_token_address;
        let Some(pools) = balanced.get(addr) else {
            continue;
        };
        // Guard against WSOL/SOL duplicate index_token rows: emit once per address.
        if emitted.contains(addr) {
            continue;
        }

        // Skip the row when this token has no usable price so we never emit a "0"-priced entry.
        let Some((min_unit, max_unit)) = unit_prices_for(addr, row, &price_by_mint) else {
            continue;
        };
        let amount = get_max_amount(addr, pools);
        let candle = candle_24h.get(row.symbol);

        out.push(SwapTokenResp {
            token_address: addr.to_string(),
            lp_amount: amount.to_string(),
            max_price: max_unit.to_string(),
            min_price: min_unit.to_string(),
            max_unit_price24h: candle_field(candle, |c| &c.max_unit_price_24h),
            min_unit_price24h: candle_field(candle, |c| &c.min_unit_price_24h),
            percent_change24h: candle_field(candle, |c| &c.percent_change_24h),
        });
        emitted.insert(addr);

        // wrapped addr: emit a second row for the mapped index token, re-scaled with mapped decimals.
        if let Some(&mapped_idx) = wrapped_map.get(addr) {
            if let Some((mmin, mmax)) = token_by_index_token(mapped_idx)
                .and_then(|r| unit_prices_for(addr, r, &price_by_mint))
            {
                out.push(SwapTokenResp {
                    token_address: mapped_idx.to_string(),
                    lp_amount: amount.to_string(),
                    max_price: mmax.to_string(),
                    min_price: mmin.to_string(),
                    max_unit_price24h: candle_field(candle, |c| &c.max_unit_price_24h),
                    min_unit_price24h: candle_field(candle, |c| &c.min_unit_price_24h),
                    percent_change24h: candle_field(candle, |c| &c.percent_change_24h),
                });
                emitted.insert(mapped_idx);
            }
        }
    }
    out
}

struct DecodedMarket {
    long_mint: String,
    short_mint: String,
    long_token_amount: u128,
    short_token_amount: u128,
}

/// Decode one [`FetchedMarket`], or `None` on decode failure (caller skips, never panics).
fn decode_market(m: &FetchedMarket) -> Option<DecodedMarket> {
    let model = model_from_fetched(&m.data_base64, m.supply).ok()?;
    let raw = extract_raw_fields(&model);
    Some(DecodedMarket {
        long_mint: m.long_token_mint.clone(),
        short_mint: m.short_token_mint.clone(),
        long_token_amount: raw.long_token_amount,
        short_token_amount: raw.short_token_amount,
    })
}

/// `getMaxAmount`: MAX primary-pool raw amount on the side `addr` sits on, across its pools.
fn get_max_amount(addr: &str, pools: &[&DecodedMarket]) -> u128 {
    let mut max_amount = 0u128;
    for pool in pools {
        let amount = if addr == pool.long_mint {
            pool.long_token_amount
        } else if addr == pool.short_mint {
            pool.short_token_amount
        } else {
            0
        };
        if amount > max_amount {
            max_amount = amount;
        }
    }
    max_amount
}

/// Unit min/max price for `mint` using `row`'s decimals, `None` when it has no usable price (caller skips the row).
fn unit_prices_for(
    mint: &str,
    row: &TokenRow,
    price_by_mint: &HashMap<&str, &FetchedPrice>,
) -> Option<(u128, u128)> {
    let p = price_by_mint.get(mint)?;
    let dec = row.decimals.max(0) as u32;
    // Prices are internal U; convert to unit price A = `P*10^(20-dec)` for the swap-list contract.
    let min_u = parse_raw_price(p.min_raw.as_deref()?)?;
    let max_u = parse_raw_price(p.max_raw.as_deref()?)?;
    Some((u_to_unit_price(min_u, dec), u_to_unit_price(max_u, dec)))
}

/// Extract a candle-derived field, defaulting to `"0"` when absent/empty.
fn candle_field(candle: Option<&Candle24h>, f: impl Fn(&Candle24h) -> &str) -> String {
    candle
        .map(|c| f(c).to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    use gmsol_sdk::programs::bytemuck::{bytes_of, Zeroable};
    use gmsol_sdk::programs::gmsol_store::accounts::Market;
    use gmsol_sdk::utils::base64::encode_base64;

    // SOL index_token_address (Gmx row; wrapped_address = wrapped-SOL mint).
    const SOL_INDEX: &str = "So1Zu7vPQQxrguzUehKAyVLpjcc769zxgBuDAsxTUMH";
    const SOL_WRAPPED: &str = "So11111111111111111111111111111111111111112";
    // USDC index_token_address (Gmx, decimals 6/6).
    const USDC_INDEX: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    /// Build a base64 market blob with given primary-pool amounts.
    fn market_blob(long_amount: u128, short_amount: u128) -> String {
        let mut m = Market::zeroed();
        m.state.pools.primary.pool.long_token_amount = long_amount;
        m.state.pools.primary.pool.short_token_amount = short_amount;
        encode_base64(bytes_of(&m))
    }

    fn fetched(
        long_mint: &str,
        short_mint: &str,
        long_amt: u128,
        short_amt: u128,
    ) -> FetchedMarket {
        FetchedMarket {
            market_token: String::new(),
            pubkey: String::new(),
            slot: 0,
            name: String::new(),
            index_token_mint: long_mint.to_string(),
            long_token_mint: long_mint.to_string(),
            short_token_mint: short_mint.to_string(),
            market_token_mint: String::new(),
            supply: 0,
            market_token_decimals: 0,
            virtual_inventory_for_swaps: String::new(),
            virtual_inventory_for_positions: String::new(),
            data_base64: market_blob(long_amt, short_amt),
        }
    }

    fn price(mint: &str, min_raw: &str, max_raw: &str) -> FetchedPrice {
        FetchedPrice {
            pubkey: mint.to_string(),
            min: 0.0,
            max: 0.0,
            mid: 0.0,
            min_raw: Some(min_raw.to_string()),
            max_raw: Some(max_raw.to_string()),
            ts: Some(1),
        }
    }

    #[test]
    fn only_balanced_pool_tokens_emitted_pure_pool_skipped() {
        // Balanced: SOL/USDC (long != short). Pure: USDC/USDC (long == short) -> ignored.
        let markets = vec![
            fetched(SOL_INDEX, USDC_INDEX, 1000, 2000),
            fetched(USDC_INDEX, USDC_INDEX, 9999, 9999),
        ];
        let prices = vec![
            price(SOL_INDEX, "1000000000000", "1010000000000"),
            price(USDC_INDEX, "100000000", "100000000"),
        ];
        let out = build_swap_list(&markets, &prices, &HashMap::new());
        let addrs: Vec<&str> = out.iter().map(|s| s.token_address.as_str()).collect();
        assert!(addrs.contains(&SOL_INDEX));
        assert!(addrs.contains(&USDC_INDEX));
        // The pure pool's 9999 amount must never surface for USDC.
        let usdc = out.iter().find(|s| s.token_address == USDC_INDEX).unwrap();
        assert_eq!(usdc.lp_amount, "2000");
    }

    #[test]
    fn get_max_amount_takes_correct_side_and_max() {
        // SOL is long collateral in two balanced markets (1000, 3000) -> max = 3000.
        let markets = vec![
            fetched(SOL_INDEX, USDC_INDEX, 1000, 50),
            fetched(SOL_INDEX, USDC_INDEX, 3000, 70),
        ];
        let prices = vec![
            price(SOL_INDEX, "1000000000000", "1010000000000"),
            price(USDC_INDEX, "100000000", "100000000"),
        ];
        let out = build_swap_list(&markets, &prices, &HashMap::new());
        let sol = out.iter().find(|s| s.token_address == SOL_INDEX).unwrap();
        assert_eq!(sol.lp_amount, "3000");
        // USDC is the short side in both -> max(50, 70) = 70.
        let usdc = out.iter().find(|s| s.token_address == USDC_INDEX).unwrap();
        assert_eq!(usdc.lp_amount, "70");
    }

    #[test]
    fn native_wrapped_duplication_for_wrapped_collateral() {
        // wrapped-SOL collateral is a balanced-pool token, so the mapped SOL row is emitted too.
        let markets = vec![fetched(SOL_WRAPPED, USDC_INDEX, 1234, 56)];
        let prices = vec![
            price(SOL_WRAPPED, "1000000000000", "1010000000000"),
            price(USDC_INDEX, "100000000", "100000000"),
        ];
        let out = build_swap_list(&markets, &prices, &HashMap::new());
        let addrs: Vec<&str> = out.iter().map(|s| s.token_address.as_str()).collect();
        assert!(
            addrs.contains(&SOL_WRAPPED),
            "wrapped collateral row present"
        );
        assert!(
            addrs.contains(&SOL_INDEX),
            "mapped native/index row present"
        );
        // Both carry the same lpAmount (the wrapped collateral's long amount).
        let w = out.iter().find(|s| s.token_address == SOL_WRAPPED).unwrap();
        let n = out.iter().find(|s| s.token_address == SOL_INDEX).unwrap();
        assert_eq!(w.lp_amount, "1234");
        assert_eq!(n.lp_amount, "1234");
    }

    #[test]
    fn candle_24h_fields_flow_through_with_defaults() {
        let markets = vec![fetched(SOL_INDEX, USDC_INDEX, 10, 20)];
        let prices = vec![
            price(SOL_INDEX, "1000000000000", "1010000000000"),
            price(USDC_INDEX, "100000000", "100000000"),
        ];
        // No candle data -> defaults "0".
        let out = build_swap_list(&markets, &prices, &HashMap::new());
        let sol = out.iter().find(|s| s.token_address == SOL_INDEX).unwrap();
        assert_eq!(sol.max_unit_price24h, "0");
        assert_eq!(sol.min_unit_price24h, "0");
        assert_eq!(sol.percent_change24h, "0");

        // With injected candle data keyed by symbol "SOL".
        let mut candles = HashMap::new();
        candles.insert(
            "SOL".to_string(),
            Candle24h {
                max_unit_price_24h: "999".to_string(),
                min_unit_price_24h: "111".to_string(),
                percent_change_24h: "234".to_string(),
            },
        );
        let out = build_swap_list(&markets, &prices, &candles);
        let sol = out.iter().find(|s| s.token_address == SOL_INDEX).unwrap();
        assert_eq!(sol.max_unit_price24h, "999");
        assert_eq!(sol.min_unit_price24h, "111");
        assert_eq!(sol.percent_change24h, "234");
    }

    #[test]
    fn unpriced_token_skipped_no_zero_row() {
        // SOL priced, USDC not -> only the SOL row, no "0"-priced USDC entry.
        let markets = vec![fetched(SOL_INDEX, USDC_INDEX, 10, 20)];
        let prices = vec![price(SOL_INDEX, "1000000000000", "1010000000000")];
        let out = build_swap_list(&markets, &prices, &HashMap::new());
        let addrs: Vec<&str> = out.iter().map(|s| s.token_address.as_str()).collect();
        assert!(addrs.contains(&SOL_INDEX), "priced token emitted");
        assert!(
            !addrs.contains(&USDC_INDEX),
            "unpriced token must not emit a 0-price row"
        );
    }
}
