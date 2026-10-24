//! Aggregate the per-index-token [`IndexInfo`] list by grouping `view_flg` rows in table order.

use std::collections::HashMap;

use crate::dto::{IndexInfo, MarketInfo};
use crate::tokens::{get_one_token_price, token_rows};

/// A built [`MarketInfo`] plus `enabled` (drives `IndexInfo.gtEnabled`). `enabled != !closed`.
pub struct MarketAgg<'a> {
    pub info: &'a MarketInfo,
    pub enabled: bool,
}

/// `percentChange24h = (current - old) / old * 10000` bps formatted `{:.0}`, `"0"` on zero/non-finite `old_close`.
pub fn percent_change_24h(old_close: f64, current_close: f64) -> String {
    if old_close == 0.0 || !old_close.is_finite() || !current_close.is_finite() {
        return "0".to_string();
    }
    let bps = (current_close - old_close) / old_close * 10_000.0;
    if !bps.is_finite() {
        return "0".to_string();
    }
    format!("{bps:.0}")
}

/// Build the per-index-token [`IndexInfo`] list, grouping by `index_token` in table order. PURE.
pub fn build_index_infos(
    markets: &[MarketAgg<'_>],
    percent_change_24h: &HashMap<String, String>,
) -> Vec<IndexInfo> {
    let mut groups: HashMap<&str, Vec<&MarketAgg<'_>>> = HashMap::new();
    for m in markets {
        groups
            .entry(m.info.index_token.as_str())
            .or_default()
            .push(m);
    }

    let mut out = Vec::new();
    for row in token_rows() {
        if !row.view_flg {
            continue;
        }
        let group = match groups.get(row.index_token_address) {
            // Skip index tokens with no markets (Go logs + `continue`).
            Some(g) if !g.is_empty() => g,
            _ => continue,
        };

        let first = group[0].info;

        // price = unit_price * 10^decimals (GetOneTokenPrice).
        let unit_price = first.unit_price.clone();
        let price = parse_i128(&unit_price)
            .map(|up| {
                get_one_token_price(up.max(0) as u128, row.decimals.max(0) as u32).to_string()
            })
            .unwrap_or_else(|| "0".to_string());

        let pct = percent_change_24h
            .get(row.index_token_address)
            .cloned()
            .unwrap_or_else(|| "0".to_string());

        out.push(IndexInfo {
            symbol: row.symbol.to_string(),
            index_token: row.index_token_address.to_string(),
            unit_price,
            price,
            percent_change24h: pct,
            volume24h: sum_field(group, |i| &i.volume24h),
            long_open_interest: sum_field(group, |i| &i.long_open_interest),
            short_open_interest: sum_field(group, |i| &i.short_open_interest),
            lp_long: max_field(group, |i| &i.lp_long),
            lp_short: max_field(group, |i| &i.lp_short),
            gt_enabled: group.iter().all(|m| m.enabled),
            max_leverage: max_field(group, |i| &i.max_leverage),
            market_infos: group.iter().map(|m| m.info.clone()).collect(),
        });
    }
    out
}

fn parse_i128(s: &str) -> Option<i128> {
    s.parse::<i128>().ok()
}

/// SUM of a per-market `String` numeric field; unparseable entries contribute `0`.
fn sum_field(group: &[&MarketAgg<'_>], field: impl Fn(&MarketInfo) -> &str) -> String {
    let mut sum: i128 = 0;
    for m in group {
        sum = sum.saturating_add(parse_i128(field(m.info)).unwrap_or(0));
    }
    sum.to_string()
}

/// MAX of a per-market `String` numeric field; `"0"` if nothing parses.
fn max_field(group: &[&MarketAgg<'_>], field: impl Fn(&MarketInfo) -> &str) -> String {
    let mut best: Option<i128> = None;
    for m in group {
        if let Some(v) = parse_i128(field(m.info)) {
            best = Some(match best {
                Some(b) => b.max(v),
                None => v,
            });
        }
    }
    best.map(|b| b.to_string())
        .unwrap_or_else(|| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // SOL is the first `view_flg` row in the table; natural grouping fixture.
    const SOL_INDEX: &str = "So1Zu7vPQQxrguzUehKAyVLpjcc769zxgBuDAsxTUMH";

    /// A `MarketInfo` with every `String` field defaulted so a test sets only what it exercises.
    fn market(index_token: &str) -> MarketInfo {
        MarketInfo {
            index_token: index_token.to_string(),
            market_token: String::new(),
            long_token: String::new(),
            short_token: String::new(),
            unit_price: "0".to_string(),
            volume24h: "0".to_string(),
            long_open_interest: "0".to_string(),
            short_open_interest: "0".to_string(),
            lp_long: "0".to_string(),
            lp_short: "0".to_string(),
            max_leverage: "0".to_string(),
            long_funding_fee_rate_hour: "0".to_string(),
            long_borrowing_fee_rate_hour: "0".to_string(),
            long_net_rate_per_hour: "0".to_string(),
            short_funding_fee_rate_hour: "0".to_string(),
            short_borrowing_fee_rate_hour: "0".to_string(),
            short_net_rate_per_hour: "0".to_string(),
            reserved_value_for_long: "0".to_string(),
            max_reserve_value_for_long: "0".to_string(),
            open_interest_for_long: "0".to_string(),
            max_open_interest_for_long: "0".to_string(),
            reserved_value_for_short: "0".to_string(),
            max_reserve_value_for_short: "0".to_string(),
            open_interest_for_short: "0".to_string(),
            max_open_interest_for_short: "0".to_string(),
            prices: Vec::new(),
            supply: "0".to_string(),
            market_decimals: "9".to_string(),
            min_collateral_factor_for_long: "0".to_string(),
            min_collateral_factor_for_short: "0".to_string(),
            min_collateral_value: "0".to_string(),
            long_to_short_available_liquidity: "0".to_string(),
            short_to_long_available_liquidity: "0".to_string(),
            market_price: "0".to_string(),
            long_token_amount: "0".to_string(),
            short_token_amount: "0".to_string(),
            pool_value_long: "0".to_string(),
            pool_value_short: "0".to_string(),
            long_deposit_capacity_amount: "0".to_string(),
            short_deposit_capacity_amount: "0".to_string(),
            max_long_sellable_usd: "0".to_string(),
            max_short_sellable_usd: "0".to_string(),
            vi_for_swaps: "0".to_string(),
            vi_for_positions: "0".to_string(),
            ml_for_long: "0".to_string(),
            ml_for_short: "0".to_string(),
            off_for_positive: "0".to_string(),
            off_for_negative: "0".to_string(),
            mcmcf_for_liquidation: "0".to_string(),
            closed: false,
            tvl: "0".to_string(),
        }
    }

    #[test]
    fn percent_change_24h_hand_computed() {
        // +10%: (110-100)/100 * 10000 = 1000 bps -> "1000".
        assert_eq!(percent_change_24h(100.0, 110.0), "1000");
        assert_eq!(percent_change_24h(100.0, 99.5), "-50");
        assert_eq!(percent_change_24h(100.0, 100.0), "0");
        assert_eq!(percent_change_24h(50.0, 100.0), "10000");
        assert_eq!(percent_change_24h(100.0, 0.0), "-10000");
    }

    #[test]
    fn percent_change_24h_fractional_rounds_like_go_sprintf_dot_zero_f() {
        // Rust `{:.0}` matches Go `%.0f` bit-for-bit (round-half-to-even on the f64).
        assert_eq!(percent_change_24h(100.0, 100.005), "0");
        // (100.015-100)/100*10000 = 1.5000000000000568 -> "2".
        assert_eq!(percent_change_24h(100.0, 100.015), "2");
        // exact-half f64 -> nearest even.
        assert_eq!(format!("{:.0}", 2.5_f64), "2");
        assert_eq!(format!("{:.0}", 3.5_f64), "4");
    }

    #[test]
    fn build_index_infos_emits_one_indexinfo_per_nonempty_group_in_table_order() {
        // Two SOL markets -> one SOL IndexInfo, markets preserved in given order.
        let m0 = market(SOL_INDEX);
        let mut m1 = market(SOL_INDEX);
        m1.market_token = "SECOND".to_string();
        let aggs = vec![
            MarketAgg {
                info: &m0,
                enabled: true,
            },
            MarketAgg {
                info: &m1,
                enabled: true,
            },
        ];
        let out = build_index_infos(&aggs, &HashMap::new());
        assert_eq!(out.len(), 1);
        let sol = &out[0];
        assert_eq!(sol.symbol, "SOL");
        assert_eq!(sol.index_token, SOL_INDEX);
        // markets carried in the given order.
        assert_eq!(sol.market_infos.len(), 2);
        assert_eq!(sol.market_infos[1].market_token, "SECOND");
    }

    #[test]
    fn build_index_infos_keeps_non_displayable_usdc_out_of_index_data() {
        let usdc = token_rows()
            .iter()
            .find(|row| row.symbol == "USDC")
            .expect("USDC token row");
        assert!(!usdc.view_flg);
        let market = market(usdc.index_token_address);
        let aggs = [MarketAgg {
            info: &market,
            enabled: true,
        }];

        let out = build_index_infos(&aggs, &HashMap::new());

        assert!(out.iter().all(|info| info.symbol != "USDC"));
    }

    #[test]
    fn build_index_infos_sums_volume_and_oi_max_lp_and_leverage() {
        let mut m0 = market(SOL_INDEX);
        m0.volume24h = "100".to_string();
        m0.long_open_interest = "10".to_string();
        m0.short_open_interest = "5".to_string();
        m0.lp_long = "1000".to_string();
        m0.lp_short = "20".to_string();
        m0.max_leverage = "50".to_string();
        let mut m1 = market(SOL_INDEX);
        m1.volume24h = "250".to_string();
        m1.long_open_interest = "7".to_string();
        m1.short_open_interest = "3".to_string();
        m1.lp_long = "999".to_string();
        m1.lp_short = "80".to_string();
        m1.max_leverage = "100".to_string();
        let aggs = vec![
            MarketAgg {
                info: &m0,
                enabled: true,
            },
            MarketAgg {
                info: &m1,
                enabled: true,
            },
        ];
        let out = build_index_infos(&aggs, &HashMap::new());
        let sol = &out[0];
        // SUM volume / OI; MAX lp / leverage.
        assert_eq!(sol.volume24h, "350");
        assert_eq!(sol.long_open_interest, "17");
        assert_eq!(sol.short_open_interest, "8");
        assert_eq!(sol.lp_long, "1000");
        assert_eq!(sol.lp_short, "80");
        assert_eq!(sol.max_leverage, "100");
    }

    #[test]
    fn build_index_infos_unparseable_numeric_sums_as_zero_max_ignored() {
        // A garbage field contributes 0 to a sum and is ignored for a max.
        let mut m0 = market(SOL_INDEX);
        m0.volume24h = "notanumber".to_string();
        m0.lp_long = "garbage".to_string();
        let mut m1 = market(SOL_INDEX);
        m1.volume24h = "42".to_string();
        m1.lp_long = "7".to_string();
        let aggs = vec![
            MarketAgg {
                info: &m0,
                enabled: true,
            },
            MarketAgg {
                info: &m1,
                enabled: true,
            },
        ];
        let out = build_index_infos(&aggs, &HashMap::new());
        assert_eq!(out[0].volume24h, "42"); // 0 + 42
        assert_eq!(out[0].lp_long, "7"); // garbage ignored, max = 7
    }
}
