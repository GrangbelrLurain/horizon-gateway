use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct LocalRoute {
    pub id: u32,
    /// Registered domain id (FK into domains.json).
    #[serde(default)]
    pub domain_id: u32,
    /// Hostname to match (e.g. api.example.com), cached from the linked domain URL.
    pub domain: String,
    /// Local target host (e.g. 127.0.0.1)
    pub target_host: String,
    /// Local target port
    pub target_port: u16,
    pub enabled: bool,
}
