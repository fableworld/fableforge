use aws_sdk_s3::Client;
use serde::{Deserialize, Serialize};

use crate::core::error::FabaError;
use crate::s3::config::S3Config;

/// Remote metadata stored per-character on S3 at `{char-id}/metadata.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteCharacterMetadata {
    pub character_id: String,
    pub content_hash: String,
    pub updated_at: String,
    pub updated_by: String,
    pub files: Vec<String>,
}

/// OpenFable-compatible index.json structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexJson {
    pub meta: IndexMeta,
    pub characters: Vec<IndexCharacter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexMeta {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub maintainer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexCharacter {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_sample_url: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tracks: Vec<IndexTrack>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub models_3d: Vec<IndexModel3D>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nfc_payload: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_address: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexTrack {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexModel3D {
    pub provider: String,
    pub url: String,
}

/// Build the public URL for an asset given the S3 config.
/// Constructs: `{endpoint}/{bucket}/{key}`
fn asset_url(config: &S3Config, relative_key: &str) -> String {
    let endpoint = config.endpoint.trim_end_matches('/');
    let full_key = config.full_key(relative_key);
    format!("{}/{}/{}", endpoint, config.bucket, full_key)
}

/// Build an index character entry with proper S3 asset URLs.
pub fn build_index_character(
    config: &S3Config,
    character_id: &str,
    name: &str,
    description: Option<&str>,
    created_at: Option<&str>,
    nfc_payload: Option<&str>,
    device_address: Option<u32>,
    has_preview: bool,
    track_count: usize,
    track_titles: &[Option<String>],
) -> IndexCharacter {
    let preview_image = if has_preview {
        Some(asset_url(config, &format!("{}/preview.jpg", character_id)))
    } else {
        None
    };

    let tracks: Vec<IndexTrack> = (0..track_count)
        .map(|i| {
            let title = track_titles.get(i).and_then(|t| t.clone());
            IndexTrack {
                url: Some(asset_url(
                    config,
                    &format!("{}/tracks/track_{}.mp3", character_id, i),
                )),
                title,
                duration: None,
            }
        })
        .collect();

    // First track as audio sample
    let audio_sample_url = tracks.first().and_then(|t| t.url.clone());

    IndexCharacter {
        id: character_id.to_string(),
        name: name.to_string(),
        created_at: created_at.map(String::from),
        description: description.map(String::from),
        preview_image,
        audio_sample_url,
        tracks,
        models_3d: Vec::new(),
        nfc_payload: nfc_payload.map(String::from),
        device_address,
    }
}

/// Generate and upload the index.json file to S3.
pub async fn upload_index(
    client: &Client,
    config: &S3Config,
    index: &IndexJson,
) -> Result<(), FabaError> {
    let json = serde_json::to_vec_pretty(index)
        .map_err(|e| FabaError::S3(format!("Failed to serialize index: {}", e)))?;

    let key = config.full_key("index.json");

    client
        .put_object()
        .bucket(&config.bucket)
        .key(&key)
        .body(json.into())
        .content_type("application/json")
        .send()
        .await
        .map_err(|e| FabaError::S3(format!("Failed to upload index.json: {}", e)))?;

    tracing::info!("Uploaded index.json to {}", key);
    Ok(())
}

/// Download and parse the existing index.json from S3.
/// Returns None if the file doesn't exist.
pub async fn download_index(
    client: &Client,
    config: &S3Config,
) -> Result<Option<IndexJson>, FabaError> {
    let key = config.full_key("index.json");

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
                .map_err(|e| FabaError::S3(format!("Failed to read index.json: {}", e)))?;
            let bytes = body.into_bytes();
            let index: IndexJson = serde_json::from_slice(&bytes)
                .map_err(|e| FabaError::S3(format!("Failed to parse index.json: {}", e)))?;
            Ok(Some(index))
        }
        Err(err) => {
            let service_err = err.into_service_error();
            if service_err.is_no_such_key() {
                Ok(None)
            } else {
                Err(FabaError::S3(format!("Failed to get index.json: {}", service_err)))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> S3Config {
        S3Config {
            id: "test".into(),
            name: "Test".into(),
            endpoint: "https://s3.example.com".into(),
            region: "auto".into(),
            bucket: "mybucket".into(),
            prefix: Some("fableforge/happygang".into()),
            is_public: true,
            collection_id: "col1".into(),
        }
    }

    #[test]
    fn build_index_character_with_preview_and_tracks() {
        let config = test_config();
        let char = build_index_character(
            &config,
            "char-123",
            "My Character",
            Some("A test character"),
            Some("2024-01-01T00:00:00Z"),
            Some("K5001"),
            Some(1),
            true,
            2,
            &[Some("Song 1".into()), Some("Song 2".into())],
        );

        assert_eq!(char.id, "char-123");
        assert_eq!(char.name, "My Character");
        assert_eq!(
            char.preview_image,
            Some("https://s3.example.com/mybucket/fableforge/happygang/char-123/preview.jpg".into())
        );
        assert_eq!(char.tracks.len(), 2);
        assert_eq!(
            char.tracks[0].url,
            Some("https://s3.example.com/mybucket/fableforge/happygang/char-123/tracks/track_0.mp3".into())
        );
        assert_eq!(char.tracks[0].title, Some("Song 1".into()));
    }

    #[test]
    fn build_index_character_without_preview() {
        let config = test_config();
        let char = build_index_character(
            &config,
            "char-456",
            "No Preview",
            None,
            None,
            None,
            None,
            false,
            0,
            &[],
        );

        assert!(char.preview_image.is_none());
        assert!(char.tracks.is_empty());
        assert!(char.audio_sample_url.is_none());
    }

    #[test]
    fn index_json_serializes_correctly() {
        let config = test_config();
        let index = IndexJson {
            meta: IndexMeta {
                name: "Happy Gang".into(),
                version: Some("1.0".into()),
                maintainer: Some("Davide".into()),
                description: Some("My collection".into()),
            },
            characters: vec![build_index_character(
                &config,
                "char-1",
                "Character One",
                None,
                None,
                None,
                None,
                true,
                1,
                &[None],
            )],
        };

        let json = serde_json::to_string_pretty(&index).unwrap();
        assert!(json.contains("\"name\": \"Happy Gang\""));
        assert!(json.contains("\"characters\""));
        assert!(json.contains("preview.jpg"));
    }
}
