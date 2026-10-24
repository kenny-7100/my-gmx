//! Operator-tunable runtime params installed once at startup from config; accessors fall back to defaults (the previous hardcoded values) when uninstalled (tests).

use std::sync::OnceLock;

/// Operator-tunable runtime parameters (candle period contracts + share URLs).
#[derive(Debug, Clone)]
pub struct RuntimeParams {
    /// Candle periods the WS `candlesv2` subscription accepts.
    pub valid_periods: Vec<String>,
    /// Candle periods computed/streamed directly (must be alignable by `align_ts`).
    pub direct_periods: Vec<String>,
    /// Chainlink stream subscription batch size.
    pub stream_group_size: usize,
    /// Position-share image host (`/api/s` Open Graph image URL).
    pub share_image_host: String,
    /// Position-share default redirect target.
    pub share_redirect_default: String,
    /// Position-share redirect when `p=g`.
    pub share_redirect_gmtrade: String,
}

impl Default for RuntimeParams {
    fn default() -> Self {
        let v = |xs: &[&str]| xs.iter().map(|s| s.to_string()).collect();
        Self {
            valid_periods: v(&["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"]),
            direct_periods: v(&["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"]),
            stream_group_size: 5,
            share_image_host: "https://positionsharing.gmxsolana.io".to_string(),
            share_redirect_default: "https://gmxsol.io/".to_string(),
            share_redirect_gmtrade: "https://gmtrade.xyz/".to_string(),
        }
    }
}

static PARAMS: OnceLock<RuntimeParams> = OnceLock::new();

/// Install the runtime params (idempotent: first set wins).
pub fn install(p: RuntimeParams) {
    let _ = PARAMS.set(p);
}

/// The active runtime params (installed, else defaults).
pub fn params() -> &'static RuntimeParams {
    PARAMS.get_or_init(RuntimeParams::default)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_valid_period_is_fetched_directly_by_default() {
        let params = RuntimeParams::default();
        assert_eq!(params.direct_periods, params.valid_periods);
    }
}
