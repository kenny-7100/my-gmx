//! HTTP `/log/p` client-error log sink that logs `s` (truncated) and returns JSON `""`.

use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;

use crate::state::AppState;

/// Query for `/log/p`; `s` is the optional client-supplied error string.
#[derive(Debug, Default, Deserialize)]
pub struct LogQuery {
    #[serde(default)]
    pub s: String,
}

/// Truncate `s` to at most `max` bytes on a UTF-8 char boundary (no panic, no realloc).
/// Returns the slice plus `Some(original_len)` when it was actually truncated (`None` when it
/// fit untouched), so the caller can flag truncation in the log line.
fn truncate_on_boundary(s: &str, max: usize) -> (&str, Option<usize>) {
    if s.len() <= max {
        return (s, None);
    }
    let original_len = s.len();
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    (&s[..end], Some(original_len))
}

/// `GET /log/p` — log the client error string (truncated to `limits.max_log_str_len`) and return JSON `""`.
/// Truncation bounds the log line so an abusive megabyte-long `s` cannot flood the logs; when it
/// happens the line carries an `original_len` field and a trailing `…` so it's visibly truncated.
pub async fn log_p(State(state): State<AppState>, Query(q): Query<LogQuery>) -> Json<&'static str> {
    match truncate_on_boundary(&q.s, state.config.limits.max_log_str_len) {
        (s, None) => tracing::warn!(client_error = %s, "client /log/p"),
        (s, Some(original_len)) => {
            tracing::warn!(client_error = %format!("{s}…"), original_len, "client /log/p (truncated)")
        }
    }
    Json("")
}

#[cfg(test)]
mod tests {
    use super::truncate_on_boundary;

    #[test]
    fn truncate_caps_length_and_respects_char_boundary() {
        // Fits untouched -> no truncation marker.
        assert_eq!(truncate_on_boundary("short", 1024), ("short", None));
        // Truncated -> slice plus the original byte length for the log field.
        assert_eq!(truncate_on_boundary("abcdef", 3), ("abc", Some(6)));
        // A multi-byte char straddling the cut must not panic and must drop the partial char.
        let s = "aé"; // 'é' is 2 bytes (indices 1..3), so cutting at 2 lands mid-char.
        assert_eq!(truncate_on_boundary(s, 2), ("a", Some(3)));
    }
}
