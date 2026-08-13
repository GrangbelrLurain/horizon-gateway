use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TransparentProxyStatus {
    pub running: bool,
    pub target_port: u16,
    pub active_connections: u32,
    pub error_message: Option<String>,
    #[serde(default)]
    pub experimental: bool,
    #[serde(default)]
    pub process_allowlist: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct OsAppEntry {
    pub name: String,
    pub pids: Vec<u32>,
    pub instance_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ApplyTransparentProxyAppsPayload {
    pub process_names: Vec<String>,
    pub port: Option<u16>,
}
