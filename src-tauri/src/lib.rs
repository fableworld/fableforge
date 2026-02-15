use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::core::error::FabaError;
use crate::db::device_db;
use crate::dto::device_management::{DeviceCharacterDto, PendingOperationDto};
use crate::dto::fababox::{DeviceStatusDto, SlotDto, TrackDto, NewTrackDto, WriteProgressDto};
use crate::faba::FabaBox;
use crate::mki::encode_using_tempfile;

mod mki;
mod faba;
mod core;
mod dto;
mod db;

type FabaState = Arc<Mutex<Option<FabaBox>>>;
type DeviceDbState = Arc<Mutex<Option<Connection>>>;

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
    // Get the mountpoint while holding the lock, then drop it
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

#[tauri::command]
async fn write_character_to_slot(
    app: AppHandle,
    maybe_faba: State<'_, FabaState>,
    slot: usize,
    tracks: Vec<PathBuf>,
) -> Result<(), FabaError> {
    let total = tracks.len();

    // Get mountpoint and clear slot while holding lock (sync operations)
    let mountpoint = {
        let guard = maybe_faba.lock().map_err(|_| FabaError::Communication)?;
        let Some(ref faba) = *guard else {
            return Err(FabaError::NotDetected)
        };
        faba.clear_slot(slot).map_err(|_| FabaError::Communication)?;
        faba.mountpoint_path()
    };
    // Lock is dropped here

    let collection_dir = mountpoint.join(format!("MKI01/K5{slot:03}"));
    std::fs::create_dir_all(&collection_dir).map_err(|_| FabaError::Communication)?;

    for (i, track_path) in tracks.iter().enumerate() {
        let track_name = track_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("track")
            .to_string();

        // Emit progress
        let _ = app.emit("write-progress", WriteProgressDto {
            current: i,
            total,
            track_name: track_name.clone(),
            status: "writing".into(),
        });

        // Write track using standalone function (no lock needed)
        let dest = collection_dir.join(format!("CP{:02}.MKI", i + 1));
        encode_using_tempfile(track_path, dest, slot, i + 1)
            .await
            .map_err(|err| {
                eprintln!("Write error for track {i}: {err}");
                let _ = app.emit("write-progress", WriteProgressDto {
                    current: i,
                    total,
                    track_name,
                    status: "error".into(),
                });
                FabaError::Communication
            })?;
    }

    // Emit done
    let _ = app.emit("write-progress", WriteProgressDto {
        current: total,
        total,
        track_name: String::new(),
        status: "done".into(),
    });

    Ok(())
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
fn get_pending_operations(
    db_state: State<DeviceDbState>,
) -> Result<Vec<PendingOperationDto>, FabaError> {
    let guard = db_state.lock().map_err(|_| FabaError::Communication)?;
    let Some(ref conn) = *guard else {
        return Err(FabaError::NotDetected);
    };
    let ops = device_db::get_all_pending_ops(conn)?;
    Ok(ops.into_iter().map(PendingOperationDto::from).collect())
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

                // Update DB connection when device connects/disconnects
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

            // Open DB if device is connected at startup
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

            // Start device polling in background
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
            get_device_characters,
            get_device_character,
            get_pending_operations,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
