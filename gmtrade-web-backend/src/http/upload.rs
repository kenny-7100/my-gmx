//! HTTP `POST /v2/upload` `.jpg`-only image upload returning `{key, url}`.

use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;

use crate::s3::{gen_key, validate_image, KEY_LEN};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub key: String,
    pub url: String,
}

/// `POST /v2/upload` — validate the `file` field is a `.jpg`, store it to S3, and return `{key, url}`.
pub async fn upload(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, StatusCode> {
    // Missing/malformed `file` field → 400 (matches Go's `FormFile("file")` error path).
    let mut file_part = None;
    loop {
        match multipart.next_field().await {
            Ok(Some(field)) => {
                if field.name() == Some("file") {
                    let filename = field.file_name().unwrap_or_default().to_string();
                    // content-type read for parity but, like Go, not gated on / not sent to S3.
                    let content_type = field.content_type().unwrap_or_default().to_string();
                    let bytes = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                    file_part = Some((filename, content_type, bytes));
                    break;
                }
            }
            Ok(None) => break,
            Err(_) => return Err(StatusCode::BAD_REQUEST),
        }
    }

    let (filename, content_type, bytes) = file_part.ok_or(StatusCode::BAD_REQUEST)?;

    // Validate `.jpg` (by extension, like Go). Non-jpg → 400.
    let ext = validate_image(&content_type, &filename).map_err(|()| StatusCode::BAD_REQUEST)?;

    let name = gen_key(KEY_LEN);
    let s3_cfg = &state.config.s3;
    // Stored S3 object key is the single-`.jpg` `<prefix><name>.jpg` (matches Go's PutObject key).
    let object_key = format!("{}{}.{}", s3_cfg.prefix, name, ext);

    state
        .uploader
        .put_jpeg(&object_key, bytes.to_vec())
        .await
        .map_err(|e| {
            tracing::error!(error = %e, key = %object_key, "upload to s3 failed");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // URL points at the actual stored object (single `.jpg`); legacy Go doubled the extension.
    let url = format!("{}/{}", s3_cfg.public_host, object_key);
    Ok(Json(UploadResponse { key: name, url }))
}
