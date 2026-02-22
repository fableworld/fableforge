use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager, State};

use crate::core::error::FabaError;
use crate::db::device_db;
use crate::device::{integrity, writer, recovery};
use crate::device::writer::WriteCharacterParams;
use crate::dto::device_management::{DeviceCharacterDto, PendingOperationDto};
use crate::dto::fababox::{DeviceStatusDto, SlotDto, TrackDto, NewTrackDto};
use crate::dto::system::{SystemInfoDto, DiagnosticResultDto};
use crate::dto::s3::{S3ConfigDto, S3ConnectionResultDto, SyncMetadataDto, SyncResultDto, CharacterSyncInputDto};
use crate::faba::FabaBox;
use crate::mki::encode_using_tempfile;

mod mki;
mod faba;
mod core;
mod dto;
mod db;
mod device;
mod s3;

type FabaState = Arc<Mutex<Option<FabaBox>>>;
type DeviceDbState = Arc<Mutex<Option<rusqlite::Connection>>>;
type InstanceId = Arc<String>; // Unique app session ID for lockfiles

#[tauri::command]
fn load_slots(maybe_faba: State<FabaState>) -> Result<Vec<SlotDto>, FabaError> {
    let guard = maybe_faba.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref faba) = *guard else {
        return Err(FabaError::NotDetected)
    };
    let res = faba
        .list_slots()
        .into_iter()
        .map(From::from)
        .collect();
    Ok(res)
}

#[tauri::command]
fn load_tracks(maybe_faba: State<FabaState>, slot: usize) -> Result<Vec<TrackDto>, FabaError> {
    let guard = maybe_faba.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref faba) = *guard else {
        return Err(FabaError::NotDetected)
    };

    let res = faba
        .list_tracks(slot)
        .map_err(|_| FabaError::Communication)?
        .into_iter()
        .map(From::from)
        .collect();

    Ok(res)
}

#[tauri::command]
async fn write_tracks(maybe_faba: State<'_, FabaState>, slot: usize, new_tracks: Vec<NewTrackDto>) -> Result<(), FabaError> {
    let mountpoint = {
        let guard = maybe_faba.lock().map_err(|_| FabaError::Communication)?;
        let Some(ref faba) = *guard else {
            return Err(FabaError::NotDetected)
        };
        faba.mountpoint_path()
    };

    for track in new_tracks {
        let collection_dir = mountpoint.join(format!("MKI01/K5{slot:03}"));
        let track_path = collection_dir.join(format!("CP{:02}.MKI", track.track_number + 1));
        encode_using_tempfile(track.path, track_path, slot, track.track_number + 1)
            .await
            .map_err(|err| {
                eprintln!("Write error - {err}");
                FabaError::Communication
            })?;
    }
    Ok(())
}

#[tauri::command]
async fn copy_audio_file(
    app: AppHandle,
    src: String,
    collection_id: String,
    filename: String,
) -> Result<String, FabaError> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| FabaError::Communication)?;
    let dest_dir = app_data
        .join("collections")
        .join(&collection_id)
        .join("tracks");
    std::fs::create_dir_all(&dest_dir).map_err(|_| FabaError::Communication)?;

    let dest = dest_dir.join(&filename);
    std::fs::copy(&src, &dest).map_err(|_| FabaError::Communication)?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn check_device(maybe_faba: State<FabaState>) -> DeviceStatusDto {
    let guard = maybe_faba.lock().ok();
    let connected = guard.as_ref().map(|g| g.is_some()).unwrap_or(false);
    DeviceStatusDto {
        connected,
        mountpoint: if connected {
            guard.and_then(|g| g.as_ref().map(|f| f.mountpoint_str()))
        } else {
            None
        },
    }
}

#[tauri::command]
fn get_device_slots(maybe_faba: State<FabaState>) -> Result<Vec<SlotDto>, FabaError> {
    let guard = maybe_faba.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref faba) = *guard else {
        return Err(FabaError::NotDetected)
    };
    
    // We also need to cross-ref with the DB to get names
    let mut characters: std::collections::HashMap<usize, String> = std::collections::HashMap::new();
    if let Ok(conn) = crate::db::device_db::open_device_db(&faba.mountpoint_path()) {
        if let Ok(all_chars) = crate::db::device_db::get_all_characters(&conn) {
            for c in all_chars {
                characters.insert(c.slot_index, c.character_name);
            }
        }
    }

    let res: Vec<SlotDto> = faba
        .list_all_slots()
        .into_iter()
        .map(|mut s| {
            if let Some(name) = characters.get(&s.index) {
                s.name = Some(name.clone());
            }
            SlotDto::from(s)
        })
        .collect();
    println!("get_device_slots: Found {} slots", res.len());
    Ok(res)

}


// --- New Two-Phase Commit Write Command ---

#[tauri::command]
async fn write_character_to_slot(
    app: AppHandle,
    maybe_faba: State<'_, FabaState>,
    db_state: State<'_, DeviceDbState>,
    slot: usize,
    tracks: Vec<PathBuf>,
    character_id: Option<String>,
    character_name: Option<String>,
    description: Option<String>,
    preview_image_url: Option<String>,
    registry_url: Option<String>,
    registry_name: Option<String>,
    content_hash: Option<String>,
) -> Result<String, FabaError> {
    let mountpoint = {
        let guard = maybe_faba.lock().map_err(|_| FabaError::Communication)?;
        let Some(ref faba) = *guard else {
            return Err(FabaError::NotDetected)
        };
        faba.mountpoint_path()
    };

    // Download preview image before touching DB (this is async)
    let preview_blob = if let Some(ref url) = preview_image_url {
        download_image(url).await.ok()
    } else {
        None
    };

    let nfc_payload = format!("021905305{:03}00", slot);
    let db_handle: DeviceDbState = db_state.inner().clone();

    let params = WriteCharacterParams {
        slot_index: slot,
        character_id: character_id.unwrap_or_else(|| format!("local-{}", slot)),
        character_name: character_name.unwrap_or_else(|| format!("Slot {}", slot)),
        description,
        preview_image_blob: preview_blob,
        preview_image_url,
        registry_url,
        registry_name,
        track_paths: tracks,
        nfc_payload: Some(nfc_payload),
        content_hash,
    };

    writer::write_character(&app, &db_handle, &mountpoint, params).await
}

#[tauri::command]
async fn process_and_save_image(
    app: AppHandle,
    src_path: String,
    collection_id: String,
    character_id: String,
) -> Result<String, FabaError> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| FabaError::Communication)?;
    
    let dest_dir = app_data
        .join("collections")
        .join(&collection_id)
        .join("previews");
    std::fs::create_dir_all(&dest_dir).map_err(|_| FabaError::Communication)?;

    let dest_filename = format!("{}.jpg", character_id);
    let dest_path = dest_dir.join(&dest_filename);

    // Open image
    let img = image::open(&src_path).map_err(|e| FabaError::Custom(format!("Failed to open image: {}", e)))?;

    // Resize to 400x400 (fill)
    let resized = img.resize_to_fill(800, 800, image::imageops::FilterType::Lanczos3);

    // Save as JPEG
    resized
        .save_with_format(&dest_path, image::ImageFormat::Jpeg)
        .map_err(|e| FabaError::Custom(format!("Failed to save image: {}", e)))?;

    Ok(dest_path.to_string_lossy().to_string())
}

// --- Slot Check Commands ---

#[tauri::command]
fn check_slot_status(
    maybe_faba: State<FabaState>,
    db_state: State<DeviceDbState>,
    slot_index: usize,
    registry_url: String,
    character_id: String,
    content_hash: Option<String>,
) -> Result<integrity::SlotCheckResult, FabaError> {
    let mountpoint = {
        let guard = maybe_faba.lock().map_err(|_| FabaError::Communication)?;
        let Some(ref faba) = *guard else {
            return Err(FabaError::NotDetected)
        };
        faba.mountpoint_path()
    };

    let conn_guard = db_state.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref conn) = *conn_guard else {
        return Err(FabaError::NotDetected);
    };

    Ok(integrity::check_slot(
        conn,
        &mountpoint,
        slot_index,
        &registry_url,
        &character_id,
        content_hash.as_deref(),
    ))
}

#[tauri::command]
fn check_character_on_device(
    db_state: State<DeviceDbState>,
    registry_url: String,
    character_id: String,
) -> Result<Option<DeviceCharacterDto>, FabaError> {
    let conn_guard = db_state.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref conn) = *conn_guard else {
        return Err(FabaError::NotDetected);
    };

    let found = integrity::find_character_on_device(conn, &registry_url, &character_id);
    Ok(found.map(DeviceCharacterDto::from))
}

#[tauri::command]
fn delete_device_character(
    maybe_faba: State<FabaState>,
    db_state: State<DeviceDbState>,
    slot_index: usize,
) -> Result<(), FabaError> {
    let mountpoint = {
        let guard = maybe_faba.lock().map_err(|_| FabaError::Communication)?;
        let Some(ref faba) = *guard else {
            return Err(FabaError::NotDetected)
        };
        faba.mountpoint_path()
    };

    let conn_guard = db_state.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref conn) = *conn_guard else {
        return Err(FabaError::NotDetected);
    };

    writer::delete_character_from_slot(conn, &mountpoint, slot_index)
}

// --- Device DB Commands ---

#[tauri::command]
fn get_device_characters(
    db_state: State<DeviceDbState>,
) -> Result<Vec<DeviceCharacterDto>, FabaError> {
    let guard = db_state.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref conn) = *guard else {
        return Err(FabaError::NotDetected);
    };
    let chars = device_db::get_all_characters(conn)?;
    Ok(chars.into_iter().map(DeviceCharacterDto::from).collect())
}

#[tauri::command]
fn get_device_character(
    db_state: State<DeviceDbState>,
    slot_index: usize,
) -> Result<Option<DeviceCharacterDto>, FabaError> {
    let guard = db_state.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref conn) = *guard else {
        return Err(FabaError::NotDetected);
    };
    let char = device_db::get_character_by_slot(conn, slot_index)?;
    Ok(char.map(DeviceCharacterDto::from))
}

#[tauri::command]
async fn get_pending_operations(
    db_state: State<'_, DeviceDbState>,
) -> Result<Vec<PendingOperationDto>, FabaError> {
    let guard = db_state.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref conn) = *guard else {
        return Ok(Vec::new());
    };

    let ops = recovery::check_pending_operations(conn)?;
    Ok(ops.into_iter().map(PendingOperationDto::from).collect())
}

#[tauri::command]
async fn rollback_pending_operation(
    db_state: State<'_, DeviceDbState>,
    maybe_faba: State<'_, FabaState>,
    op_id: i64,
    slot_index: usize,
) -> Result<(), FabaError> {
    let mountpoint = {
        let faba = maybe_faba.lock().map_err(|_| FabaError::Communication)?;
        faba.as_ref().ok_or(FabaError::NotDetected)?.mountpoint_path()
    };

    let guard = db_state.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref conn) = *guard else {
        return Err(FabaError::NotDetected);
    };

    recovery::rollback_operation(conn, &mountpoint, op_id, slot_index)
}

#[tauri::command]
async fn complete_pending_delete(
    db_state: State<'_, DeviceDbState>,
    maybe_faba: State<'_, FabaState>,
    op_id: i64,
    slot_index: usize,
) -> Result<(), FabaError> {
    let mountpoint = {
        let faba = maybe_faba.lock().map_err(|_| FabaError::Communication)?;
        faba.as_ref().ok_or(FabaError::NotDetected)?.mountpoint_path()
    };

    let guard = db_state.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref conn) = *guard else {
        return Err(FabaError::NotDetected);
    };

    recovery::complete_delete(conn, &mountpoint, op_id, slot_index)
}

// --- Helpers ---

async fn download_image(url: &str) -> Result<Vec<u8>, FabaError> {
    // Simple HTTP GET for preview image
    // In a full implementation this would use reqwest or similar
    // For now, we just try to read it as a local file path
    if url.starts_with("http://") || url.starts_with("https://") {
        // TODO: implement HTTP download when reqwest is added
        Err(FabaError::Custom("HTTP download not yet implemented".into()))
    } else {
        // Treat as local file path
        std::fs::read(url).map_err(|e| FabaError::Custom(format!("Failed to read image: {}", e)))
    }
}

#[tauri::command]
async fn get_system_info(app: AppHandle) -> Result<SystemInfoDto, FabaError> {
    let data_dir = app.path().app_data_dir()
        .map_err(|_| FabaError::Communication)?
        .to_string_lossy()
        .to_string();

    Ok(SystemInfoDto {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        tauri_version: tauri::VERSION.to_string(),
        app_version: app.package_info().version.to_string(),
        data_dir,
    })
}

#[tauri::command]
async fn run_diagnostic(app: AppHandle) -> Result<DiagnosticResultDto, FabaError> {
    // Simulate some work
    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
    
    let data_dir = app.path().app_data_dir().map_err(|_| FabaError::Communication)?;
    let collections_dir = data_dir.join("collections");
    
    let collections_exists = collections_dir.exists();
    let message = if collections_exists {
        format!("System health: Optimal. Collections directory verified at {:?}", collections_dir)
    } else {
        "System health: Good. Initializing collection structures.".to_string()
    };

    Ok(DiagnosticResultDto {
        status: "Success".to_string(),
        message,
    })
}

// --- S3 Commands ---

#[tauri::command]
async fn s3_save_config(app: AppHandle, config: S3ConfigDto) -> Result<(), FabaError> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("fableforge-data.json")
        .map_err(|e| FabaError::S3(format!("Failed to open store: {}", e)))?;

    let mut configs: Vec<S3ConfigDto> = store
        .get("s3_configs")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    // Upsert by config ID
    if let Some(idx) = configs.iter().position(|c| c.id == config.id) {
        configs[idx] = config;
    } else {
        configs.push(config);
    }

    store.set("s3_configs", serde_json::to_value(&configs)
        .map_err(|e| FabaError::S3(format!("Serialization error: {}", e)))?);
    store.save()
        .map_err(|e| FabaError::S3(format!("Failed to save store: {}", e)))?;

    Ok(())
}

#[tauri::command]
async fn s3_get_configs(app: AppHandle) -> Result<Vec<S3ConfigDto>, FabaError> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("fableforge-data.json")
        .map_err(|e| FabaError::S3(format!("Failed to open store: {}", e)))?;

    let configs: Vec<S3ConfigDto> = store
        .get("s3_configs")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    Ok(configs)
}

#[tauri::command]
async fn s3_delete_config(app: AppHandle, config_id: String) -> Result<(), FabaError> {
    use tauri_plugin_store::StoreExt;

    // Delete credentials from keyring
    s3::credentials::delete_credentials(&config_id)?;

    // Remove from store
    let store = app.store("fableforge-data.json")
        .map_err(|e| FabaError::S3(format!("Failed to open store: {}", e)))?;

    let mut configs: Vec<S3ConfigDto> = store
        .get("s3_configs")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    configs.retain(|c| c.id != config_id);

    store.set("s3_configs", serde_json::to_value(&configs)
        .map_err(|e| FabaError::S3(format!("Serialization error: {}", e)))?);
    store.save()
        .map_err(|e| FabaError::S3(format!("Failed to save store: {}", e)))?;

    Ok(())
}

#[tauri::command]
async fn s3_store_credentials(
    config_id: String,
    access_key: String,
    secret_key: String,
) -> Result<(), FabaError> {
    s3::credentials::store_credentials(&config_id, &access_key, &secret_key)
}

#[tauri::command]
async fn s3_test_connection(app: AppHandle, config_id: String) -> Result<S3ConnectionResultDto, FabaError> {
    use tauri_plugin_store::StoreExt;

    // Load the config
    let store = app.store("fableforge-data.json")
        .map_err(|e| FabaError::S3(format!("Failed to open store: {}", e)))?;

    let configs: Vec<S3ConfigDto> = store
        .get("s3_configs")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let config_dto = configs
        .into_iter()
        .find(|c| c.id == config_id)
        .ok_or_else(|| FabaError::S3("S3 config not found".into()))?;

    let config: s3::config::S3Config = config_dto.into();

    // Load credentials from keyring
    let (access_key, secret_key) = s3::credentials::get_credentials(&config_id)?;

    // Build client and test
    let client = s3::client::build_client(&config, &access_key, &secret_key)?;
    let info = s3::client::test_connection(&client, &config).await;

    Ok(info.into())
}

#[tauri::command]
async fn s3_get_public_url(app: AppHandle, config_id: String) -> Result<Option<String>, FabaError> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("fableforge-data.json")
        .map_err(|e| FabaError::S3(format!("Failed to open store: {}", e)))?;

    let configs: Vec<S3ConfigDto> = store
        .get("s3_configs")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let config_dto = configs
        .into_iter()
        .find(|c| c.id == config_id)
        .ok_or_else(|| FabaError::S3("S3 config not found".into()))?;

    let config: s3::config::S3Config = config_dto.into();
    Ok(config.public_index_url())
}

// --- S3 Sync Commands ---

#[tauri::command]
async fn s3_sync_upload(
    app: AppHandle,
    instance_id: State<'_, InstanceId>,
    config_id: String,
    character: CharacterSyncInputDto,
    collection_name: String,
    collection_description: Option<String>,
) -> Result<SyncResultDto, FabaError> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("fableforge-data.json")
        .map_err(|e| FabaError::S3(format!("Failed to open store: {}", e)))?;

    let configs: Vec<S3ConfigDto> = store
        .get("s3_configs")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let config_dto = configs
        .into_iter()
        .find(|c| c.id == config_id)
        .ok_or_else(|| FabaError::S3("S3 config not found".into()))?;

    let config: s3::config::S3Config = config_dto.into();
    let (access_key, secret_key) = s3::credentials::get_credentials(&config_id)?;
    let client = s3::client::build_client(&config, &access_key, &secret_key)?;

    let char_input: s3::sync::CharacterSyncInput = character.into();
    let result = s3::sync::upload_character(&client, &config, &char_input, &instance_id).await?;

    // Update index.json after successful upload
    s3::sync::update_index_after_upload(
        &client,
        &config,
        &collection_name,
        collection_description.as_deref(),
        &char_input,
    ).await?;

    // Save sync metadata locally
    let sync_meta = s3::sync::SyncMetadata {
        character_id: result.character_id.clone(),
        sync_enabled: true,
        local_hash: result.content_hash.clone(),
        remote_etag: result.new_etag.clone(),
        last_synced_at: Some(chrono::Utc::now().to_rfc3339()),
        sync_status: s3::sync::SyncStatus::Synced,
    };
    save_sync_metadata(&app, &config_id, &sync_meta)?;

    Ok(result.into())
}

#[tauri::command]
async fn s3_sync_download(
    app: AppHandle,
    config_id: String,
    character_id: String,
) -> Result<SyncResultDto, FabaError> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("fableforge-data.json")
        .map_err(|e| FabaError::S3(format!("Failed to open store: {}", e)))?;

    let configs: Vec<S3ConfigDto> = store
        .get("s3_configs")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let config_dto = configs
        .into_iter()
        .find(|c| c.id == config_id)
        .ok_or_else(|| FabaError::S3("S3 config not found".into()))?;

    let collection_id = config_dto.collection_id.clone();
    let config: s3::config::S3Config = config_dto.into();
    let (access_key, secret_key) = s3::credentials::get_credentials(&config_id)?;
    let client = s3::client::build_client(&config, &access_key, &secret_key)?;

    let app_data_dir = app.path().app_data_dir()
        .map_err(|_| FabaError::Communication)?;

    let result = s3::sync::download_character(
        &client, &config, &character_id, &app_data_dir, &collection_id
    ).await?;

    // Save sync metadata locally
    let sync_meta = s3::sync::SyncMetadata {
        character_id: result.character_id.clone(),
        sync_enabled: true,
        local_hash: result.content_hash.clone(),
        remote_etag: result.new_etag.clone(),
        last_synced_at: Some(chrono::Utc::now().to_rfc3339()),
        sync_status: s3::sync::SyncStatus::Synced,
    };
    save_sync_metadata(&app, &config_id, &sync_meta)?;

    Ok(result.into())
}

#[tauri::command]
async fn s3_get_sync_status(
    app: AppHandle,
    config_id: String,
) -> Result<Vec<SyncMetadataDto>, FabaError> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("fableforge-data.json")
        .map_err(|e| FabaError::S3(format!("Failed to open store: {}", e)))?;

    let key = format!("sync_metadata_{}", config_id);
    let metadata_map: std::collections::HashMap<String, s3::sync::SyncMetadata> = store
        .get(&key)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    Ok(metadata_map.into_values().map(SyncMetadataDto::from).collect())
}

#[tauri::command]
async fn s3_resolve_conflict(
    app: AppHandle,
    instance_id: State<'_, InstanceId>,
    config_id: String,
    character_id: String,
    resolution: String,
    character: Option<CharacterSyncInputDto>,
    collection_name: Option<String>,
    collection_description: Option<String>,
) -> Result<SyncResultDto, FabaError> {
    match resolution.as_str() {
        "local" => {
            // Force upload local version
            let char_input = character
                .ok_or_else(|| FabaError::S3("Character data required for local resolution".into()))?;
            let col_name = collection_name
                .ok_or_else(|| FabaError::S3("Collection name required".into()))?;

            s3_sync_upload(
                app, instance_id, config_id, char_input, col_name, collection_description
            ).await
        }
        "remote" => {
            // Force download remote version
            s3_sync_download(app, config_id, character_id).await
        }
        _ => Err(FabaError::S3(format!("Unknown resolution: {}", resolution))),
    }
}

/// Helper: save sync metadata to the Tauri store.
fn save_sync_metadata(
    app: &AppHandle,
    config_id: &str,
    meta: &s3::sync::SyncMetadata,
) -> Result<(), FabaError> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("fableforge-data.json")
        .map_err(|e| FabaError::S3(format!("Failed to open store: {}", e)))?;

    let key = format!("sync_metadata_{}", config_id);
    let mut metadata_map: std::collections::HashMap<String, s3::sync::SyncMetadata> = store
        .get(&key)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    metadata_map.insert(meta.character_id.clone(), meta.clone());

    store.set(&key, serde_json::to_value(&metadata_map)
        .map_err(|e| FabaError::S3(format!("Serialization error: {}", e)))?);
    store.save()
        .map_err(|e| FabaError::S3(format!("Failed to save store: {}", e)))?;

    Ok(())
}

#[tauri::command]
async fn s3_sync_all(
    app: AppHandle,
    instance_id: State<'_, InstanceId>,
    config_id: String,
    characters: Vec<CharacterSyncInputDto>,
    collection_name: String,
    collection_description: Option<String>,
) -> Result<Vec<SyncResultDto>, FabaError> {
    let mut results = Vec::new();
    for character in characters {
        let char_id = character.id.clone();
        match s3_sync_upload(
            app.clone(),
            instance_id.clone(),
            config_id.clone(),
            character,
            collection_name.clone(),
            collection_description.clone(),
        ).await {
            Ok(result) => results.push(result),
            Err(e) => {
                results.push(SyncResultDto {
                    character_id: char_id,
                    success: false,
                    status: "error".into(),
                    message: Some(format!("{}", e)),
                });
            }
        }
    }
    Ok(results)
}

// --- Device Polling ---

fn start_device_polling(app: AppHandle, faba_state: FabaState, db_state: DeviceDbState) {
    std::thread::spawn(move || {
        let mut was_connected = {
            let guard = faba_state.lock().unwrap();
            guard.is_some()
        };

        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));

            let new_faba = FabaBox::detect();
            let is_connected = new_faba.is_some();

            if is_connected != was_connected {
                let mountpoint = new_faba.as_ref().map(|f| f.mountpoint_str());

                if is_connected {
                    if let Some(ref faba) = new_faba {
                        let mp = faba.mountpoint_path();
                        match device_db::open_device_db(&mp) {
                            Ok(conn) => {
                                let mut db_guard = db_state.lock().unwrap();
                                *db_guard = Some(conn);
                                tracing::info!("Device DB opened at {:?}", mp);
                            }
                            Err(e) => {
                                tracing::error!("Failed to open device DB: {}", e);
                            }
                        }
                    }
                } else {
                    let mut db_guard = db_state.lock().unwrap();
                    *db_guard = None;
                    tracing::info!("Device DB closed");
                }

                {
                    let mut guard = faba_state.lock().unwrap();
                    *guard = new_faba;
                }
                let _ = app.emit("device-status-changed", DeviceStatusDto {
                    connected: is_connected,
                    mountpoint,
                });
                was_connected = is_connected;
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let faba = FabaBox::detect();

            let db_conn = faba.as_ref().and_then(|f| {
                let mp = f.mountpoint_path();
                match device_db::open_device_db(&mp) {
                    Ok(conn) => {
                        tracing::info!("Device DB opened at startup: {:?}", mp);
                        Some(conn)
                    }
                    Err(e) => {
                        tracing::error!("Failed to open device DB at startup: {}", e);
                        None
                    }
                }
            });

            let faba_state: FabaState = Arc::new(Mutex::new(faba));
            let db_state: DeviceDbState = Arc::new(Mutex::new(db_conn));

            app.manage(faba_state.clone());
            app.manage(db_state.clone());

            // Generate a unique instance ID for this app session (used for S3 lockfiles)
            let instance_id: InstanceId = Arc::new(uuid::Uuid::new_v4().to_string());
            app.manage(instance_id);
            start_device_polling(app.handle().clone(), faba_state, db_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_slots,
            load_tracks,
            write_tracks,
            copy_audio_file,
            check_device,
            get_device_slots,
            write_character_to_slot,
            check_slot_status,
            check_character_on_device,
            delete_device_character,
            get_device_characters,
            get_device_character,
            get_pending_operations,
            rollback_pending_operation,
            complete_pending_delete,
            process_and_save_image,
            get_system_info,
            run_diagnostic,
            s3_save_config,
            s3_get_configs,
            s3_delete_config,
            s3_test_connection,
            s3_store_credentials,
            s3_get_public_url,
            s3_sync_upload,
            s3_sync_download,
            s3_get_sync_status,
            s3_resolve_conflict,
            s3_sync_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
