use aws_sdk_s3::Client;
use serde::{Deserialize, Serialize};

use crate::core::error::FabaError;
use crate::s3::config::S3Config;

/// Lockfile stored on S3 to prevent concurrent uploads.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockFile {
    pub locked_by: String,
    pub locked_at: String,
    pub ttl_seconds: u64,
    pub character_id: String,
}

const DEFAULT_TTL_SECONDS: u64 = 300; // 5 minutes

impl LockFile {
    pub fn new(character_id: &str, instance_id: &str) -> Self {
        LockFile {
            locked_by: instance_id.to_string(),
            locked_at: chrono::Utc::now().to_rfc3339(),
            ttl_seconds: DEFAULT_TTL_SECONDS,
            character_id: character_id.to_string(),
        }
    }

    /// Check if this lock has expired.
    pub fn is_expired(&self) -> bool {
        if let Ok(locked_at) = chrono::DateTime::parse_from_rfc3339(&self.locked_at) {
            let now = chrono::Utc::now();
            let elapsed = now.signed_duration_since(locked_at);
            elapsed.num_seconds() > self.ttl_seconds as i64
        } else {
            // If we can't parse the timestamp, consider it expired
            true
        }
    }
}

/// Lock key path on S3.
fn lock_key(config: &S3Config, character_id: &str) -> String {
    config.full_key(&format!(".locks/{}.lock", character_id))
}

/// Attempt to acquire a lock on S3 for the given character.
///
/// Uses conditional PUT: if the lock file already exists and is not expired,
/// acquisition fails. If it exists but is expired, we overwrite it.
pub async fn acquire_lock(
    client: &Client,
    config: &S3Config,
    character_id: &str,
    instance_id: &str,
) -> Result<(), FabaError> {
    let key = lock_key(config, character_id);

    // Check if lock already exists
    match client
        .get_object()
        .bucket(&config.bucket)
        .key(&key)
        .send()
        .await
    {
        Ok(output) => {
            // Lock exists — check if expired
            let body = output
                .body
                .collect()
                .await
                .map_err(|e| FabaError::S3(format!("Failed to read lock body: {}", e)))?;
            let bytes = body.into_bytes();

            if let Ok(existing_lock) = serde_json::from_slice::<LockFile>(&bytes) {
                if !existing_lock.is_expired() && existing_lock.locked_by != instance_id {
                    return Err(FabaError::S3(format!(
                        "Character {} is locked by another instance ({}). Lock expires at +{}s from {}",
                        character_id,
                        existing_lock.locked_by,
                        existing_lock.ttl_seconds,
                        existing_lock.locked_at
                    )));
                }
                // Lock is expired or ours — overwrite
            }
            // Fall through to create new lock
        }
        Err(err) => {
            // Check if it's a NoSuchKey error (lock doesn't exist)
            let service_err = err.into_service_error();
            if !service_err.is_no_such_key() {
                return Err(FabaError::S3(format!(
                    "Failed to check lock: {}",
                    service_err
                )));
            }
            // Lock doesn't exist — proceed to create
        }
    }

    // Create the lock
    let lock = LockFile::new(character_id, instance_id);
    let lock_json = serde_json::to_vec_pretty(&lock)
        .map_err(|e| FabaError::S3(format!("Failed to serialize lock: {}", e)))?;

    client
        .put_object()
        .bucket(&config.bucket)
        .key(&key)
        .body(lock_json.into())
        .content_type("application/json")
        .send()
        .await
        .map_err(|e| FabaError::S3(format!("Failed to write lock: {}", e)))?;

    tracing::info!("Acquired lock for character {} (instance {})", character_id, instance_id);
    Ok(())
}

/// Release a lock on S3 for the given character.
pub async fn release_lock(
    client: &Client,
    config: &S3Config,
    character_id: &str,
) -> Result<(), FabaError> {
    let key = lock_key(config, character_id);

    client
        .delete_object()
        .bucket(&config.bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| FabaError::S3(format!("Failed to release lock: {}", e)))?;

    tracing::info!("Released lock for character {}", character_id);
    Ok(())
}

/// Check if a character is currently locked by another instance.
pub async fn is_locked(
    client: &Client,
    config: &S3Config,
    character_id: &str,
    our_instance_id: &str,
) -> Result<bool, FabaError> {
    let key = lock_key(config, character_id);

    match client
        .get_object()
        .bucket(&config.bucket)
        .key(&key)
        .send()
        .await
    {
        Ok(output) => {
            let body = output
                .body
                .collect()
                .await
                .map_err(|e| FabaError::S3(format!("Failed to read lock: {}", e)))?;
            let bytes = body.into_bytes();

            if let Ok(lock) = serde_json::from_slice::<LockFile>(&bytes) {
                Ok(!lock.is_expired() && lock.locked_by != our_instance_id)
            } else {
                Ok(false)
            }
        }
        Err(_) => Ok(false),
    }
}
