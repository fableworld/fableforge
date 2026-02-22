use serde::{Deserialize, Serialize};

/// S3-compatible storage configuration for a collection.
///
/// Each config links one local collection to a remote bucket/prefix pair.
/// Multiple collections can share the same bucket with different prefixes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Config {
    /// Unique identifier for this config (UUID v4)
    pub id: String,
    /// Human-friendly display name (e.g. "My Backblaze Bucket")
    pub name: String,
    /// S3-compatible endpoint URL (e.g. "https://s3.us-west-001.backblazeb2.com")
    pub endpoint: String,
    /// Region (e.g. "us-west-001", "auto" for Cloudflare R2)
    pub region: String,
    /// Bucket name
    pub bucket: String,
    /// Optional prefix path within the bucket (e.g. "fableforge/happygang")
    /// If None, files are stored at the bucket root
    pub prefix: Option<String>,
    /// Whether the bucket is publicly readable
    pub is_public: bool,
    /// ID of the local collection linked to this S3 config
    pub collection_id: String,
}

impl S3Config {
    /// Returns the full S3 key for a given relative path within this config's prefix.
    /// E.g. with prefix "fableforge/happygang" and path "index.json",
    /// returns "fableforge/happygang/index.json".
    pub fn full_key(&self, path: &str) -> String {
        match &self.prefix {
            Some(prefix) => {
                let trimmed = prefix.trim_end_matches('/');
                format!("{}/{}", trimmed, path)
            }
            None => path.to_string(),
        }
    }

    /// Computes the public URL for the index.json file.
    /// Returns None if the bucket is not public.
    pub fn public_index_url(&self) -> Option<String> {
        if !self.is_public {
            return None;
        }

        let endpoint = self.endpoint.trim_end_matches('/');
        let key = self.full_key("index.json");

        // Use path-style URL: endpoint/bucket/key
        Some(format!("{}/{}/{}", endpoint, self.bucket, key))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_config(prefix: Option<&str>, is_public: bool) -> S3Config {
        S3Config {
            id: "test-id".to_string(),
            name: "Test".to_string(),
            endpoint: "https://s3.example.com".to_string(),
            region: "us-east-1".to_string(),
            bucket: "my-bucket".to_string(),
            prefix: prefix.map(String::from),
            is_public,
            collection_id: "col-1".to_string(),
        }
    }

    #[test]
    fn full_key_with_prefix() {
        let config = make_config(Some("fableforge/happygang"), false);
        assert_eq!(config.full_key("index.json"), "fableforge/happygang/index.json");
    }

    #[test]
    fn full_key_with_trailing_slash_prefix() {
        let config = make_config(Some("fableforge/happygang/"), false);
        assert_eq!(config.full_key("index.json"), "fableforge/happygang/index.json");
    }

    #[test]
    fn full_key_without_prefix() {
        let config = make_config(None, false);
        assert_eq!(config.full_key("index.json"), "index.json");
    }

    #[test]
    fn public_url_when_public() {
        let config = make_config(Some("fableforge/happygang"), true);
        assert_eq!(
            config.public_index_url(),
            Some("https://s3.example.com/my-bucket/fableforge/happygang/index.json".to_string())
        );
    }

    #[test]
    fn public_url_when_not_public() {
        let config = make_config(Some("fableforge/happygang"), false);
        assert_eq!(config.public_index_url(), None);
    }

    #[test]
    fn public_url_without_prefix() {
        let config = make_config(None, true);
        assert_eq!(
            config.public_index_url(),
            Some("https://s3.example.com/my-bucket/index.json".to_string())
        );
    }
}
