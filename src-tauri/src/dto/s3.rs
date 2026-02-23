use serde::{Deserialize, Serialize};

/// DTO for S3 configuration sent between Rust ↔ Frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3ConfigDto {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub region: String,
    pub bucket: String,
    pub prefix: Option<String>,
    pub is_public: bool,
    pub collection_id: String,
}

/// DTO for S3 connection test result.
#[derive(Debug, Serialize)]
pub struct S3ConnectionResultDto {
    pub success: bool,
    pub message: String,
    pub object_count: Option<i64>,
}

impl From<crate::s3::config::S3Config> for S3ConfigDto {
    fn from(c: crate::s3::config::S3Config) -> Self {
        S3ConfigDto {
            id: c.id,
            name: c.name,
            endpoint: c.endpoint,
            region: c.region,
            bucket: c.bucket,
            prefix: c.prefix,
            is_public: c.is_public,
            collection_id: c.collection_id,
        }
    }
}

impl From<S3ConfigDto> for crate::s3::config::S3Config {
    fn from(d: S3ConfigDto) -> Self {
        crate::s3::config::S3Config {
            id: d.id,
            name: d.name,
            endpoint: d.endpoint,
            region: d.region,
            bucket: d.bucket,
            prefix: d.prefix,
            is_public: d.is_public,
            collection_id: d.collection_id,
        }
    }
}

impl From<crate::s3::client::S3ConnectionInfo> for S3ConnectionResultDto {
    fn from(info: crate::s3::client::S3ConnectionInfo) -> Self {
        S3ConnectionResultDto {
            success: info.success,
            message: info.message,
            object_count: info.object_count,
        }
    }
}

// --- Sync DTOs ---

/// DTO for sync metadata per character.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMetadataDto {
    pub character_id: String,
    pub sync_status: String,
    pub local_hash: Option<String>,
    pub remote_etag: Option<String>,
    pub last_synced_at: Option<String>,
    pub sync_enabled: bool,
}

/// DTO for a single character sync result.
#[derive(Debug, Clone, Serialize)]
pub struct SyncResultDto {
    pub character_id: String,
    pub success: bool,
    pub status: String,
    pub message: Option<String>,
}

/// DTO for sync progress events emitted during upload/download.
#[derive(Debug, Clone, Serialize)]
pub struct SyncProgressEvent {
    pub character_id: String,
    pub phase: String,
    pub progress: f64,
    pub file_name: Option<String>,
}

/// DTO for character data needed by the sync engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterSyncInputDto {
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

impl From<crate::s3::sync::SyncMetadata> for SyncMetadataDto {
    fn from(m: crate::s3::sync::SyncMetadata) -> Self {
        SyncMetadataDto {
            character_id: m.character_id,
            sync_status: m.sync_status.to_string(),
            local_hash: m.local_hash,
            remote_etag: m.remote_etag,
            last_synced_at: m.last_synced_at,
            sync_enabled: m.sync_enabled,
        }
    }
}

impl From<crate::s3::sync::CharacterSyncResult> for SyncResultDto {
    fn from(r: crate::s3::sync::CharacterSyncResult) -> Self {
        SyncResultDto {
            character_id: r.character_id,
            success: r.success,
            status: r.status,
            message: r.message,
        }
    }
}

impl From<CharacterSyncInputDto> for crate::s3::sync::CharacterSyncInput {
    fn from(d: CharacterSyncInputDto) -> Self {
        crate::s3::sync::CharacterSyncInput {
            id: d.id,
            name: d.name,
            description: d.description,
            created_at: d.created_at,
            preview_image_path: d.preview_image_path,
            nfc_payload: d.nfc_payload,
            device_address: d.device_address,
            track_paths: d.track_paths,
            track_titles: d.track_titles,
        }
    }
}
