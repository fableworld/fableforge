use aws_config::Region;
use aws_credential_types::Credentials;
use aws_sdk_s3::config::Builder as S3ConfigBuilder;
use aws_sdk_s3::Client;

use crate::core::error::FabaError;
use crate::s3::config::S3Config;

/// Build an S3 client from the given configuration and credentials.
///
/// Uses path-style addressing (`force_path_style(true)`) for compatibility
/// with S3-compatible providers like Backblaze B2 and Cloudflare R2.
pub fn build_client(
    config: &S3Config,
    access_key: &str,
    secret_key: &str,
) -> Result<Client, FabaError> {
    let credentials = Credentials::new(access_key, secret_key, None, None, "fableforge");

    let s3_config = S3ConfigBuilder::new()
        .endpoint_url(&config.endpoint)
        .region(Region::new(config.region.clone()))
        .credentials_provider(credentials)
        .force_path_style(true)
        .build();

    Ok(Client::from_conf(s3_config))
}

/// Result of testing an S3 connection.
#[derive(Debug, serde::Serialize)]
pub struct S3ConnectionInfo {
    pub success: bool,
    pub message: String,
    pub object_count: Option<i64>,
}

/// Test the S3 connection by listing objects under the configured prefix.
pub async fn test_connection(
    client: &Client,
    config: &S3Config,
) -> S3ConnectionInfo {
    // First, try to list objects to verify the bucket and prefix are accessible
    let prefix = config.prefix.as_deref().unwrap_or("");
    let prefix_with_slash = if prefix.is_empty() {
        String::new()
    } else {
        format!("{}/", prefix.trim_end_matches('/'))
    };

    let result = client
        .list_objects_v2()
        .bucket(&config.bucket)
        .prefix(&prefix_with_slash)
        .max_keys(1)
        .send()
        .await;

    match result {
        Ok(output) => {
            let count = output.key_count().unwrap_or(0) as i64;
            S3ConnectionInfo {
                success: true,
                message: format!(
                    "Connected successfully to {}/{}",
                    config.bucket,
                    prefix_with_slash
                ),
                object_count: Some(count),
            }
        }
        Err(err) => {
            let msg = format!("Connection failed: {}", err);
            tracing::error!("S3 connection test failed: {}", msg);
            S3ConnectionInfo {
                success: false,
                message: msg,
                object_count: None,
            }
        }
    }
}
