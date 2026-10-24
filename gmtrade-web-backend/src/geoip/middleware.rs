//! Axum middleware setting the `x-user-country` response header when the client-IP lookup yields a non-empty, non-`"ZZ"` country.

use std::net::{IpAddr, SocketAddr};

use axum::{
    extract::ConnectInfo,
    http::{HeaderMap, HeaderValue, Request},
    middleware::Next,
    response::Response,
};

/// Header that downstream/frontend reads for geo-gating.
const COUNTRY_HEADER: &str = "x-user-country";

type GeoIpFuture = std::pin::Pin<Box<dyn std::future::Future<Output = Response> + Send + 'static>>;

/// Plain `fn` pointer shape of the middleware (nameable and `Clone`).
type GeoIpFn = fn(Request<axum::body::Body>, Next) -> GeoIpFuture;

/// Concrete layer type produced by [`geoip_layer`].
pub type GeoIpLayer = axum::middleware::FromFnLayer<GeoIpFn, (), (Request<axum::body::Body>,)>;

/// Build the GeoIP middleware layer for global mounting (peer-addr fallback needs `into_make_service_with_connect_info`).
pub fn geoip_layer() -> GeoIpLayer {
    // Coerce to a plain `fn` pointer so the layer type is nameable and `Clone`.
    let f: GeoIpFn = geoip_middleware;
    axum::middleware::from_fn(f)
}

fn geoip_middleware(req: Request<axum::body::Body>, next: Next) -> GeoIpFuture {
    Box::pin(async move {
        // Extract the client IP BEFORE consuming the request into the handler.
        let ip = client_ip(
            req.headers(),
            req.extensions().get::<ConnectInfo<SocketAddr>>(),
        );
        let mut resp = next.run(req).await;
        if let Some(ip) = ip {
            if let Some(country) = super::country_of(ip) {
                // Go contract: set only when non-empty AND != "ZZ".
                if !country.is_empty() && country != "ZZ" {
                    if let Ok(value) = HeaderValue::from_str(country) {
                        resp.headers_mut().insert(COUNTRY_HEADER, value);
                    }
                }
            }
        }
        resp
    })
}

/// Extract the client IP by precedence: `X-Forwarded-For` (first segment) → `X-Real-Ip` → peer `SocketAddr`.
fn client_ip(
    headers: &HeaderMap,
    connect_info: Option<&ConnectInfo<SocketAddr>>,
) -> Option<IpAddr> {
    // X-Forwarded-For: take the first comma-separated segment, trimmed, parsed.
    if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first) = xff.split(',').next() {
            if let Ok(ip) = first.trim().parse::<IpAddr>() {
                return Some(ip);
            }
        }
    }
    // X-Real-Ip: parsed directly.
    if let Some(real) = headers.get("x-real-ip").and_then(|v| v.to_str().ok()) {
        if let Ok(ip) = real.trim().parse::<IpAddr>() {
            return Some(ip);
        }
    }
    // Peer address (RemoteAddr host), via ConnectInfo.
    connect_info.map(|ci| ci.0.ip())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        routing::get,
        Router,
    };
    use tower::ServiceExt;

    fn app() -> Router {
        Router::new()
            .route("/", get(|| async { "ok" }))
            .layer(super::super::geoip_layer())
    }

    async fn header_for(req: Request<Body>) -> Option<String> {
        let resp = app().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        resp.headers()
            .get(COUNTRY_HEADER)
            .map(|v| v.to_str().unwrap().to_string())
    }

    #[tokio::test]
    async fn xff_known_ip_sets_country_header() {
        let req = Request::builder()
            .uri("/")
            .header("x-forwarded-for", "192.210.171.249")
            .body(Body::empty())
            .unwrap();
        assert_eq!(header_for(req).await.as_deref(), Some("US"));
    }

    #[tokio::test]
    async fn xff_takes_first_segment() {
        // First segment is a known US IP; the trailing proxy hop is ignored.
        let req = Request::builder()
            .uri("/")
            .header("x-forwarded-for", "192.210.171.249, 10.0.0.1")
            .body(Body::empty())
            .unwrap();
        assert_eq!(header_for(req).await.as_deref(), Some("US"));
    }

    #[tokio::test]
    async fn x_real_ip_fallback_used_when_no_xff() {
        let req = Request::builder()
            .uri("/")
            .header("x-real-ip", "121.229.143.64")
            .body(Body::empty())
            .unwrap();
        assert_eq!(header_for(req).await.as_deref(), Some("CN"));
    }

    #[tokio::test]
    async fn private_ip_sets_no_header() {
        for ip in ["10.0.0.1", "192.168.1.1"] {
            let req = Request::builder()
                .uri("/")
                .header("x-forwarded-for", ip)
                .body(Body::empty())
                .unwrap();
            assert_eq!(header_for(req).await, None, "{ip} must not set header");
        }
    }

    #[tokio::test]
    async fn no_ip_headers_and_no_connect_info_no_header_no_panic() {
        let req = Request::builder().uri("/").body(Body::empty()).unwrap();
        assert_eq!(header_for(req).await, None);
    }

    #[tokio::test]
    async fn connect_info_peer_addr_fallback() {
        // With ConnectInfo inserted and no XFF/X-Real-Ip, the peer addr is used.
        let mut req = Request::builder().uri("/").body(Body::empty()).unwrap();
        req.extensions_mut()
            .insert(ConnectInfo(SocketAddr::from(([192, 210, 171, 249], 12345))));
        assert_eq!(header_for(req).await.as_deref(), Some("US"));
    }

    #[tokio::test]
    async fn xff_precedence_over_x_real_ip() {
        // XFF wins even when X-Real-Ip is also present.
        let req = Request::builder()
            .uri("/")
            .header("x-forwarded-for", "192.210.171.249")
            .header("x-real-ip", "121.229.143.64")
            .body(Body::empty())
            .unwrap();
        assert_eq!(header_for(req).await.as_deref(), Some("US"));
    }
}
