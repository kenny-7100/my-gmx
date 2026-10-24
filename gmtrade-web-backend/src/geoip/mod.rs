//! GeoIP `x-user-country` middleware porting `phuslu/iploc` (IP2Location LITE) little-endian data to map client IPs to country codes.

use std::net::IpAddr;
use std::sync::OnceLock;

mod middleware;

pub use middleware::geoip_layer;

/// Little-endian `u32` IPv4 range upper bounds (ascending). `len/4` ranges.
static IPV4_BIN: &[u8] = include_bytes!("data/ipv4le.bin");
/// Parallel 2-byte ASCII country codes for the IPv4 ranges.
static IPV4_TXT: &[u8] = include_bytes!("data/ipv4.txt");
/// Gzipped little-endian `u64` IPv6 range bounds (pairs of high/low).
static IPV6_GZ: &[u8] = include_bytes!("data/ipv6le.gz");
/// Parallel 2-byte ASCII country codes for the IPv6 ranges.
static IPV6_TXT: &[u8] = include_bytes!("data/ipv6.txt");

/// Lazily-decompressed IPv6 bound table (decompressed once on first use).
static IPV6_BIN: OnceLock<Vec<u8>> = OnceLock::new();

fn ipv6_bin() -> &'static [u8] {
    IPV6_BIN.get_or_init(|| {
        use std::io::Read;
        let mut decoder = flate2::read::GzDecoder::new(IPV6_GZ);
        let mut out = Vec::new();
        // Fall back to an empty table on decode failure rather than panicking in the request path.
        if decoder.read_to_end(&mut out).is_err() {
            out.clear();
        }
        out
    })
}

/// Return the ISO 3166-1 alpha-2 country code for `ip` (including the `"ZZ"` sentinel), or `None` if unknown.
pub fn country_of(ip: IpAddr) -> Option<&'static str> {
    match ip {
        IpAddr::V4(v4) => country_v4(u32::from(v4)),
        IpAddr::V6(v6) => {
            // Look up IPv4-mapped addresses as v4.
            if let Some(v4) = v6.to_ipv4_mapped() {
                country_v4(u32::from(v4))
            } else {
                country_v6(v6.octets())
            }
        }
    }
}

/// IPv4 lookup: binary-search for the smallest `i` with `ip4bin[i] > n`, then read `ipv4.txt[i*2-2 .. i*2]`.
fn country_v4(n: u32) -> Option<&'static str> {
    let count = IPV4_BIN.len() / 4;
    let (mut i, mut j) = (0usize, count);
    while i < j {
        let h = (i + j) >> 1;
        let bound = read_u32_le(IPV4_BIN, h);
        if bound > n {
            j = h;
        } else {
            i = h + 1;
        }
    }
    if i == 0 {
        return None;
    }
    code_at(IPV4_TXT, i * 2 - 2)
}

/// IPv6 lookup: 128-bit binary search over even-aligned (high, low) `u64` pairs, then read `ipv6.txt[i-2 .. i]`.
fn country_v6(octets: [u8; 16]) -> Option<&'static str> {
    let high = u64::from_be_bytes(octets[0..8].try_into().unwrap());
    let low = u64::from_be_bytes(octets[8..16].try_into().unwrap());

    let bin = ipv6_bin();
    let count = bin.len() / 8;
    let (mut i, mut j) = (0usize, count);
    while i < j {
        let h = ((i + j) >> 1) & !1usize;
        let n = read_u64_le(bin, h);
        // `n` is this range's high bound; `h+1` is the low bound for the high-equal case.
        if n > high || (n == high && read_u64_le(bin, h + 1) > low) {
            j = h;
        } else {
            i = h + 2;
        }
    }
    if i < 2 {
        return None;
    }
    code_at(IPV6_TXT, i - 2)
}

/// Read the `idx`-th little-endian `u32` from `buf` (idx is a u32-index).
#[inline]
fn read_u32_le(buf: &[u8], idx: usize) -> u32 {
    let off = idx * 4;
    u32::from_le_bytes([buf[off], buf[off + 1], buf[off + 2], buf[off + 3]])
}

/// Read the `idx`-th little-endian `u64` from `buf` (idx is a u64-index).
#[inline]
fn read_u64_le(buf: &[u8], idx: usize) -> u64 {
    let off = idx * 8;
    u64::from_le_bytes([
        buf[off],
        buf[off + 1],
        buf[off + 2],
        buf[off + 3],
        buf[off + 4],
        buf[off + 5],
        buf[off + 6],
        buf[off + 7],
    ])
}

/// Return the 2-byte ASCII country code at byte offset `off` in `txt`.
#[inline]
fn code_at(txt: &'static [u8], off: usize) -> Option<&'static str> {
    let bytes = txt.get(off..off + 2)?;
    std::str::from_utf8(bytes).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::IpAddr;

    /// Look up a string IP, returning `""` for an unknown or unparseable IP.
    fn country(s: &str) -> String {
        match s.parse::<IpAddr>() {
            Ok(ip) => country_of(ip).unwrap_or("").to_string(),
            Err(_) => String::new(),
        }
    }

    /// Test vectors copied verbatim from upstream `iploc_test.go` for v1.0.20260415.
    const VECTORS: &[(&str, &str)] = &[
        ("", ""),
        ("0.0.0.0", "ZZ"),
        ("0.1.1.1", "ZZ"),
        ("121.229.143.64", "CN"),
        ("122.96.43.186", "CN"),
        ("153.3.123.160", "CN"),
        ("153.3.131.201", "CN"),
        ("180.109.81.198", "CN"),
        ("180.111.103.88", "CN"),
        ("183.206.11.225", "CN"),
        ("192.210.171.249", "US"),
        ("223.112.9.2", "CN"),
        ("23.16.28.232", "CA"),
        ("58.240.115.210", "CN"),
        ("61.155.4.66", "CN"),
        ("255.255.255.255", "ZZ"),
        ("2001::6ca0:a535", "ZZ"),
        ("2001:dc7:1000::1", "CN"),
        ("2400:3200::1", "CN"),
        ("2400:da00::6666", "CN"),
        ("2404:6800:4008:801::2004", "TW"),
        ("2404:6800:4012:1::200e", "AU"),
        ("240C::6666", "CN"),
        ("240e:4c:4008::1", "CN"),
        ("240e:e8:f089:4877:70d2:775c:91d1:ab12", "CN"),
        ("2620:0:2d0:200::7", "US"),
        ("2a04:4e42:600::223", "NL"),
        ("::", "ZZ"),
        ("::1", "ZZ"),
    ];

    #[test]
    fn matches_phuslu_iploc_test_vectors() {
        for (ip, expected) in VECTORS {
            assert_eq!(
                &country(ip),
                expected,
                "country({ip:?}) should be {expected:?}",
            );
        }
    }

    #[test]
    fn private_ipv4_is_unknown() {
        // Private ranges are unallocated in IP2Location, resolving to "ZZ".
        for s in ["10.0.0.1", "192.168.1.1", "172.16.0.1"] {
            let c = country_of(s.parse().unwrap());
            assert!(
                c.is_none() || c == Some("ZZ"),
                "private {s} should be unknown/ZZ, got {c:?}"
            );
        }
    }

    #[test]
    fn binary_search_edges_do_not_panic() {
        // i == 0 path (smallest possible) and max IP path.
        let _ = country_of("0.0.0.0".parse().unwrap());
        let _ = country_of("255.255.255.255".parse().unwrap());
        let _ = country_of("::".parse().unwrap());
        let _ = country_of("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff".parse().unwrap());
    }

    #[test]
    fn known_ipv6_resolves() {
        // One IPv6 vector resolving to a real country exercises the gunzip + 128-bit search path.
        assert_eq!(
            country_of("2a04:4e42:600::223".parse().unwrap()),
            Some("NL")
        );
    }
}
