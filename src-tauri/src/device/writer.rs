use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use tauri::{AppHandle, Emitter};

use crate::core::error::FabaError;
use crate::db::device_db::{
    CharacterStatus, InsertCharacterParams, InsertPendingOpParams, PendingOperation,
};
use crate::db::device_db;
use crate::device::integrity;
use crate::dto::fababox::WriteProgressDto;
use crate::mki;

/// Thread-safe reference to an optional DB connection.
pub type DbHandle = Arc<Mutex<Option<Connection>>>;

/// Parameters for writing a character to a device slot.
#[derive(Debug, Clone)]
pub struct WriteCharacterParams {
    pub slot_index: usize,
    pub character_id: String,
    pub character_name: String,
    pub description: Option<String>,
    pub preview_image_blob: Option<Vec<u8>>,
    pub preview_image_url: Option<String>,
    pub registry_url: Option<String>,
    pub registry_name: Option<String>,
    pub track_paths: Vec<PathBuf>,
    pub nfc_payload: Option<String>,
    pub content_hash: Option<String>,
}

/// Two-phase commit writer for device characters.
///
/// The flow is:
/// 1. **Pre-write:** Insert character into DB with status "writing", create pending operation
/// 2. **Write:** For each track: encode to .MKI.partial → rename to .MKI → verify size
/// 3. **Post-write:** Remove pending operation, update status to "ready"
/// 4. **Rollback (on error):** Remove .partial files, remove DB entries
///
/// The DB handle is locked only briefly for each DB operation (not across await points).
pub async fn write_character(
    app: &AppHandle,
    db_handle: &DbHandle,
    mountpoint: &Path,
    params: WriteCharacterParams,
) -> Result<String, FabaError> {
    let slot = params.slot_index;
    let total_tracks = params.track_paths.len();
    let nfc_payload = params
        .nfc_payload
        .clone()
        .unwrap_or_else(|| format!("K5{:03}", slot));

    let slot_dir = integrity::slot_dir(mountpoint, slot);
    fs::create_dir_all(&slot_dir).map_err(|e| {
        FabaError::Custom(format!("Failed to create slot directory: {}", e))
    })?;

    // --- Phase 1: Pre-write (DB insert with status "writing") ---
    let op_id = {
        let guard = db_handle.lock().map_err(|_| FabaError::Communication)?;
        let conn = guard.as_ref().ok_or(FabaError::NotDetected)?;

        // Delete any existing character in this slot first
        let _ = device_db::delete_character(conn, slot);

        let char_params = InsertCharacterParams {
            slot_index: slot,
            status: CharacterStatus::Writing,
            character_id: params.character_id.clone(),
            character_name: params.character_name.clone(),
            description: params.description.clone(),
            preview_image_blob: params.preview_image_blob.clone(),
            preview_image_url: params.preview_image_url.clone(),
            registry_url: params.registry_url.clone(),
            registry_name: params.registry_name.clone(),
            track_count: total_tracks,
            tracks_json: Some(tracks_to_json(&params.track_paths)),
            nfc_payload: Some(nfc_payload.clone()),
            device_address: Some(slot),
            content_hash: params.content_hash.clone(),
        };

        device_db::insert_character(conn, &char_params).map_err(|e| {
            FabaError::Database(format!("Failed to insert character: {}", e))
        })?;

        let op_params = InsertPendingOpParams {
            slot_index: slot,
            operation: PendingOperation::Write,
            character_id: Some(params.character_id.clone()),
            registry_url: params.registry_url.clone(),
            tracks_json: Some(tracks_to_json(&params.track_paths)),
            total_tracks,
        };

        device_db::insert_pending_op(conn, &op_params).map_err(|e| {
            FabaError::Database(format!("Failed to insert pending op: {}", e))
        })?
    };
    // Guard is dropped here — safe to .await

    // --- Phase 2: Write tracks with .partial strategy ---

    // First, clear old files from the slot (but keep the directory)
    if let Err(e) = clear_mki_files(&slot_dir) {
        rollback_db(db_handle, slot, op_id);
        return Err(FabaError::Custom(format!("Failed to clear slot: {}", e)));
    }

    for (i, track_path) in params.track_paths.iter().enumerate() {
        let track_num = i + 1;
        let final_name = format!("CP{:02}.MKI", track_num);
        let partial_name = format!("CP{:02}.MKI.partial", track_num);
        let final_path = slot_dir.join(&final_name);
        let partial_path = slot_dir.join(&partial_name);

        let track_display_name = track_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("track")
            .to_string();

        // Emit progress: encoding
        let _ = app.emit(
            "write-progress",
            WriteProgressDto {
                current: i,
                total: total_tracks,
                track_name: track_display_name.clone(),
                status: "encoding".into(),
            },
        );

        // Encode to .partial file (async — no DB lock held)
        let encode_result =
            mki::encode_using_tempfile(track_path, &partial_path, slot, track_num).await;

        if let Err(err) = encode_result {
            eprintln!("Write error for track {track_num}: {err}");
            let _ = app.emit(
                "write-progress",
                WriteProgressDto {
                    current: i,
                    total: total_tracks,
                    track_name: track_display_name,
                    status: "error".into(),
                },
            );
            let _ = integrity::cleanup_partial_files(mountpoint, slot);
            rollback_db(db_handle, slot, op_id);
            return Err(FabaError::Communication);
        }

        // Capture file size before rename for post-rename verification
        let expected_size = partial_path
            .metadata()
            .map(|m| m.len())
            .unwrap_or(0);

        // Rename .partial → final
        if let Err(err) = fs::rename(&partial_path, &final_path) {
            eprintln!("Rename error for track {track_num}: {err}");
            let _ = integrity::cleanup_partial_files(mountpoint, slot);
            rollback_db(db_handle, slot, op_id);
            return Err(FabaError::Custom(format!(
                "Failed to rename track {}: {}",
                track_num, err
            )));
        }

        // Post-rename verification: check file size matches
        if expected_size > 0 && !integrity::verify_file_size(&final_path, expected_size) {
            eprintln!("Post-rename size mismatch for track {track_num}");
            let _ = integrity::cleanup_partial_files(mountpoint, slot);
            rollback_db(db_handle, slot, op_id);
            return Err(FabaError::Custom(format!(
                "Post-rename integrity check failed for track {}",
                track_num
            )));
        }

        // Update pending operation progress (brief lock)
        {
            let guard = db_handle.lock().ok();
            if let Some(Some(ref conn)) = guard.as_deref() {
                let _ = device_db::update_pending_op_progress(conn, op_id, track_num);
            }
        }

        // Emit progress: track done
        let _ = app.emit(
            "write-progress",
            WriteProgressDto {
                current: i + 1,
                total: total_tracks,
                track_name: track_display_name,
                status: "writing".into(),
            },
        );
    }

    // --- Phase 3: Post-write (finalize) ---
    {
        let guard = db_handle.lock().map_err(|_| FabaError::Communication)?;
        if let Some(ref conn) = *guard {
            let _ = device_db::delete_pending_op(conn, op_id);
            device_db::update_character_status(conn, slot, &CharacterStatus::Ready).map_err(|e| {
                FabaError::Database(format!("Failed to finalize character status: {}", e))
            })?;
        }
    }

    // Emit done
    let _ = app.emit(
        "write-progress",
        WriteProgressDto {
            current: total_tracks,
            total: total_tracks,
            track_name: String::new(),
            status: "done".into(),
        },
    );

    Ok(nfc_payload)
}

/// Delete a character from a device slot.
/// Uses two-phase commit: mark as deleting → remove files → remove from DB.
pub fn delete_character_from_slot(
    conn: &Connection,
    mountpoint: &Path,
    slot_index: usize,
) -> Result<(), FabaError> {
    // Mark as deleting in DB
    let _ = device_db::update_character_status(conn, slot_index, &CharacterStatus::Deleting);

    // Remove files
    let slot_dir = integrity::slot_dir(mountpoint, slot_index);
    if slot_dir.is_dir() {
        clear_mki_files(&slot_dir).map_err(|e| {
            FabaError::Custom(format!("Failed to clear slot files: {}", e))
        })?;
    }

    // Also clean any partial files
    let _ = integrity::cleanup_partial_files(mountpoint, slot_index);

    // Remove from DB
    device_db::delete_character(conn, slot_index).map_err(|e| {
        FabaError::Database(format!("Failed to delete character from DB: {}", e))
    })?;

    Ok(())
}

// --- Helpers ---

/// Rollback DB state on error — delete pending op and character entry.
fn rollback_db(db_handle: &DbHandle, slot: usize, op_id: i64) {
    if let Ok(guard) = db_handle.lock() {
        if let Some(ref conn) = *guard {
            let _ = device_db::delete_pending_op(conn, op_id);
            let _ = device_db::delete_character(conn, slot);
        }
    }
}

fn clear_mki_files(dir: &Path) -> std::io::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.ends_with(".MKI") || name.ends_with(".partial") {
            fs::remove_file(entry.path())?;
        }
    }
    Ok(())
}

fn tracks_to_json(paths: &[PathBuf]) -> String {
    let track_names: Vec<String> = paths
        .iter()
        .map(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string()
        })
        .collect();
    serde_json::to_string(&track_names).unwrap_or_else(|_| "[]".to_string())
}
