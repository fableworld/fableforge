use std::path::PathBuf;
use std::env;
use std::fs;
use std::io::Write;
use crate::core::error::FabaError;

/// Downloads a file from a URL to a temporary location.
/// Returns the path to the temporary file.
pub async fn download_to_temp_file(url: &str) -> Result<PathBuf, FabaError> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| FabaError::Custom(format!("Failed to download file: {}", e)))?;

    if !response.status().is_success() {
        return Err(FabaError::Custom(format!(
            "Download failed with status: {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| FabaError::Custom(format!("Failed to read response bytes: {}", e)))?;

    let file_name = format!(
        "faba_download_{}.tmp",
        chrono::Utc::now().timestamp_millis()
    );
    let temp_path = env::temp_dir().join(file_name);

    let mut file = fs::File::create(&temp_path)
        .map_err(|e| FabaError::Custom(format!("Failed to create temp file: {}", e)))?;

    file.write_all(&bytes)
        .map_err(|e| FabaError::Custom(format!("Failed to write to temp file: {}", e)))?;

    Ok(temp_path)
}

/// Downloads image bytes from a URL or reads from a local path.
pub async fn download_image(url: &str) -> Result<Vec<u8>, FabaError> {
    if url.starts_with("http://") || url.starts_with("https://") {
        let response = reqwest::get(url)
            .await
            .map_err(|e| FabaError::Custom(format!("Failed to download image: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(FabaError::Custom(format!("Image download failed with status: {}", response.status())));
        }

        let bytes = response.bytes()
            .await
            .map_err(|e| FabaError::Custom(format!("Failed to read image bytes: {}", e)))?;
        
        Ok(bytes.to_vec())
    } else {
        // Treat as local file path
        std::fs::read(url).map_err(|e| FabaError::Custom(format!("Failed to read image: {}", e)))
    }
}
