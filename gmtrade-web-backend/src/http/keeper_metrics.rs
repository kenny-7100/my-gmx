//! HTTP endpoint for the Keeper metrics cache.

use std::time::Duration;

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use tokio::time::Instant;

use crate::{sources::keeper_execution_time::KeeperExecutionTimeHandle, state::AppState};

#[derive(Debug, Serialize)]
struct KeeperMetricsUnavailable {
    error: &'static str,
    reason: &'static str,
}

fn response_at(handle: &KeeperExecutionTimeHandle, now: Instant, max_age: Duration) -> Response {
    match handle.read_at(now, max_age) {
        Ok(response) => Json(response).into_response(),
        Err(reason) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(KeeperMetricsUnavailable {
                error: "keeper metrics unavailable",
                reason: reason.as_str(),
            }),
        )
            .into_response(),
    }
}

/// `GET /v2/cache/keeper/metrics` — current Keeper execution-time metrics.
pub async fn metrics(State(state): State<AppState>) -> Response {
    response_at(
        &state.keeper_execution_time,
        Instant::now(),
        Duration::from_secs(state.config.keeper_execution_time.stale_secs.max(1)),
    )
}

#[cfg(test)]
mod tests {
    use axum::body::to_bytes;

    use crate::sources::keeper_execution_time::{
        KeeperExecutionTimeHandle, KeeperExecutionTimeUnavailableReason,
    };

    use super::*;

    #[tokio::test]
    async fn response_returns_weighted_payload() {
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 8_000, now);
        handle.update_snapshot(1, 10, 3, 9_500, now);
        let response = response_at(&handle, now, Duration::from_secs(30));
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({ "estimatedExecutionTimeSeconds": 9.125 })
        );
    }

    #[tokio::test]
    async fn response_returns_fixed_unavailable_contract() {
        let handle = KeeperExecutionTimeHandle::disabled(
            KeeperExecutionTimeUnavailableReason::RuntimeDisabled,
        );
        let response = response_at(&handle, Instant::now(), Duration::from_secs(30));
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({
                "error": "keeper metrics unavailable",
                "reason": "runtime disabled"
            })
        );
    }

    #[tokio::test]
    async fn response_returns_503_for_stale_or_misaligned_sources() {
        let handle = KeeperExecutionTimeHandle::for_source_count(2);
        let now = Instant::now();
        handle.update_snapshot(0, 10, 1, 1_000, now);
        handle.update_snapshot(1, 10, 1, 1_000, now + Duration::from_secs(10));
        let response = response_at(
            &handle,
            now + Duration::from_secs(10),
            Duration::from_secs(30),
        );
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({
                "error": "keeper metrics unavailable",
                "reason": "snapshot misaligned"
            })
        );
    }
}
