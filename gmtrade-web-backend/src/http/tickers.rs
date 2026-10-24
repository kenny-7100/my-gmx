//! HTTP ticker endpoints (Task 5.2). v1 reads `Snapshot::tickers`, v2 reads `tickers_v2`.

use std::sync::Arc;

use axum::{extract::State, Json};

use crate::dto::Ticker;
use crate::state::AppState;

/// `GET /cache/prices/tickers` — HTTP v1 tickers. Serves the `Arc<Vec>` directly (refcount bump, no deep clone).
pub async fn tickers_v1(State(state): State<AppState>) -> Json<Arc<Vec<Ticker>>> {
    Json(state.snapshot().tickers.clone())
}

pub async fn tickers_v2(State(state): State<AppState>) -> Json<Arc<Vec<Ticker>>> {
    Json(state.snapshot().tickers_v2.clone())
}
