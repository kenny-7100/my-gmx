//! HTTP indexData endpoint (Task 5.3). Reads per-index-token rollups from the [`Snapshot`](crate::state::Snapshot).

use std::sync::Arc;

use axum::{extract::State, Json};

use crate::dto::IndexInfo;
use crate::state::AppState;

/// `GET /v2/cache/prices/indexData` — per-index-token rollups. Serves the `Arc<Vec>` directly (refcount bump, no deep clone).
pub async fn index_data(State(state): State<AppState>) -> Json<Arc<Vec<IndexInfo>>> {
    Json(state.snapshot().index_infos.clone())
}
