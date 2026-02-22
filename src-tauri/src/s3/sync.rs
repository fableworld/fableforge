use std::path::{Path, PathBuf};

use aws_sdk_s3::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::core::error::FabaError;
use crate::s3::config::S3Config;
use crate::s3::index::{
    self, build_index_character, download_index, upload_index, IndexJson, IndexMeta,
};
use crate::s3::lock;

/// Local sync metadata stored per-character.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMetadata {
    pub character_id: String,
    pub sync_enabled: bool,
    pub local_hash: Option<String>,
    pub remote_etag: Option<String>,
    pub last_synced_at: Option<String>,
    pub sync_status: SyncStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    NotSynced,
    Synced,
    PendingUpload,
    PendingDownload,
    Conflict,
    Error,
}

impl std::fmt::Display for SyncStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SyncStatus::NotSynced => write!(f, "not_synced"),
            SyncStatus::Synced => write!(f, "synced"),
            SyncStatus::PendingUpload => write!(f, "pending_upload"),
            SyncStatus::PendingDownload => write!(f, "pending_download"),
            SyncStatus::Conflict => write!(f, "conflict"),
            SyncStatus::Error => write!(f, "error"),
        }
    }
}

/// Remote metadata.json stored per character on S3.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteMetadata {
    pub character_id: String,
    pub content_hash: String,
    pub updated_at: String,
    pub updated_by: String,
    pub files: Vec<String>,
}

/// Result of a single character sync operation.
#[derive(Debug, Clone, Serialize)]
pub struct CharacterSyncResult {
    pub character_id: String,
    pub success: bool,
    pub status: String,
    pub message: Option<String>,
    pub new_etag: Option<String>,
    pub content_hash: Option<String>,
}

/// Simple character data passed to the sync engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterSyncInput {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: Option<String>,
    pub preview_image_path: Option<String>,
    pub nfc_payload: Option<String>,
    pub device_address: Option<u32>,
    pub track_paths: Vec<String>,
    pub track_titles: Vec<Option<String>>,
}

/// Compute a SHA-256 hash of file contents for change detection.
fn compute_file_hash(path: &Path) -> Result<Vec<u8>, FabaError> {
    let data = std::fs::read(path)
        .map_err(|e| FabaError::S3(format!("Failed to read file {}: {}", path.display(), e)))?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hasher.finalize().to_vec())
}

/// Compute a combined content hash for all character assets.
pub fn compute_content_hash(character: &CharacterSyncInput) -> Result<String, FabaError> {
    let mut hasher = Sha256::new();

    // Hash preview image if present
    if let Some(ref preview_path) = character.preview_image_path {
        let path = Path::new(preview_path);
        if path.exists() {
            let file_hash = compute_file_hash(path)?;
            hasher.update(&file_hash);
        }
    }

    // Hash all tracks
    for track_path in &character.track_paths {
        let path = Path::new(track_path);
        if path.exists() {
            let file_hash = compute_file_hash(path)?;
            hasher.update(&file_hash);
        }
    }

    // Include metadata in hash (name changes should trigger sync)
    hasher.update(character.name.as_bytes());
    if let Some(ref desc) = character.description {
        hasher.update(desc.as_bytes());
    }

    let hash = hasher.finalize();
    Ok(format!("{:x}", hash))
}

/// Upload a single character and all its assets to S3.
pub async fn upload_character(
    client: &Client,
    config: &S3Config,
    character: &CharacterSyncInput,
    instance_id: &str,
) -> Result<CharacterSyncResult, FabaError> {
    let char_id = &character.id;

    // 1. Acquire lock
    lock::acquire_lock(client, config, char_id, instance_id).await?;

    // Use a closure-like approach for cleanup on error
    let result = upload_character_inner(client, config, character, instance_id).await;

    // 3. Always release lock
    if let Err(e) = lock::release_lock(client, config, char_id).await {
        tracing::warn!("Failed to release lock for {}: {}", char_id, e);
    }

    result
}

async fn upload_character_inner(
    client: &Client,
    config: &S3Config,
    character: &CharacterSyncInput,
    instance_id: &str,
) -> Result<CharacterSyncResult, FabaError> {
    let char_id = &character.id;
    let mut uploaded_files: Vec<String> = Vec::new();

    // 2a. Upload preview image
    if let Some(ref preview_path) = character.preview_image_path {
        let path = Path::new(preview_path);
        if path.exists() {
            let data = std::fs::read(path)
                .map_err(|e| FabaError::S3(format!("Failed to read preview: {}", e)))?;
            let key = config.full_key(&format!("{}/preview.jpg", char_id));

            client
                .put_object()
                .bucket(&config.bucket)
                .key(&key)
                .body(data.into())
                .content_type("image/jpeg")
                .send()
                .await
                .map_err(|e| FabaError::S3(format!("Failed to upload preview: {}", e)))?;

            uploaded_files.push("preview.jpg".into());
            tracing::info!("Uploaded preview for {}", char_id);
        }
    }

    // 2b. Upload tracks
    for (i, track_path) in character.track_paths.iter().enumerate() {
        let path = Path::new(track_path);
        if path.exists() {
            let data = std::fs::read(path)
                .map_err(|e| FabaError::S3(format!("Failed to read track {}: {}", i, e)))?;
            let key = config.full_key(&format!("{}/tracks/track_{}.mp3", char_id, i));

            client
                .put_object()
                .bucket(&config.bucket)
                .key(&key)
                .body(data.into())
                .content_type("audio/mpeg")
                .send()
                .await
                .map_err(|e| FabaError::S3(format!("Failed to upload track {}: {}", i, e)))?;

            uploaded_files.push(format!("tracks/track_{}.mp3", i));
            tracing::info!("Uploaded track {} for {}", i, char_id);
        }
    }

    // 2c. Compute content hash
    let content_hash = compute_content_hash(character)?;

    // 2d. Upload metadata.json
    let now = chrono::Utc::now().to_rfc3339();
    let metadata = RemoteMetadata {
        character_id: char_id.clone(),
        content_hash: content_hash.clone(),
        updated_at: now.clone(),
        updated_by: instance_id.to_string(),
        files: uploaded_files,
    };

    let metadata_json = serde_json::to_vec_pretty(&metadata)
        .map_err(|e| FabaError::S3(format!("Failed to serialize metadata: {}", e)))?;
    let metadata_key = config.full_key(&format!("{}/metadata.json", char_id));

    let put_result = client
        .put_object()
        .bucket(&config.bucket)
        .key(&metadata_key)
        .body(metadata_json.into())
        .content_type("application/json")
        .send()
        .await
        .map_err(|e| FabaError::S3(format!("Failed to upload metadata: {}", e)))?;

    let new_etag = put_result.e_tag().map(String::from);

    tracing::info!("Upload complete for character {} (hash: {})", char_id, content_hash);

    Ok(CharacterSyncResult {
        character_id: char_id.clone(),
        success: true,
        status: "synced".into(),
        message: Some("Upload complete".into()),
        new_etag,
        content_hash: Some(content_hash),
    })
}

/// Download a single character and all its assets from S3.
pub async fn download_character(
    client: &Client,
    config: &S3Config,
    character_id: &str,
    app_data_dir: &Path,
    collection_id: &str,
) -> Result<CharacterSyncResult, FabaError> {
    // 1. Download metadata.json
    let metadata_key = config.full_key(&format!("{}/metadata.json", character_id));

    let metadata_output = client
        .get_object()
        .bucket(&config.bucket)
        .key(&metadata_key)
        .send()
        .await
        .map_err(|e| FabaError::S3(format!("Failed to download metadata for {}: {}", character_id, e)))?;

    let etag = metadata_output.e_tag().map(String::from);

    let body = metadata_output
        .body
        .collect()
        .await
        .map_err(|e| FabaError::S3(format!("Failed to read metadata: {}", e)))?;
    let metadata: RemoteMetadata = serde_json::from_slice(&body.into_bytes())
        .map_err(|e| FabaError::S3(format!("Failed to parse metadata: {}", e)))?;

    // 2. Create local directories
    let char_dir = app_data_dir
        .join("collections")
        .join(collection_id);
    let tracks_dir = char_dir.join("tracks");
    let previews_dir = char_dir.join("previews");
    std::fs::create_dir_all(&tracks_dir)
        .map_err(|e| FabaError::S3(format!("Failed to create tracks dir: {}", e)))?;
    std::fs::create_dir_all(&previews_dir)
        .map_err(|e| FabaError::S3(format!("Failed to create previews dir: {}", e)))?;

    // 3. Download each file listed in metadata
    let mut downloaded_files: Vec<(String, PathBuf)> = Vec::new();

    for file_name in &metadata.files {
        let s3_key = config.full_key(&format!("{}/{}", character_id, file_name));

        let file_output = client
            .get_object()
            .bucket(&config.bucket)
            .key(&s3_key)
            .send()
            .await
            .map_err(|e| {
                FabaError::S3(format!("Failed to download {}: {}", file_name, e))
            })?;

        let file_body = file_output
            .body
            .collect()
            .await
            .map_err(|e| FabaError::S3(format!("Failed to read {}: {}", file_name, e)))?;

        // Determine local save path
        let local_path = if file_name == "preview.jpg" {
            previews_dir.join(format!("{}.jpg", character_id))
        } else if file_name.starts_with("tracks/") {
            // tracks/track_0.mp3 → tracks dir
            let track_filename = file_name.strip_prefix("tracks/").unwrap_or(file_name);
            tracks_dir.join(format!("{}_{}", character_id, track_filename))
        } else {
            char_dir.join(file_name)
        };

        std::fs::write(&local_path, file_body.into_bytes())
            .map_err(|e| {
                FabaError::S3(format!("Failed to write {}: {}", local_path.display(), e))
            })?;

        downloaded_files.push((file_name.clone(), local_path));
        tracing::info!("Downloaded {} for {}", file_name, character_id);
    }

    tracing::info!(
        "Download complete for character {} ({} files, hash: {})",
        character_id,
        downloaded_files.len(),
        metadata.content_hash
    );

    Ok(CharacterSyncResult {
        character_id: character_id.to_string(),
        success: true,
        status: "synced".into(),
        message: Some(format!("Downloaded {} files", downloaded_files.len())),
        new_etag: etag,
        content_hash: Some(metadata.content_hash),
    })
}

/// Check the remote status of a character's metadata.json (HEAD request).
/// Returns the ETag and content hash without downloading the full files.
pub async fn get_remote_status(
    client: &Client,
    config: &S3Config,
    character_id: &str,
) -> Result<Option<(String, String)>, FabaError> {
    let metadata_key = config.full_key(&format!("{}/metadata.json", character_id));

    // Try a GET to also read the content hash from metadata
    match client
        .get_object()
        .bucket(&config.bucket)
        .key(&metadata_key)
        .send()
        .await
    {
        Ok(output) => {
            let etag = output.e_tag().unwrap_or_default().to_string();
            let body = output
                .body
                .collect()
                .await
                .map_err(|e| FabaError::S3(format!("Failed to read remote metadata: {}", e)))?;

            let metadata: RemoteMetadata = serde_json::from_slice(&body.into_bytes())
                .map_err(|e| FabaError::S3(format!("Failed to parse remote metadata: {}", e)))?;

            Ok(Some((etag, metadata.content_hash)))
        }
        Err(err) => {
            let service_err = err.into_service_error();
            if service_err.is_no_such_key() {
                Ok(None)
            } else {
                Err(FabaError::S3(format!(
                    "Failed to check remote status: {}",
                    service_err
                )))
            }
        }
    }
}

/// Determine the sync action needed for a character.
pub fn determine_sync_action(
    local_meta: &Option<SyncMetadata>,
    local_hash: &str,
    remote_status: &Option<(String, String)>, // (etag, content_hash)
) -> SyncStatus {
    match (local_meta, remote_status) {
        // No local metadata, no remote → not synced
        (None, None) => SyncStatus::NotSynced,

        // No local metadata, remote exists → need to download
        (None, Some(_)) => SyncStatus::PendingDownload,

        // Local metadata, no remote → need to upload
        (Some(meta), None) => {
            if meta.sync_enabled {
                SyncStatus::PendingUpload
            } else {
                SyncStatus::NotSynced
            }
        }

        // Both exist — compare
        (Some(meta), Some((remote_etag, remote_hash))) => {
            if !meta.sync_enabled {
                return SyncStatus::NotSynced;
            }

            // Check if our known etag matches remote
            let etag_matches = meta
                .remote_etag
                .as_ref()
                .map(|local_etag| local_etag == remote_etag)
                .unwrap_or(false);

            let content_matches = local_hash == remote_hash;

            if content_matches {
                // Content same on both sides
                SyncStatus::Synced
            } else if etag_matches {
                // Remote hasn't changed since our last sync, but local is different → upload
                SyncStatus::PendingUpload
            } else if meta.local_hash.as_deref() == Some(local_hash) {
                // Local hasn't changed since our last sync, but remote is different → download
                SyncStatus::PendingDownload
            } else {
                // Both sides changed → conflict
                SyncStatus::Conflict
            }
        }
    }
}

/// Update the S3 index.json after a character upload.
pub async fn update_index_after_upload(
    client: &Client,
    config: &S3Config,
    collection_name: &str,
    collection_description: Option<&str>,
    character: &CharacterSyncInput,
) -> Result<(), FabaError> {
    // Download existing index or create fresh
    let mut index = download_index(client, config)
        .await?
        .unwrap_or_else(|| IndexJson {
            meta: IndexMeta {
                name: collection_name.to_string(),
                version: Some("1.0".into()),
                maintainer: None,
                description: collection_description.map(String::from),
            },
            characters: Vec::new(),
        });

    // Build the new character entry
    let has_preview = character
        .preview_image_path
        .as_ref()
        .map(|p| Path::new(p).exists())
        .unwrap_or(false);

    let new_entry = build_index_character(
        config,
        &character.id,
        &character.name,
        character.description.as_deref(),
        character.created_at.as_deref(),
        character.nfc_payload.as_deref(),
        character.device_address,
        has_preview,
        character.track_paths.len(),
        &character.track_titles,
    );

    // Upsert: replace existing entry or add new
    if let Some(idx) = index.characters.iter().position(|c| c.id == character.id) {
        index.characters[idx] = new_entry;
    } else {
        index.characters.push(new_entry);
    }

    // Upload updated index
    upload_index(client, config, &index).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_status_display() {
        assert_eq!(SyncStatus::Synced.to_string(), "synced");
        assert_eq!(SyncStatus::PendingUpload.to_string(), "pending_upload");
        assert_eq!(SyncStatus::Conflict.to_string(), "conflict");
    }

    #[test]
    fn determine_action_no_metadata_no_remote() {
        let result = determine_sync_action(&None, "hash", &None);
        assert_eq!(result, SyncStatus::NotSynced);
    }

    #[test]
    fn determine_action_no_metadata_has_remote() {
        let remote = Some(("\"etag\"".into(), "remotehash".into()));
        let result = determine_sync_action(&None, "hash", &remote);
        assert_eq!(result, SyncStatus::PendingDownload);
    }

    #[test]
    fn determine_action_enabled_no_remote() {
        let meta = Some(SyncMetadata {
            character_id: "c1".into(),
            sync_enabled: true,
            local_hash: None,
            remote_etag: None,
            last_synced_at: None,
            sync_status: SyncStatus::NotSynced,
        });
        let result = determine_sync_action(&meta, "hash", &None);
        assert_eq!(result, SyncStatus::PendingUpload);
    }

    #[test]
    fn determine_action_content_matches() {
        let meta = Some(SyncMetadata {
            character_id: "c1".into(),
            sync_enabled: true,
            local_hash: Some("samehash".into()),
            remote_etag: Some("\"etag\"".into()),
            last_synced_at: None,
            sync_status: SyncStatus::Synced,
        });
        let remote = Some(("\"etag\"".into(), "samehash".into()));
        let result = determine_sync_action(&meta, "samehash", &remote);
        assert_eq!(result, SyncStatus::Synced);
    }

    #[test]
    fn determine_action_local_changed_remote_same() {
        let meta = Some(SyncMetadata {
            character_id: "c1".into(),
            sync_enabled: true,
            local_hash: Some("oldhash".into()),
            remote_etag: Some("\"etag1\"".into()),
            last_synced_at: None,
            sync_status: SyncStatus::Synced,
        });
        let remote = Some(("\"etag1\"".into(), "oldhash".into()));
        let result = determine_sync_action(&meta, "newhash", &remote);
        assert_eq!(result, SyncStatus::PendingUpload);
    }

    #[test]
    fn determine_action_remote_changed_local_same() {
        let meta = Some(SyncMetadata {
            character_id: "c1".into(),
            sync_enabled: true,
            local_hash: Some("myhash".into()),
            remote_etag: Some("\"old-etag\"".into()),
            last_synced_at: None,
            sync_status: SyncStatus::Synced,
        });
        let remote = Some(("\"new-etag\"".into(), "remotehash".into()));
        let result = determine_sync_action(&meta, "myhash", &remote);
        assert_eq!(result, SyncStatus::PendingDownload);
    }

    #[test]
    fn determine_action_both_changed_conflict() {
        let meta = Some(SyncMetadata {
            character_id: "c1".into(),
            sync_enabled: true,
            local_hash: Some("oldhash".into()),
            remote_etag: Some("\"old-etag\"".into()),
            last_synced_at: None,
            sync_status: SyncStatus::Synced,
        });
        let remote = Some(("\"new-etag\"".into(), "remotehash".into()));
        let result = determine_sync_action(&meta, "newhash", &remote);
        assert_eq!(result, SyncStatus::Conflict);
    }

    #[test]
    fn determine_action_disabled() {
        let meta = Some(SyncMetadata {
            character_id: "c1".into(),
            sync_enabled: false,
            local_hash: None,
            remote_etag: None,
            last_synced_at: None,
            sync_status: SyncStatus::NotSynced,
        });
        let remote = Some(("\"etag\"".into(), "hash".into()));
        let result = determine_sync_action(&meta, "hash", &remote);
        assert_eq!(result, SyncStatus::NotSynced);
    }
}
