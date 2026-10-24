//! HTTP GLV account body endpoint.

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

use crate::sources::glv_accounts::GlvAccountsCacheState;
use crate::state::AppState;

#[derive(Serialize)]
struct GlvAccountsUnavailable {
    error: &'static str,
    reason: String,
}

/// `GET /v2/cache/glvs` — raw GLV account body cache.
pub async fn glvs(State(state): State<AppState>) -> Response {
    match &*state.glv_accounts.state() {
        GlvAccountsCacheState::Ready(cache) => Json(cache.payload.clone()).into_response(),
        GlvAccountsCacheState::Disabled { reason } => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(GlvAccountsUnavailable {
                error: "glv accounts disabled",
                reason: reason.clone(),
            }),
        )
            .into_response(),
        GlvAccountsCacheState::Initializing { reason } => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(GlvAccountsUnavailable {
                error: "glv accounts initializing",
                reason: reason.clone(),
            }),
        )
            .into_response(),
    }
}
