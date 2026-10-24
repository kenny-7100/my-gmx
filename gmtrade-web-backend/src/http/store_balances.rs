//! HTTP Store raw balances endpoint.

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

use crate::sources::store_balances::StoreBalancesCacheState;
use crate::state::AppState;

#[derive(Serialize)]
struct StoreBalancesUnavailable {
    error: &'static str,
    reason: String,
}

/// `GET /v2/cache/store/balances` — raw Store balances cache.
pub async fn store_balances(State(state): State<AppState>) -> Response {
    match &*state.store_balances.state() {
        StoreBalancesCacheState::Ready(payload) => Json(payload.clone()).into_response(),
        StoreBalancesCacheState::Disabled { reason }
        | StoreBalancesCacheState::Initializing { reason } => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(StoreBalancesUnavailable {
                error: "store balances unavailable",
                reason: reason.clone(),
            }),
        )
            .into_response(),
    }
}
