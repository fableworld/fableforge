#[derive(Debug, thiserror::Error)]
pub enum FabaError {
    #[error("Device is not detected")]
    NotDetected,
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