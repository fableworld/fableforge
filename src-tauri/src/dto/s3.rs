use serde::{Deserialize, Serialize};

/// DTO for S3 configuration sent between Rust ↔ Frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3ConfigDto {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub region: String,
    pub bucket: String,
    pub prefix: Option<String>,
    pub is_public: bool,
    pub collection_id: String,
}

/// DTO for S3 connection test result.
#[derive(Debug, Serialize)]
pub struct S3ConnectionResultDto {
    pub success: bool,
    pub message: String,
    pub object_count: Option<i64>,
}

impl From<crate::s3::config::S3Config> for S3ConfigDto {
    fn from(c: crate::s3::config::S3Config) -> Self {
        S3ConfigDto {
            id: c.id,
            name: c.name,
            endpoint: c.endpoint,
            region: c.region,
            bucket: c.bucket,
            prefix: c.prefix,
            is_public: c.is_public,
            collection_id: c.collection_id,
        }
    }
}

impl From<S3ConfigDto> for crate::s3::config::S3Config {
    fn from(d: S3ConfigDto) -> Self {
        crate::s3::config::S3Config {
            id: d.id,
            name: d.name,
            endpoint: d.endpoint,
            region: d.region,
            bucket: d.bucket,
            prefix: d.prefix,
            is_public: d.is_public,
            collection_id: d.collection_id,
        }
    }
}

impl From<crate::s3::client::S3ConnectionInfo> for S3ConnectionResultDto {
    fn from(info: crate::s3::client::S3ConnectionInfo) -> Self {
        S3ConnectionResultDto {
            success: info.success,
            message: info.message,
            object_count: info.object_count,
        }
    }
}
