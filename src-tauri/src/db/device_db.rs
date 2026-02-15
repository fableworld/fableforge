use std::path::Path;

use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};

const DB_FILENAME: &str = ".fableforge.db";
const SCHEMA_VERSION: i32 = 1;

// --- Data Structures ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CharacterStatus {
    Writing,
    Deleting,
    Upgrading,
    Ready,
}

impl CharacterStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Writing => "writing",
            Self::Deleting => "deleting",
            Self::Upgrading => "upgrading",
            Self::Ready => "ready",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "writing" => Some(Self::Writing),
            "deleting" => Some(Self::Deleting),
            "upgrading" => Some(Self::Upgrading),
            "ready" => Some(Self::Ready),
            _ => None,
        }
    }

    pub fn is_pending(&self) -> bool {
        !matches!(self, Self::Ready)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCharacter {
    pub id: i64,
    pub slot_index: usize,
    pub status: String,
    pub character_id: String,
    pub character_name: String,
    pub description: Option<String>,
    pub preview_image_blob: Option<Vec<u8>>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PendingOperation {
    Write,
    Delete,
    Upgrade,
}

impl PendingOperation {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Write => "write",
            Self::Delete => "delete",
            Self::Upgrade => "upgrade",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "write" => Some(Self::Write),
            "delete" => Some(Self::Delete),
            "upgrade" => Some(Self::Upgrade),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingOp {
    pub id: i64,
    pub slot_index: usize,
    pub operation: String,
    pub started_at: String,
    pub character_id: Option<String>,
    pub registry_url: Option<String>,
    pub tracks_json: Option<String>,
    pub completed_tracks: usize,
    pub total_tracks: usize,
}

// --- Parameters for insert/update ---

#[derive(Debug, Clone)]
pub struct InsertCharacterParams {
    pub slot_index: usize,
    pub status: CharacterStatus,
    pub character_id: String,
    pub character_name: String,
    pub description: Option<String>,
    pub preview_image_blob: Option<Vec<u8>>,
    pub preview_image_url: Option<String>,
    pub registry_url: Option<String>,
    pub registry_name: Option<String>,
    pub track_count: usize,
    pub tracks_json: Option<String>,
    pub nfc_payload: Option<String>,
    pub device_address: Option<usize>,
    pub content_hash: Option<String>,
}

#[derive(Debug, Clone)]
pub struct InsertPendingOpParams {
    pub slot_index: usize,
    pub operation: PendingOperation,
    pub character_id: Option<String>,
    pub registry_url: Option<String>,
    pub tracks_json: Option<String>,
    pub total_tracks: usize,
}

// --- Database Init ---

/// Open (or create) the device database at the given mountpoint.
/// Returns a connection to `.fableforge.db` in the mountpoint root.
pub fn open_device_db(mountpoint: &Path) -> SqliteResult<Connection> {
    let db_path = mountpoint.join(DB_FILENAME);
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for better concurrent access
    conn.pragma_update(None, "journal_mode", "wal")?;

    init_schema(&conn)?;

    Ok(conn)
}

/// Initialize schema on an already-open connection (for testing with in-memory DBs).
pub fn open_device_db_conn(conn: &Connection) -> SqliteResult<()> {
    conn.pragma_update(None, "journal_mode", "wal")?;
    init_schema(conn)
}

fn init_schema(conn: &Connection) -> SqliteResult<()> {
    // Check if we need to create or migrate
    let version = get_schema_version(conn);

    if version == 0 {
        create_schema_v1(conn)?;
    }
    // Future migrations:
    // if version < 2 { migrate_v1_to_v2(conn)?; }

    Ok(())
}

fn get_schema_version(conn: &Connection) -> i32 {
    conn.pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap_or(0)
}

fn create_schema_v1(conn: &Connection) -> SqliteResult<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS device_characters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slot_index INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'writing',
            character_id TEXT NOT NULL,
            character_name TEXT NOT NULL,
            description TEXT,
            preview_image_blob BLOB,
            preview_image_url TEXT,
            registry_url TEXT,
            registry_name TEXT,
            track_count INTEGER NOT NULL DEFAULT 0,
            tracks_json TEXT,
            nfc_payload TEXT,
            device_address INTEGER,
            written_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            content_hash TEXT
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_slot ON device_characters(slot_index);

        CREATE TABLE IF NOT EXISTS pending_operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slot_index INTEGER NOT NULL,
            operation TEXT NOT NULL,
            started_at TEXT NOT NULL,
            character_id TEXT,
            registry_url TEXT,
            tracks_json TEXT,
            completed_tracks INTEGER DEFAULT 0,
            total_tracks INTEGER DEFAULT 0,
            FOREIGN KEY (slot_index) REFERENCES device_characters(slot_index)
        );
        ",
    )?;

    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;

    Ok(())
}

// --- CRUD: device_characters ---

pub fn insert_character(conn: &Connection, params: &InsertCharacterParams) -> SqliteResult<i64> {
    let now = chrono_now();
    conn.execute(
        "INSERT INTO device_characters (
            slot_index, status, character_id, character_name, description,
            preview_image_blob, preview_image_url, registry_url, registry_name,
            track_count, tracks_json, nfc_payload, device_address,
            written_at, updated_at, content_hash
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            params.slot_index,
            params.status.as_str(),
            params.character_id,
            params.character_name,
            params.description,
            params.preview_image_blob,
            params.preview_image_url,
            params.registry_url,
            params.registry_name,
            params.track_count,
            params.tracks_json,
            params.nfc_payload,
            params.device_address.map(|a| a as i64),
            &now,
            &now,
            params.content_hash,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_character_status(
    conn: &Connection,
    slot_index: usize,
    new_status: &CharacterStatus,
) -> SqliteResult<usize> {
    let now = chrono_now();
    conn.execute(
        "UPDATE device_characters SET status = ?1, updated_at = ?2 WHERE slot_index = ?3",
        params![new_status.as_str(), &now, slot_index],
    )
}

pub fn get_character_by_slot(
    conn: &Connection,
    slot_index: usize,
) -> SqliteResult<Option<DeviceCharacter>> {
    let mut stmt = conn.prepare(
        "SELECT id, slot_index, status, character_id, character_name, description,
                preview_image_blob, preview_image_url, registry_url, registry_name,
                track_count, tracks_json, nfc_payload, device_address,
                written_at, updated_at, content_hash
         FROM device_characters WHERE slot_index = ?1",
    )?;

    let mut rows = stmt.query_map(params![slot_index], row_to_device_character)?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

pub fn get_character_by_registry_and_id(
    conn: &Connection,
    registry_url: &str,
    character_id: &str,
) -> SqliteResult<Option<DeviceCharacter>> {
    let mut stmt = conn.prepare(
        "SELECT id, slot_index, status, character_id, character_name, description,
                preview_image_blob, preview_image_url, registry_url, registry_name,
                track_count, tracks_json, nfc_payload, device_address,
                written_at, updated_at, content_hash
         FROM device_characters WHERE registry_url = ?1 AND character_id = ?2",
    )?;

    let mut rows = stmt.query_map(params![registry_url, character_id], row_to_device_character)?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

pub fn get_all_characters(conn: &Connection) -> SqliteResult<Vec<DeviceCharacter>> {
    let mut stmt = conn.prepare(
        "SELECT id, slot_index, status, character_id, character_name, description,
                preview_image_blob, preview_image_url, registry_url, registry_name,
                track_count, tracks_json, nfc_payload, device_address,
                written_at, updated_at, content_hash
         FROM device_characters ORDER BY slot_index",
    )?;

    let rows = stmt.query_map([], row_to_device_character)?;
    rows.collect()
}

pub fn delete_character(conn: &Connection, slot_index: usize) -> SqliteResult<usize> {
    // Also remove any pending operations for this slot
    conn.execute(
        "DELETE FROM pending_operations WHERE slot_index = ?1",
        params![slot_index],
    )?;
    conn.execute(
        "DELETE FROM device_characters WHERE slot_index = ?1",
        params![slot_index],
    )
}

/// Replace a character in a slot (used for overwriting).
/// Deletes the old one and inserts the new one in a transaction.
pub fn replace_character(conn: &Connection, params: &InsertCharacterParams) -> SqliteResult<i64> {
    // Delete old if exists
    delete_character(conn, params.slot_index)?;
    insert_character(conn, params)
}

// --- CRUD: pending_operations ---

pub fn insert_pending_op(conn: &Connection, params: &InsertPendingOpParams) -> SqliteResult<i64> {
    let now = chrono_now();
    conn.execute(
        "INSERT INTO pending_operations (
            slot_index, operation, started_at, character_id, registry_url,
            tracks_json, completed_tracks, total_tracks
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)",
        params![
            params.slot_index,
            params.operation.as_str(),
            &now,
            params.character_id,
            params.registry_url,
            params.tracks_json,
            params.total_tracks,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_pending_op_progress(
    conn: &Connection,
    op_id: i64,
    completed_tracks: usize,
) -> SqliteResult<usize> {
    conn.execute(
        "UPDATE pending_operations SET completed_tracks = ?1 WHERE id = ?2",
        params![completed_tracks, op_id],
    )
}

pub fn delete_pending_op(conn: &Connection, op_id: i64) -> SqliteResult<usize> {
    conn.execute(
        "DELETE FROM pending_operations WHERE id = ?1",
        params![op_id],
    )
}

pub fn delete_pending_ops_for_slot(conn: &Connection, slot_index: usize) -> SqliteResult<usize> {
    conn.execute(
        "DELETE FROM pending_operations WHERE slot_index = ?1",
        params![slot_index],
    )
}

pub fn get_all_pending_ops(conn: &Connection) -> SqliteResult<Vec<PendingOp>> {
    let mut stmt = conn.prepare(
        "SELECT id, slot_index, operation, started_at, character_id, registry_url,
                tracks_json, completed_tracks, total_tracks
         FROM pending_operations ORDER BY started_at",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(PendingOp {
            id: row.get(0)?,
            slot_index: row.get::<_, i64>(1)? as usize,
            operation: row.get(2)?,
            started_at: row.get(3)?,
            character_id: row.get(4)?,
            registry_url: row.get(5)?,
            tracks_json: row.get(6)?,
            completed_tracks: row.get::<_, i64>(7)? as usize,
            total_tracks: row.get::<_, i64>(8)? as usize,
        })
    })?;

    rows.collect()
}

// --- Helpers ---

fn row_to_device_character(row: &rusqlite::Row) -> SqliteResult<DeviceCharacter> {
    Ok(DeviceCharacter {
        id: row.get(0)?,
        slot_index: row.get::<_, i64>(1)? as usize,
        status: row.get(2)?,
        character_id: row.get(3)?,
        character_name: row.get(4)?,
        description: row.get(5)?,
        preview_image_blob: row.get(6)?,
        preview_image_url: row.get(7)?,
        registry_url: row.get(8)?,
        registry_name: row.get(9)?,
        track_count: row.get::<_, i64>(10)? as usize,
        tracks_json: row.get(11)?,
        nfc_payload: row.get(12)?,
        device_address: row.get::<_, Option<i64>>(13)?.map(|a| a as usize),
        written_at: row.get(14)?,
        updated_at: row.get(15)?,
        content_hash: row.get(16)?,
    })
}

fn chrono_now() -> String {
    // ISO 8601 UTC timestamp
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    // Simple ISO format: we don't pull in chrono crate, just format manually
    let secs_per_day = 86400u64;
    let days = now / secs_per_day;
    let time_of_day = now % secs_per_day;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Days since epoch to date (simplified)
    let (year, month, day) = days_to_date(days);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

fn days_to_date(days: u64) -> (u64, u64, u64) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

// --- Tests ---

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn
    }

    fn test_insert_params() -> InsertCharacterParams {
        InsertCharacterParams {
            slot_index: 42,
            status: CharacterStatus::Ready,
            character_id: "char-001".into(),
            character_name: "Test Character".into(),
            description: Some("A test character".into()),
            preview_image_blob: None,
            preview_image_url: Some("https://example.com/image.png".into()),
            registry_url: Some("https://example.com/registry.json".into()),
            registry_name: Some("Test Registry".into()),
            track_count: 3,
            tracks_json: Some(r#"[{"title":"Track 1"},{"title":"Track 2"},{"title":"Track 3"}]"#.into()),
            nfc_payload: Some("K5042".into()),
            device_address: Some(42),
            content_hash: Some("abc123".into()),
        }
    }

    #[test]
    fn test_schema_creation() {
        let conn = create_test_db();
        let version: i32 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }

    #[test]
    fn test_insert_and_get_character() {
        let conn = create_test_db();
        let params = test_insert_params();

        let id = insert_character(&conn, &params).unwrap();
        assert!(id > 0);

        let char = get_character_by_slot(&conn, 42).unwrap().unwrap();
        assert_eq!(char.character_id, "char-001");
        assert_eq!(char.character_name, "Test Character");
        assert_eq!(char.slot_index, 42);
        assert_eq!(char.status, "ready");
        assert_eq!(char.track_count, 3);
    }

    #[test]
    fn test_get_by_registry_and_id() {
        let conn = create_test_db();
        let params = test_insert_params();
        insert_character(&conn, &params).unwrap();

        let found = get_character_by_registry_and_id(
            &conn,
            "https://example.com/registry.json",
            "char-001",
        )
        .unwrap();
        assert!(found.is_some());

        let not_found =
            get_character_by_registry_and_id(&conn, "https://other.com/registry.json", "char-001")
                .unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_update_status() {
        let conn = create_test_db();
        let params = test_insert_params();
        insert_character(&conn, &params).unwrap();

        update_character_status(&conn, 42, &CharacterStatus::Upgrading).unwrap();

        let char = get_character_by_slot(&conn, 42).unwrap().unwrap();
        assert_eq!(char.status, "upgrading");
    }

    #[test]
    fn test_delete_character() {
        let conn = create_test_db();
        let params = test_insert_params();
        insert_character(&conn, &params).unwrap();

        delete_character(&conn, 42).unwrap();

        let char = get_character_by_slot(&conn, 42).unwrap();
        assert!(char.is_none());
    }

    #[test]
    fn test_get_all_characters() {
        let conn = create_test_db();

        let mut params1 = test_insert_params();
        params1.slot_index = 1;
        params1.character_id = "char-001".into();
        insert_character(&conn, &params1).unwrap();

        let mut params2 = test_insert_params();
        params2.slot_index = 2;
        params2.character_id = "char-002".into();
        insert_character(&conn, &params2).unwrap();

        let all = get_all_characters(&conn).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].slot_index, 1);
        assert_eq!(all[1].slot_index, 2);
    }

    #[test]
    fn test_replace_character() {
        let conn = create_test_db();
        let params = test_insert_params();
        insert_character(&conn, &params).unwrap();

        let mut new_params = test_insert_params();
        new_params.character_name = "Replaced Character".into();
        new_params.character_id = "char-002".into();
        replace_character(&conn, &new_params).unwrap();

        let char = get_character_by_slot(&conn, 42).unwrap().unwrap();
        assert_eq!(char.character_name, "Replaced Character");
        assert_eq!(char.character_id, "char-002");
    }

    #[test]
    fn test_pending_operations() {
        let conn = create_test_db();
        let params = test_insert_params();
        insert_character(&conn, &params).unwrap();

        let op_params = InsertPendingOpParams {
            slot_index: 42,
            operation: PendingOperation::Write,
            character_id: Some("char-001".into()),
            registry_url: Some("https://example.com/registry.json".into()),
            tracks_json: Some(r#"["track1.mp3","track2.mp3"]"#.into()),
            total_tracks: 2,
        };

        let op_id = insert_pending_op(&conn, &op_params).unwrap();
        assert!(op_id > 0);

        // Update progress
        update_pending_op_progress(&conn, op_id, 1).unwrap();

        let ops = get_all_pending_ops(&conn).unwrap();
        assert_eq!(ops.len(), 1);
        assert_eq!(ops[0].completed_tracks, 1);
        assert_eq!(ops[0].total_tracks, 2);

        // Delete
        delete_pending_op(&conn, op_id).unwrap();
        let ops = get_all_pending_ops(&conn).unwrap();
        assert!(ops.is_empty());
    }

    #[test]
    fn test_chrono_now_format() {
        let ts = chrono_now();
        // Should match ISO 8601: YYYY-MM-DDTHH:MM:SSZ
        assert!(ts.len() == 20);
        assert!(ts.ends_with('Z'));
        assert_eq!(&ts[4..5], "-");
        assert_eq!(&ts[7..8], "-");
        assert_eq!(&ts[10..11], "T");
    }
}
