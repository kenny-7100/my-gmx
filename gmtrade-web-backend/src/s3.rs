//! S3 `.jpg`-only image upload with a 20-char base-36 name.

use eyre::Result;
use rand::Rng;

/// Lowercase base-36 alphabet for generated object names (Go's `const letters`).
const LETTERS: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";

/// Length of the generated object name (matches Go's `randomBase36(20)`).
pub const KEY_LEN: usize = 20;

const JPG_EXT: &str = "jpg";

/// Abstracts S3 `PutObject` so the upload handler is testable with a mock.
#[async_trait::async_trait]
pub trait S3Uploader: Send + Sync {
    /// Store `bytes` at `key` as `image/jpeg`.
    async fn put_jpeg(&self, key: &str, bytes: Vec<u8>) -> Result<()>;
}

/// Generate a random object name of `len` lowercase-base-36 chars (`[a-z0-9]`).
pub fn gen_key(len: usize) -> String {
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| {
            let idx = rng.gen_range(0..LETTERS.len());
            LETTERS[idx] as char
        })
        .collect()
}

/// Validate an upload by case-sensitive filename extension, returning `"jpg"` or `Err(())`.
pub(crate) fn validate_image(
    _content_type: &str,
    filename: &str,
) -> std::result::Result<&'static str, ()> {
    match extension(filename) {
        Some(ext) if ext == JPG_EXT => Ok(JPG_EXT),
        _ => Err(()),
    }
}

/// Last `.`-delimited extension of `filename` (without the dot), or `None`.
fn extension(filename: &str) -> Option<&str> {
    filename.rsplit_once('.').map(|(_, ext)| ext)
}

/// Real `aws-sdk-s3` implementation. Built in `main.rs` from `Config::s3`.
pub struct AwsS3Uploader {
    client: aws_sdk_s3::Client,
    bucket: String,
}

impl AwsS3Uploader {
    /// `use_arn_region(true)` (Go's `UseARNRegion`) is required for ARN/alias buckets.
    pub async fn new(region: String, bucket: String) -> Self {
        let region = aws_sdk_s3::config::Region::new(region);
        let shared = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(region)
            .load()
            .await;
        let s3_conf = aws_sdk_s3::config::Builder::from(&shared)
            .use_arn_region(true)
            .build();
        let client = aws_sdk_s3::Client::from_conf(s3_conf);
        Self { client, bucket }
    }
}

#[async_trait::async_trait]
impl S3Uploader for AwsS3Uploader {
    async fn put_jpeg(&self, key: &str, bytes: Vec<u8>) -> Result<()> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .content_type("image/jpeg")
            .body(bytes.into())
            .send()
            .await?;
        Ok(())
    }
}

/// No-op uploader (always `Ok`); exposed so integration tests can build an `AppState`.
pub struct AwsS3UploaderUnused;

#[async_trait::async_trait]
impl S3Uploader for AwsS3UploaderUnused {
    async fn put_jpeg(&self, _key: &str, _bytes: Vec<u8>) -> Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gen_key_has_requested_length_and_charset() {
        for _ in 0..256 {
            let k = gen_key(KEY_LEN);
            assert_eq!(k.len(), KEY_LEN, "length must equal KEY_LEN");
            assert!(
                k.bytes().all(|b| LETTERS.contains(&b)),
                "all chars must be lowercase base-36: {k}"
            );
        }
    }

    #[test]
    fn validate_image_jpg_only_case_sensitive() {
        // Content-type is not gated on (Go only checks the extension).
        assert_eq!(
            validate_image("application/octet-stream", "x.jpg"),
            Ok("jpg")
        );
        assert!(validate_image("image/png", "photo.png").is_err());
        assert!(validate_image("image/jpeg", "noext").is_err());
        // `.jpeg` is not `.jpg`, and the check is case-sensitive.
        assert!(validate_image("image/jpeg", "photo.jpeg").is_err());
        assert!(validate_image("image/jpeg", "photo.JPG").is_err());
    }
}
