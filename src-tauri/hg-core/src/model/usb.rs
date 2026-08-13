use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AdbStatus {
    pub found: bool,
    pub path: Option<String>,
    pub devices: Vec<String>,
}
