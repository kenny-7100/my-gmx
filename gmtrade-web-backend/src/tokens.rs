//! Token table (built from the on-chain TokenMap + config overlay) plus price-scaling helpers, with Go's `big.Int` modelled as `u128`.

/// Price datasource for a token (Go `DataSourceType`: `None=1`, `Gmx=2`, `Chainlink=3`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DataSource {
    None,
    Gmx,
    Chainlink,
}

/// A single static token configuration row (mirrors Go's `TokenRow`).
#[derive(Debug, Clone)]
pub struct TokenRow {
    pub symbol: &'static str,
    pub name: &'static str,
    pub is_synthetic: bool,
    pub data_source: DataSource,
    pub view_flg: bool,
    pub is_usd_based: bool,
    pub decimals: i8,
    pub decimals_gmx: i8,
    pub index_token_address: &'static str,
    pub wrapped_address: &'static str,
}

/// USD / market-value decimals, sourced from the SDK `MARKET_DECIMALS` (Go `USD_DECIMALS`).
pub const USD_DECIMALS: u32 = gmsol_sdk::constants::MARKET_DECIMALS as u32;
/// Chainlink Data Engine price decimals (Chainlink-specific, so kept local).
pub const CHAINLINK_DECIMALS: u32 = 18;
/// GMX oracle price representation decimals (not exported by the SDK, so kept local).
pub const GMX_PRICE_DECIMALS: u32 = 30;
/// `GMX_PRICE_DECIMALS - USD_DECIMALS` (Go `DecimalsAdjustment = 10`).
pub const DECIMALS_ADJUSTMENT: u32 = GMX_PRICE_DECIMALS - USD_DECIMALS;
/// `USD_DECIMALS - CHAINLINK_DECIMALS` (Go `DecimalsDiff = 2`).
pub const DECIMALS_DIFF: u32 = USD_DECIMALS - CHAINLINK_DECIMALS;

/// The token table built at startup from the on-chain TokenMap + config overlay, with no static fallback (empty until installed).
static DYNAMIC_ROWS: std::sync::OnceLock<&'static [TokenRow]> = std::sync::OnceLock::new();

/// Install the token table (idempotent first-set-wins; the `Vec` is leaked to `&'static`).
pub fn install_dynamic_token_rows(rows: Vec<TokenRow>) {
    let _ = DYNAMIC_ROWS.set(Box::leak(rows.into_boxed_slice()));
}

/// The active token table once installed, else empty (or [`TEST_FIXTURE_ROWS`] under `cfg(test)`).
pub fn token_rows() -> &'static [TokenRow] {
    if let Some(r) = DYNAMIC_ROWS.get() {
        return r;
    }
    #[cfg(test)]
    {
        TEST_FIXTURE_ROWS
    }
    #[cfg(not(test))]
    {
        &[]
    }
}

/// A representative token subset used ONLY by unit tests.
#[cfg(test)]
static TEST_FIXTURE_ROWS: &[TokenRow] = &[
    TokenRow {
        symbol: "SOL",
        name: "SOL",
        is_synthetic: false,
        data_source: DataSource::Gmx,
        view_flg: true,
        is_usd_based: true,
        decimals: 9,
        decimals_gmx: 9,
        index_token_address: "So1Zu7vPQQxrguzUehKAyVLpjcc769zxgBuDAsxTUMH",
        wrapped_address: "So11111111111111111111111111111111111111112",
    },
    TokenRow {
        symbol: "BTC",
        name: "BTC",
        is_synthetic: true,
        data_source: DataSource::Gmx,
        view_flg: true,
        is_usd_based: true,
        decimals: 8,
        decimals_gmx: 8,
        index_token_address: "BtcTQYRj7HRRk7MwnWiTFj8rWqN2ALt2QYig4cSWqTbv",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "ETH",
        name: "ETH",
        is_synthetic: true,
        data_source: DataSource::Gmx,
        view_flg: true,
        is_usd_based: true,
        decimals: 8,
        decimals_gmx: 18,
        index_token_address: "EthK4kKnQQUd1Ae1w7sdiMAUaJwq2RMwr7AtscXEdEsF",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "AVAX",
        name: "AVAX",
        is_synthetic: true,
        data_source: DataSource::Gmx,
        view_flg: true,
        is_usd_based: true,
        decimals: 8,
        decimals_gmx: 18,
        index_token_address: "KgV1GvrHQmRBY8sHQQeUKwTm2r2h8t4C8qt12Cw1HVE",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "SHIB",
        name: "SHIB",
        is_synthetic: true,
        data_source: DataSource::Chainlink,
        view_flg: true,
        is_usd_based: true,
        decimals: 6,
        decimals_gmx: 18,
        index_token_address: "ShibkCetJam99AeDv93Q4KKVkeLCBSLSmBKNLpwt1ik",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "DOGE",
        name: "DOGE",
        is_synthetic: true,
        data_source: DataSource::Gmx,
        view_flg: true,
        is_usd_based: true,
        decimals: 8,
        decimals_gmx: 8,
        index_token_address: "DogeJP1vR955QsXWKT1vw5gJsyiTthqPEtJZj8enDWxF",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "BONK",
        name: "BONK",
        is_synthetic: false,
        data_source: DataSource::Chainlink,
        view_flg: true,
        is_usd_based: true,
        decimals: 5,
        decimals_gmx: 5,
        index_token_address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "PEPE",
        name: "PEPE",
        is_synthetic: true,
        data_source: DataSource::Chainlink,
        view_flg: true,
        is_usd_based: true,
        decimals: 5,
        decimals_gmx: 18,
        index_token_address: "PepeCS5SuDLkUwfnhmBLsPsVdpy9WR5bmXT4dkipR9i",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "PUMP",
        name: "PUMP",
        is_synthetic: false,
        data_source: DataSource::Gmx,
        view_flg: true,
        is_usd_based: true,
        decimals: 6,
        decimals_gmx: 18,
        index_token_address: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
        wrapped_address: "HTHR6CbWSqrVCB83onNwKKH1W3qpGoKbpqvs9sgK7PEC",
    },
    TokenRow {
        symbol: "ZEC",
        name: "ZEC",
        is_synthetic: true,
        data_source: DataSource::Chainlink,
        view_flg: true,
        is_usd_based: true,
        decimals: 8,
        decimals_gmx: 18,
        index_token_address: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "USDJPY",
        name: "USDJPY",
        is_synthetic: true,
        data_source: DataSource::Chainlink,
        view_flg: true,
        is_usd_based: false,
        decimals: 8,
        decimals_gmx: 8,
        index_token_address: "jpygxG9g45Lui4P3GQgfdfNSYcR9985HAcxBRPTHr66",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "SOL",
        name: "SOL",
        is_synthetic: true,
        data_source: DataSource::None,
        view_flg: false,
        is_usd_based: true,
        decimals: 9,
        decimals_gmx: 9,
        index_token_address: "11111111111111111111111111111111",
        wrapped_address: "So11111111111111111111111111111111111111112",
    },
    TokenRow {
        symbol: "WSOL",
        name: "WSOL",
        is_synthetic: false,
        data_source: DataSource::None,
        view_flg: false,
        is_usd_based: true,
        decimals: 9,
        decimals_gmx: 9,
        index_token_address: "So11111111111111111111111111111111111111112",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "USDC",
        name: "USDC",
        is_synthetic: false,
        data_source: DataSource::Gmx,
        view_flg: false,
        is_usd_based: true,
        decimals: 6,
        decimals_gmx: 6,
        index_token_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "WBTC",
        name: "WBTC",
        is_synthetic: false,
        data_source: DataSource::None,
        view_flg: false,
        is_usd_based: true,
        decimals: 8,
        decimals_gmx: 8,
        index_token_address: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "WETH",
        name: "WETH",
        is_synthetic: false,
        data_source: DataSource::None,
        view_flg: false,
        is_usd_based: true,
        decimals: 8,
        decimals_gmx: 18,
        index_token_address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "WPUMP",
        name: "WPUMP",
        is_synthetic: false,
        data_source: DataSource::None,
        view_flg: false,
        is_usd_based: true,
        decimals: 6,
        decimals_gmx: 18,
        index_token_address: "HTHR6CbWSqrVCB83onNwKKH1W3qpGoKbpqvs9sgK7PEC",
        wrapped_address: "",
    },
    TokenRow {
        symbol: "WGMX",
        name: "WGMX",
        is_synthetic: false,
        data_source: DataSource::None,
        view_flg: false,
        is_usd_based: true,
        decimals: 9,
        decimals_gmx: 18,
        index_token_address: "9wX6Qz1Y5YQe71dfnFYFfZYXZhKqjYKQwdqfrRkmYUSX",
        wrapped_address: "",
    },
];

/// One token's on-chain facts from the TokenMap, driving the dynamic table.
#[derive(Debug, Clone)]
pub struct OnchainToken {
    pub mint: String,
    pub symbol: String,
    pub decimals: i8,
}

/// Operator-tunable token overlay, with all maps/sets keyed by token symbol.
#[derive(Debug, Clone, Default, serde::Deserialize)]
pub struct TokenOverlayConfig {
    /// `decimals_gmx` override (price-feed precision); default = on-chain mint decimals.
    #[serde(default)]
    pub decimals_gmx: std::collections::HashMap<String, i8>,
    /// Symbols hidden from the index list (`view_flg = false`).
    #[serde(default)]
    pub view_excludes: std::collections::HashSet<String>,
    /// Wrapped/native mint per symbol (keeper feeds the price under it; e.g. SOL→wSOL).
    #[serde(default)]
    pub wrapped: std::collections::HashMap<String, String>,
    /// Symbols treated as synthetic (excluded from the swap-list wrapped map).
    #[serde(default)]
    pub synthetic: std::collections::HashSet<String>,
    /// Symbols priced off the GMX Arbitrum API (`data_source = Gmx`); default is `Chainlink`.
    #[serde(default)]
    pub data_source_gmx: std::collections::HashSet<String>,
    /// Symbols priced as wrapped collateral (`data_source = None`): WSOL/WBTC/...
    #[serde(default)]
    pub data_source_none: std::collections::HashSet<String>,
    /// Symbols whose quote is NOT USD (`is_usd_based = false`); default is `true`.
    #[serde(default)]
    pub usd_based_false: std::collections::HashSet<String>,
    /// Arbitrum-ticker symbol alias mapping our symbol to GMX's Arbitrum price-API symbol (e.g. `WSOL -> SOL`).
    #[serde(default)]
    pub arbitrum_alias: std::collections::HashMap<String, String>,
}

fn leak_str(s: &str) -> &'static str {
    Box::leak(s.to_string().into_boxed_str())
}

/// Build the token table from on-chain tokens plus the config overlay, defaulting new tokens to USD-based `Gmx` majors.
pub fn build_token_rows(onchain: &[OnchainToken], cfg: &TokenOverlayConfig) -> Vec<TokenRow> {
    onchain
        .iter()
        .map(|t| TokenRow {
            symbol: leak_str(&t.symbol),
            name: leak_str(&t.symbol),
            is_synthetic: cfg.synthetic.contains(&t.symbol),
            data_source: if cfg.data_source_none.contains(&t.symbol) {
                DataSource::None
            } else if cfg.data_source_gmx.contains(&t.symbol) {
                DataSource::Gmx
            } else {
                DataSource::Chainlink
            },
            view_flg: !cfg.view_excludes.contains(&t.symbol),
            is_usd_based: !cfg.usd_based_false.contains(&t.symbol),
            decimals: t.decimals,
            decimals_gmx: cfg
                .decimals_gmx
                .get(&t.symbol)
                .copied()
                .unwrap_or(t.decimals),
            index_token_address: leak_str(&t.mint),
            wrapped_address: cfg
                .wrapped
                .get(&t.symbol)
                .map(|w| leak_str(w))
                .unwrap_or(""),
        })
        .collect()
}

/// Log the resolved token table for post-deploy audit, warning on tokens whose `decimals_gmx` fell back to the mint default.
pub fn log_resolved_token_table(rows: &[TokenRow], cfg: &TokenOverlayConfig) {
    let mut gmx_default: Vec<&str> = Vec::new();
    for r in rows {
        let gmx_src = if cfg.decimals_gmx.contains_key(r.symbol) {
            "config"
        } else {
            gmx_default.push(r.symbol);
            "default(mint)"
        };
        tracing::info!(
            symbol = r.symbol,
            data_source = ?r.data_source,
            is_usd_based = r.is_usd_based,
            is_synthetic = r.is_synthetic,
            view_flg = r.view_flg,
            decimals = r.decimals,
            decimals_gmx = r.decimals_gmx,
            decimals_gmx_src = gmx_src,
            wrapped = r.wrapped_address,
            "token-table resolved"
        );
    }
    tracing::warn!(
        count = gmx_default.len(),
        symbols = ?gmx_default,
        "token-table: decimals_gmx on mint default (no override) -- verify none need one (ZEC-class)"
    );
}

/// First row whose `index_token_address` matches (first match wins).
pub fn token_by_index_token(index_token_address: &str) -> Option<&'static TokenRow> {
    token_rows()
        .iter()
        .find(|r| r.index_token_address == index_token_address)
}

/// First row whose `symbol` matches (first match wins).
pub fn token_by_symbol(symbol: &str) -> Option<&'static TokenRow> {
    token_rows().iter().find(|r| r.symbol == symbol)
}

/// First row whose `index_token_address` OR (non-empty) `wrapped_address` matches `mint` (keeper feeds SOL under wrapped-SOL).
pub fn token_by_mint(mint: &str) -> Option<&'static TokenRow> {
    token_rows().iter().find(|r| {
        r.index_token_address == mint
            || (!r.wrapped_address.is_empty() && r.wrapped_address == mint)
    })
}

/// `10^decimals` as `u128`, saturating at `u128::MAX` on overflow (`>= 39`).
pub fn get_unit(decimals: u32) -> u128 {
    10u128.checked_pow(decimals).unwrap_or(u128::MAX)
}

/// `price * 10^token_decimals / 10^DECIMALS_ADJUSTMENT` (saturating mul, truncating div like Go's `big.Int.Div`).
pub fn adjust_price(price: u128, token_decimals: u32) -> u128 {
    price
        .saturating_mul(get_unit(token_decimals))
        .saturating_div(get_unit(DECIMALS_ADJUSTMENT))
}

/// `unit_price * 10^decimals` (saturating multiply).
pub fn get_one_token_price(unit_price: u128, decimals: u32) -> u128 {
    unit_price.saturating_mul(get_unit(decimals))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_token_rows_is_config_driven_with_safe_defaults() {
        let onchain = vec![
            // SOL: an explicit Gmx-listed major (priced off the Arbitrum API).
            OnchainToken {
                mint: "solMINT".into(),
                symbol: "SOL".into(),
                decimals: 9,
            },
            // NEWCOIN: in no config list -> auto-onboards as a USD-based Chainlink token with default decimals_gmx.
            OnchainToken {
                mint: "newMINT".into(),
                symbol: "NEWCOIN".into(),
                decimals: 7,
            },
        ];
        let mut cfg = TokenOverlayConfig::default();
        cfg.data_source_gmx.insert("SOL".into());

        let rows = build_token_rows(&onchain, &cfg);
        let sol = rows.iter().find(|r| r.symbol == "SOL").unwrap();
        assert_eq!(sol.decimals, 9); // from chain
        assert_eq!(sol.decimals_gmx, 9); // default = mint decimals (no override)
        assert_eq!(sol.data_source, DataSource::Gmx); // config (explicit Gmx list)
        assert!(sol.is_usd_based); // default true
        assert!(sol.view_flg); // default true

        let new = rows.iter().find(|r| r.symbol == "NEWCOIN").unwrap();
        assert_eq!(new.decimals_gmx, 7); // default = mint decimals (no override)
        assert_eq!(new.data_source, DataSource::Chainlink); // default
        assert!(new.is_usd_based && new.view_flg && !new.is_synthetic); // defaults
        assert_eq!(new.index_token_address, "newMINT");
    }

    #[test]
    fn adjust_price_hand_computed() {
        // price=5e12, token_decimals=8: 5e12 * 1e8 / 1e10 = 5e10.
        assert_eq!(adjust_price(5_000_000_000_000, 8), 50_000_000_000);
        // token_decimals == DECIMALS_ADJUSTMENT (10) -> identity.
        assert_eq!(adjust_price(123_456, 10), 123_456);
        assert_eq!(adjust_price(10_000_000_000, 0), 1);
        // 10^39 overflows u128 (max ~3.4e38) -> saturates.
        assert_eq!(get_unit(39), u128::MAX);
    }
}
