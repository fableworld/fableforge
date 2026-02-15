#[derive(Debug, thiserror::Error)]
pub enum FabaError {
    #[error("Device is not detected")]
    NotDetected,
    #[error("Error during communication with device")]
    Communication,
    #[error("Database error: {0}")]
    Database(String),
    #[error("Slot {0} has inconsistent state: files found on device but not tracked by FableForge. Please clean the slot manually before proceeding.")]
    SlotInconsistent(usize),
    #[error("Slot {0} is already occupied by a different character")]
    SlotOccupied(usize),
    #[error("{0}")]
    Custom(String),
}

impl From<rusqlite::Error> for FabaError {
    fn from(e: rusqlite::Error) -> Self {
        FabaError::Database(e.to_string())
    }
}

// we must manually implement serde::Serialize
impl serde::Serialize for FabaError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}