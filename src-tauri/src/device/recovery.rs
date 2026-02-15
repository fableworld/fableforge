use std::path::Path;
use rusqlite::Connection;
use crate::core::error::FabaError;
use crate::db::device_db::{self, PendingOperation, CharacterStatus};
use crate::device::integrity;

/// Action to take for recovery.
pub enum RecoveryAction {
    RetryWrite(usize),
    RetryDelete(usize),
    Cleanup(usize),
}

/// Checks the database for pending operations and returns suggested actions.
pub fn check_pending_operations(conn: &Connection) -> Result<Vec<db::PendingOp>, FabaError> {
    device_db::get_all_pending_ops(conn).map_err(|e| {
        FabaError::Database(format!("Failed to query pending operations: {}", e))
    })
}

/// Rolls back a pending operation: removes partial files and DB entries.
pub fn rollback_operation(
    conn: &Connection,
    mountpoint: &Path,
    op_id: i64,
    slot_index: usize,
) -> Result<(), FabaError> {
    // 1. Cleanup .partial files from the slot
    let _ = integrity::cleanup_partial_files(mountpoint, slot_index);

    // 2. Remove character entry if it's still in 'writing' or 'upgrading' status
    if let Ok(Some(character)) = device_db::get_character(conn, slot_index) {
        if character.status == "writing" || character.status == "upgrading" {
            let _ = device_db::delete_character(conn, slot_index);
        }
    }

    // 3. Remove the pending operation record
    device_db::delete_pending_op(conn, op_id).map_err(|e| {
        FabaError::Database(format!("Failed to delete pending operation: {}", e))
    })?;

    Ok(())
}

/// Completes a pending delete operation.
pub fn complete_delete(
    conn: &Connection,
    mountpoint: &Path,
    op_id: i64,
    slot_index: usize,
) -> Result<(), FabaError> {
    // 1. Clear files from slot
    let slot_dir = integrity::slot_dir(mountpoint, slot_index);
    if slot_dir.is_dir() {
        // We can reuse clear_mki_files from writer or move it to a common utility.
        // For now, let's just use a simple glob-like cleanup.
        if let Ok(entries) = std::fs::read_dir(&slot_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".MKI") || name.ends_with(".partial") {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }

    // 2. Remove character from DB
    let _ = device_db::delete_character(conn, slot_index);

    // 3. Remove pending op
    device_db::delete_pending_op(conn, op_id).map_err(|e| {
        FabaError::Database(format!("Failed to delete pending operation: {}", e))
    })?;

    Ok(())
}
