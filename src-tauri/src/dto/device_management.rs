use serde::Serialize;
use crate::db::device_db::DeviceCharacter;

/// DTO for a device character sent to the frontend.
/// The preview image blob is sent as a base64-encoded data URL.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCharacterDto {
    pub id: i64,
    pub slot_index: usize,
    pub status: String,
    pub character_id: String,
    pub character_name: String,
    pub description: Option<String>,
    /// Base64-encoded data URL, e.g. "data:image/png;base64,..."
    pub preview_image_data_url: Option<String>,
    pub preview_image_url: Option<String>,
    pub registry_url: Option<String>,
    pub registry_name: Option<String>,
    pub track_count: usize,
    pub tracks_json: Option<String>,
    pub nfc_payload: Option<String>,
    pub device_address: Option<usize>,
    pub written_at: String,
    pub updated_at: String,
    pub content_hash: Option<String>,
}

impl From<DeviceCharacter> for DeviceCharacterDto {
    fn from(dc: DeviceCharacter) -> Self {
        let preview_image_data_url = dc.preview_image_blob.as_ref().map(|blob| {
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(blob);
            // Try to detect image type from magic bytes
            let mime = detect_image_mime(blob);
            format!("data:{};base64,{}", mime, b64)
        });

        Self {
            id: dc.id,
            slot_index: dc.slot_index,
            status: dc.status,
            character_id: dc.character_id,
            character_name: dc.character_name,
            description: dc.description,
            preview_image_data_url,
            preview_image_url: dc.preview_image_url,
            registry_url: dc.registry_url,
            registry_name: dc.registry_name,
            track_count: dc.track_count,
            tracks_json: dc.tracks_json,
            nfc_payload: dc.nfc_payload,
            device_address: dc.device_address,
            written_at: dc.written_at,
            updated_at: dc.updated_at,
            content_hash: dc.content_hash,
        }
    }
}

fn detect_image_mime(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        "image/png"
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if bytes.starts_with(b"GIF") {
        "image/gif"
    } else if bytes.starts_with(b"RIFF") && bytes.len() > 12 && &bytes[8..12] == b"WEBP" {
        "image/webp"
    } else {
        "image/png" // default fallback
    }
}

/// DTO for pending operation info sent to the frontend.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PendingOperationDto {
    pub id: i64,
    pub slot_index: usize,
    pub operation: String,
    pub started_at: String,
    pub character_id: Option<String>,
    pub registry_url: Option<String>,
    pub completed_tracks: usize,
    pub total_tracks: usize,
}

impl From<crate::db::device_db::PendingOp> for PendingOperationDto {
    fn from(op: crate::db::device_db::PendingOp) -> Self {
        Self {
            id: op.id,
            slot_index: op.slot_index,
            operation: op.operation,
            started_at: op.started_at,
            character_id: op.character_id,
            registry_url: op.registry_url,
            completed_tracks: op.completed_tracks,
            total_tracks: op.total_tracks,
        }
    }
}
