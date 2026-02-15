use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager, State};

use crate::core::error::FabaError;
use crate::db::device_db;
use crate::device::{integrity, writer, recovery};
use crate::device::writer::WriteCharacterParams;
use crate::dto::device_management::{DeviceCharacterDto, PendingOperationDto};
use crate::dto::fababox::{DeviceStatusDto, SlotDto, TrackDto, NewTrackDto};
use crate::faba::FabaBox;
use crate::mki::encode_using_tempfile;

mod mki;
mod faba;
mod core;
mod dto;
mod db;
mod device;

type FabaState = Arc<Mutex<Option<FabaBox>>>;
type DeviceDbState = Arc<Mutex<Option<rusqlite::Connection>>>; // Arc<Mutex<Option<Connection>>>

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
    let res = faba
        .list_all_slots()
        .into_iter()
        .map(From::from)
        .collect();
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

    let nfc_payload = format!("K5{:03}", slot);
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
