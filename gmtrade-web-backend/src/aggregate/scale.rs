//! Centralized price rescaling: the only boundary between internal U (P*10^20 whole-token) and source raw / unit-price A (P*10^(20-dec)) / ticker B (P*10^(30-gmx)).

use crate::tokens::{get_unit, DECIMALS_DIFF};

/// `value * 10^exp`: saturating multiply for `exp >= 0`, integer-divide (truncating) for `exp < 0`.
pub(crate) fn scale_pow10(value: u128, exp: i32) -> u128 {
    if exp >= 0 {
        value.saturating_mul(10u128.saturating_pow(exp as u32))
    } else {
        let d = 10u128.saturating_pow((-exp) as u32);
        if d == 0 {
            value
        } else {
            value / d
        }
    }
}

/// Chainlink raw (`P*10^18`, Data Engine/Streams) -> internal `U` (`P*10^20`). No dec/gmx.
pub(crate) fn chainlink_raw_to_u(cl_raw: u128) -> u128 {
    scale_pow10(cl_raw, DECIMALS_DIFF as i32) // *10^2
}

/// Arbitrum raw (`B = P*10^(30-gmx)`) -> internal `U`. `gmx` decodes the gmx-scaled input.
pub(crate) fn arb_raw_to_u(arb_raw: u128, gmx: i32) -> u128 {
    scale_pow10(arb_raw, gmx - 10)
}

/// Internal `U` -> unit price `A = P*10^(20-dec)` (one smallest token unit). Truncating divide.
pub(crate) fn u_to_unit_price(u: u128, dec: u32) -> u128 {
    u.saturating_div(get_unit(dec))
}

/// Keeper unit price `A = P*10^(20-dec)` (marin GraphQL `to_unit_price`) -> internal `U = P*10^20`. Inverse of [`u_to_unit_price`].
pub(crate) fn unit_price_to_u(unit_price: u128, dec: u32) -> u128 {
    unit_price.saturating_mul(get_unit(dec))
}

/// Internal `U` -> legacy ticker format `B = P*10^(30-gmx)` (HTTP `Ticker` representation only).
pub(crate) fn u_to_ticker(u: u128, gmx: i32) -> u128 {
    scale_pow10(u, 10 - gmx)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scale_pow10_neg_is_integer_div() {
        assert_eq!(scale_pow10(12_345, 0), 12_345);
        assert_eq!(scale_pow10(5, 3), 5000);
        assert_eq!(scale_pow10(12_345, -2), 123);
    }

    #[test]
    fn chainlink_raw_to_u_is_times_100() {
        // ZEC: $418 -> cl 4.18e20 (*1e18) -> U = 4.18e22 (= 418 * 10^20).
        assert_eq!(
            chainlink_raw_to_u(418_000_000_000_000_000_000),
            41_800_000_000_000_000_000_000
        );
    }

    #[test]
    fn arb_raw_to_u_decodes_gmx() {
        // ETH: $1610, gmx18 -> arb_raw = 1610 * 10^12 = 1.61e15 -> U = *10^8 = 1.61e23.
        assert_eq!(
            arb_raw_to_u(1_610_000_000_000_000, 18),
            161_000_000_000_000_000_000_000
        );
        // SOL: $63.8, gmx9 -> arb_raw = 63.8 * 10^21 = 6.38e22 -> U = *10^-1 = 6.38e21.
        assert_eq!(
            arb_raw_to_u(63_800_000_000_000_000_000_000, 9),
            6_380_000_000_000_000_000_000
        );
    }

    #[test]
    fn u_to_unit_price_divides_by_ten_pow_dec() {
        // U = 1.61e23 (ETH $1610), dec8 -> A = 1.61e15.
        assert_eq!(
            u_to_unit_price(161_000_000_000_000_000_000_000, 8),
            1_610_000_000_000_000
        );
    }

    #[test]
    fn unit_price_to_u_round_trips_keeper_unit_price() {
        // Keeper `to_unit_price` of ETH $1610 at dec8 = P*10^(20-8) = 1.61e15 -> U = 1.61e23.
        assert_eq!(
            unit_price_to_u(1_610_000_000_000_000, 8),
            161_000_000_000_000_000_000_000
        );
        // Inverse of u_to_unit_price across a few decimals (SOL dec9, $63.8).
        let u = 6_380_000_000_000_000_000_000; // 63.8 * 10^20
        assert_eq!(unit_price_to_u(u_to_unit_price(u, 9), 9), u);
    }

    #[test]
    fn u_to_ticker_round_trips_against_arb() {
        // ETH U=1.61e23, gmx18 -> B = *10^(10-18) = 1.61e15 (reproduces the gmx-scaled ticker).
        assert_eq!(
            u_to_ticker(161_000_000_000_000_000_000_000, 18),
            1_610_000_000_000_000
        );
    }
}
