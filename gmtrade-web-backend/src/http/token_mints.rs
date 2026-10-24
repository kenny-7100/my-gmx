//! HTTP GM/GLV token mint metadata endpoint.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::state::AppState;
use crate::token_mints::{
    parse_pubkeys_filter, TokenMintsCacheState, TokenMintsInputError, TokenMintsPubkeysInput,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenMintsQuery {
    pub pubkeys: Option<String>,
    #[serde(default)]
    pub with_data: bool,
}

#[derive(Serialize)]
struct TokenMintsUnavailable {
    error: &'static str,
    reason: String,
}

#[derive(Serialize)]
struct TokenMintsBadRequest {
    error: &'static str,
    reason: String,
}

/// `GET /v2/cache/store/tokenMints` — GM/GLV token mint metadata cache.
pub async fn token_mints(
    State(state): State<AppState>,
    Query(query): Query<TokenMintsQuery>,
) -> Response {
    let filter = match parse_pubkeys_filter(
        TokenMintsPubkeysInput::HttpParam(query.pubkeys.as_deref()),
        &state.config.token_mints,
    ) {
        Ok(filter) => filter,
        Err(err) => return bad_request(err).into_response(),
    };

    match &*state.token_mints.state() {
        TokenMintsCacheState::Ready(cache) => {
            Json(cache.to_payload(filter.as_ref(), query.with_data)).into_response()
        }
        TokenMintsCacheState::Disabled { reason }
        | TokenMintsCacheState::Initializing { reason } => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(TokenMintsUnavailable {
                error: "token mints unavailable",
                reason: reason.clone(),
            }),
        )
            .into_response(),
    }
}

fn bad_request(err: TokenMintsInputError) -> (StatusCode, Json<TokenMintsBadRequest>) {
    (
        StatusCode::BAD_REQUEST,
        Json(TokenMintsBadRequest {
            error: "invalid token mints request",
            reason: err.reason(),
        }),
    )
}
