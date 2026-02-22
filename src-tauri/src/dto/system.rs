use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfoDto {
    pub os: String,
    pub arch: String,
    pub tauri_version: String,
    pub app_version: String,
    pub data_dir: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticResultDto {
    pub status: String,
    pub message: String,
}
