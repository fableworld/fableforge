use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use sha2::{Sha256, Digest};

use crate::db::device_db;

/// Result of checking a slot's consistency between DB and filesystem.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SlotCheckResult {
    /// Slot is empty: no DB entry AND no files on filesystem.
    Empty,
    /// Slot has a character with matching content hash.
    #[serde(rename_all = "camelCase")]
    SameCharacterSameContent {
        slot_index: usize,
        character_name: String,
        nfc_payload: Option<String>,
    },
    /// Same character (matching registry+id) but content hash differs → update available.
    #[serde(rename_all = "camelCase")]
    SameCharacterDifferentContent {
        slot_index: usize,
        character_name: String,
    },
    /// Different character occupies the slot.
    #[serde(rename_all = "camelCase")]
    DifferentCharacter {
        slot_index: usize,
        existing_character_name: String,
        existing_character_id: String,
        existing_registry_url: Option<String>,
    },
    /// Inconsistency: files exist on filesystem but no DB entry.
    /// This means the slot was written by a non-FableForge tool or an older version.
    #[serde(rename_all = "camelCase")]
    Inconsistent {
        slot_index: usize,
        file_count: usize,
    },
}

/// Check a slot's status by cross-referencing DB and filesystem.
///
/// `registry_url` and `character_id` identify the character we want to write.
/// `new_content_hash` is the computed hash of the new content.
pub fn check_slot(
    conn: &Connection,
    mountpoint: &Path,
    slot_index: usize,
    registry_url: &str,
    character_id: &str,
    new_content_hash: Option<&str>,
) -> SlotCheckResult {
    let db_entry = device_db::get_character_by_slot(conn, slot_index).ok().flatten();
    let fs_files = count_mki_files(mountpoint, slot_index);

    match (db_entry, fs_files > 0) {
        // Case 1: Nothing in DB, nothing on filesystem → empty
        (None, false) => SlotCheckResult::Empty,

        // Case 2: Nothing in DB, but files exist → inconsistent
        (None, true) => SlotCheckResult::Inconsistent {
            slot_index,
            file_count: fs_files,
        },

        // Case 3: DB entry exists
        (Some(dc), _) => {
            let same_character = dc.registry_url.as_deref() == Some(registry_url)
                && dc.character_id == character_id;

            if same_character {
                // Check content hash if available
                let content_matches = match (dc.content_hash.as_deref(), new_content_hash) {
                    (Some(existing), Some(new)) => existing == new,
                    _ => false, // If either hash is missing, assume different
                };

                if content_matches {
                    SlotCheckResult::SameCharacterSameContent {
                        slot_index,
                        character_name: dc.character_name,
                        nfc_payload: dc.nfc_payload,
                    }
                } else {
                    SlotCheckResult::SameCharacterDifferentContent {
                        slot_index,
                        character_name: dc.character_name,
                    }
                }
            } else {
                SlotCheckResult::DifferentCharacter {
                    slot_index,
                    existing_character_name: dc.character_name,
                    existing_character_id: dc.character_id,
                    existing_registry_url: dc.registry_url,
                }
            }
        }
    }
}

/// Check if a character already exists on the device (by registry+id).
/// Returns the slot index if found.
pub fn find_character_on_device(
    conn: &Connection,
    registry_url: &str,
    character_id: &str,
) -> Option<device_db::DeviceCharacter> {
    device_db::get_character_by_registry_and_id(conn, registry_url, character_id)
        .ok()
        .flatten()
}

/// Compute SHA-256 content hash from audio file paths + character metadata.
///
/// The hash includes:
/// - SHA-256 of each audio file's content (in order)
/// - Character name
/// - Description
/// - Number of tracks
pub fn compute_content_hash(
    audio_paths: &[PathBuf],
    character_name: &str,
    description: Option<&str>,
) -> String {
    let mut hasher = Sha256::new();

    // Hash metadata
    hasher.update(character_name.as_bytes());
    hasher.update(b"|");
    if let Some(desc) = description {
        hasher.update(desc.as_bytes());
    }
    hasher.update(b"|");
    hasher.update(audio_paths.len().to_string().as_bytes());
    hasher.update(b"|");

    // Hash each audio file
    for path in audio_paths {
        if let Ok(bytes) = fs::read(path) {
            let file_hash = Sha256::digest(&bytes);
            hasher.update(file_hash);
        } else {
            // If we can't read the file, hash its path instead
            hasher.update(path.to_string_lossy().as_bytes());
        }
        hasher.update(b"|");
    }

    format!("{:x}", hasher.finalize())
}

/// Count .MKI files in a slot directory (excluding placeholders by checking size).
fn count_mki_files(mountpoint: &Path, slot_index: usize) -> usize {
    let dir = slot_dir(mountpoint, slot_index);
    if !dir.is_dir() {
        return 0;
    }

    fs::read_dir(&dir)
        .ok()
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let name = e.file_name();
                    let name = name.to_string_lossy();
                    name.ends_with(".MKI") && !name.ends_with(".partial")
                })
                .filter(|e| {
                    // Skip placeholder tracks (exactly 18836 bytes, track 01)
                    let is_placeholder = e.file_name().to_string_lossy() == "CP01.MKI"
                        && e.metadata().map(|m| m.len() == 18836).unwrap_or(false);
                    !is_placeholder
                })
                .count()
        })
        .unwrap_or(0)
}

/// Clean up .partial files left from interrupted operations.
pub fn cleanup_partial_files(mountpoint: &Path, slot_index: usize) -> std::io::Result<usize> {
    let dir = slot_dir(mountpoint, slot_index);
    if !dir.is_dir() {
        return Ok(0);
    }

    let mut cleaned = 0;
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.ends_with(".partial") {
            fs::remove_file(entry.path())?;
            cleaned += 1;
        }
    }
    Ok(cleaned)
}

/// Verify a file's size after rename (post-rename integrity check for FAT32).
pub fn verify_file_size(path: &Path, expected_size: u64) -> bool {
    path.metadata()
        .map(|m| m.len() == expected_size)
        .unwrap_or(false)
}

/// Build the slot directory path.
pub fn slot_dir(mountpoint: &Path, slot_index: usize) -> PathBuf {
    mountpoint.join(format!("MKI01/K5{slot_index:03}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_compute_content_hash_deterministic() {
        let dir = tempdir().unwrap();
        let file1 = dir.path().join("track1.mp3");
        let file2 = dir.path().join("track2.mp3");
        fs::write(&file1, b"audio data 1").unwrap();
        fs::write(&file2, b"audio data 2").unwrap();

        let hash1 = compute_content_hash(
            &[file1.clone(), file2.clone()],
            "Test Character",
            Some("A description"),
        );
        let hash2 = compute_content_hash(
            &[file1, file2],
            "Test Character",
            Some("A description"),
        );

        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // SHA-256 hex is 64 chars
    }

    #[test]
    fn test_compute_content_hash_differs_on_content_change() {
        let dir = tempdir().unwrap();
        let file1 = dir.path().join("track1.mp3");
        fs::write(&file1, b"original data").unwrap();

        let hash1 = compute_content_hash(&[file1.clone()], "Name", None);

        fs::write(&file1, b"modified data").unwrap();
        let hash2 = compute_content_hash(&[file1], "Name", None);

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_compute_content_hash_differs_on_name_change() {
        let dir = tempdir().unwrap();
        let file1 = dir.path().join("track1.mp3");
        fs::write(&file1, b"audio data").unwrap();

        let hash1 = compute_content_hash(&[file1.clone()], "Name A", None);
        let hash2 = compute_content_hash(&[file1], "Name B", None);

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_cleanup_partial_files() {
        let dir = tempdir().unwrap();
        let slot_dir_path = dir.path().join("MKI01/K5042");
        fs::create_dir_all(&slot_dir_path).unwrap();

        // Create some partial and complete files
        fs::write(slot_dir_path.join("CP01.MKI"), b"complete").unwrap();
        fs::write(slot_dir_path.join("CP02.MKI.partial"), b"partial").unwrap();
        fs::write(slot_dir_path.join("CP03.MKI.partial"), b"partial2").unwrap();

        let cleaned = cleanup_partial_files(dir.path(), 42).unwrap();
        assert_eq!(cleaned, 2);

        // Verify only the complete file remains
        assert!(slot_dir_path.join("CP01.MKI").exists());
        assert!(!slot_dir_path.join("CP02.MKI.partial").exists());
        assert!(!slot_dir_path.join("CP03.MKI.partial").exists());
    }

    #[test]
    fn test_count_mki_files() {
        let dir = tempdir().unwrap();
        let slot_path = dir.path().join("MKI01/K5042");
        fs::create_dir_all(&slot_path).unwrap();

        // Create MKI files of different sizes
        fs::write(slot_path.join("CP01.MKI"), vec![0u8; 50000]).unwrap(); // Not placeholder (wrong size)
        fs::write(slot_path.join("CP02.MKI"), b"track data 2").unwrap();
        fs::write(slot_path.join("CP03.MKI.partial"), b"partial").unwrap(); // Should be excluded

        let count = count_mki_files(dir.path(), 42);
        assert_eq!(count, 2);
    }

    #[test]
    fn test_slot_check_empty() {
        let dir = tempdir().unwrap();
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::device_db::open_device_db_conn(&conn).unwrap();

        let result = check_slot(&conn, dir.path(), 42, "https://reg.com", "char-1", None);
        assert!(matches!(result, SlotCheckResult::Empty));
    }

    #[test]
    fn test_slot_check_inconsistent() {
        let dir = tempdir().unwrap();
        let slot_path = dir.path().join("MKI01/K5042");
        fs::create_dir_all(&slot_path).unwrap();
        // Create a non-placeholder MKI file (size != 18836)
        fs::write(slot_path.join("CP01.MKI"), vec![0u8; 50000]).unwrap();

        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::device_db::open_device_db_conn(&conn).unwrap();

        let result = check_slot(&conn, dir.path(), 42, "https://reg.com", "char-1", None);
        assert!(matches!(result, SlotCheckResult::Inconsistent { .. }));
    }
}
