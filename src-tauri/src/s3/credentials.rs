use keyring::Entry;

use crate::core::error::FabaError;

const SERVICE_NAME: &str = "fableforge-s3";

/// Builds the keyring key for an access key.
fn access_key_id(config_id: &str) -> String {
    format!("{}-access-key", config_id)
}

/// Builds the keyring key for a secret key.
fn secret_key_id(config_id: &str) -> String {
    format!("{}-secret-key", config_id)
}



/// Retrieve S3 credentials from the OS keyring.
/// Returns (access_key, secret_key).
pub fn get_credentials(config_id: &str) -> Result<(String, String), FabaError> {
    let ak_entry = Entry::new(SERVICE_NAME, &access_key_id(config_id))
        .map_err(|e| FabaError::Credential(format!("Secure storage access error (access key): {}", e)))?;
    let access_key = ak_entry
        .get_password()
        .map_err(|e| FabaError::Credential(format!("Failed to retrieve access key: {}. Are credentials initialized?", e)))?;

    let sk_entry = Entry::new(SERVICE_NAME, &secret_key_id(config_id))
        .map_err(|e| FabaError::Credential(format!("Secure storage access error (secret key): {}", e)))?;
    let secret_key = sk_entry
        .get_password()
        .map_err(|e| FabaError::Credential(format!("Failed to retrieve secret key: {}. Are credentials initialized?", e)))?;

    Ok((access_key, secret_key))
}

pub fn set_access_key(config_id: &str, access_key: &str) -> Result<(), FabaError> {
    let entry = Entry::new(SERVICE_NAME, &access_key_id(config_id))
        .map_err(|e| FabaError::Credential(format!("Failed to create keyring entry: {}", e)))?;
    entry
        .set_password(access_key)
        .map_err(|e| FabaError::Credential(format!("Failed to store access key: {}", e)))
}

pub fn set_secret_key(config_id: &str, secret_key: &str) -> Result<(), FabaError> {
    let entry = Entry::new(SERVICE_NAME, &secret_key_id(config_id))
        .map_err(|e| FabaError::Credential(format!("Failed to create keyring entry: {}", e)))?;
    entry
        .set_password(secret_key)
        .map_err(|e| FabaError::Credential(format!("Failed to store secret key: {}", e)))
}

/// Delete S3 credentials from the OS keyring.
/// Ignores errors if the credentials don't exist.
pub fn delete_credentials(config_id: &str) -> Result<(), FabaError> {
    if let Ok(ak_entry) = Entry::new(SERVICE_NAME, &access_key_id(config_id)) {
        let _ = ak_entry.delete_credential();
    }
    if let Ok(sk_entry) = Entry::new(SERVICE_NAME, &secret_key_id(config_id)) {
        let _ = sk_entry.delete_credential();
    }
    Ok(())
}
