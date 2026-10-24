//! HTTP `GET /api/s` position-share page with OG/Twitter meta and a JS redirect.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Html,
};
use serde::Deserialize;

use crate::state::AppState;

/// Query for `GET /api/s`; `id` required (missing → 4xx via axum's `Query` rejection).
#[derive(Debug, Deserialize)]
pub struct ShareQuery {
    pub id: String,
    pub p: Option<String>,
}

/// `GET /api/s` — render the share page (status 200, `text/html; charset=utf-8`). Over-long `id` → 400.
pub async fn share(
    State(state): State<AppState>,
    Query(q): Query<ShareQuery>,
) -> Result<Html<String>, StatusCode> {
    crate::http::check_param_len(&q.id, state.config.limits.max_param_len)?;
    Ok(Html(render_share_html(&q.id, q.p.as_deref())))
}

/// Build the share-page HTML for image `id` and selector `p`; `id` is HTML-escaped to prevent reflected XSS (legacy Go injected it raw).
pub fn render_share_html(id: &str, p: Option<&str>) -> String {
    let rt = crate::runtime::params();
    let image_url = format!("{}/{}.jpg", rt.share_image_host, html_escape(id));
    let redirect_url = if p == Some("g") {
        &rt.share_redirect_gmtrade
    } else {
        &rt.share_redirect_default
    };

    format!(
        r#"
				<!doctype html>
				<html lang="en">
				<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<meta name="title" content="GMXSOL | Decentralized Perpetual Exchange" />
				<meta name="description" content="Trade spot or perpetual BTC, ETH, SOL and other top cryptocurrencies with up to 200x leverage directly from your wallet on Solana." />
				<meta property="og:locale" content="en_US" />
				<meta property="og:image:type" content="image/png" />
				<meta property="og:url" content="{image_url}" />
				<meta property="og:site_name" content="GMXSOL" />
				<meta property="og:title" content="GMXSOL | Decentralized Perpetual Exchange" />
				<meta property="og:description" content="Trade spot or perpetual BTC, ETH, SOL and other top cryptocurrencies with up to 200x leverage directly from your wallet on Solana." />
				<meta property="og:image" content="{image_url}" />
				<meta property="og:image:width" content="1024" />
				<meta property="og:image:height" content="512" />
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:description" content="Trade spot or perpetual BTC, ETH, SOL and other top cryptocurrencies with up to 200x leverage directly from your wallet on Solana." />
				<meta name="twitter:title" content="GMXSOL | Decentralized Perpetual Exchange" />
				<meta name="twitter:image" content="{image_url}" />
				<meta property="og:image" content="{image_url}" />
				<meta property="og:image:type" content="image/png" />
				<meta property="og:image:width" content="140" />
				<meta property="og:image:height" content="140" />
				</head>
				<body>
				</body>
				<script>
				  setTimeout(() => {{
					  window.location.href = "{redirect_url}"
				  }}, 100);
				</script>
				</html>
			"#
    )
}

/// Escape the five HTML-significant characters so user input cannot break out of an attribute or inject markup/script.
fn html_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redirect_is_gmtrade_when_p_is_g() {
        let html = render_share_html("abc", Some("g"));
        assert!(html.contains(r#"window.location.href = "https://gmtrade.xyz/""#));
        assert!(!html.contains("https://gmxsol.io/"));
    }

    #[test]
    fn id_is_html_escaped_to_prevent_xss() {
        // A raw `"` would close the attribute and let `<script>` execute; both must be escaped.
        let html = render_share_html(r#""><script>alert(1)</script>"#, None);
        assert!(!html.contains("<script>alert(1)</script>"));
        assert!(html.contains("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"));
    }

    #[test]
    fn ordinary_id_passes_through_unchanged() {
        // Characters with no HTML significance are untouched, so normal share links are intact.
        let html = render_share_html("a/b c", None);
        assert!(html.contains("https://positionsharing.gmxsolana.io/a/b c.jpg"));
    }
}
