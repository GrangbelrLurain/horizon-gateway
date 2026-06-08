use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct ApiLogEntry {
    pub id: String,
    pub timestamp: String,
    pub method: String,
    pub url: String,
    pub host: String,
    pub path: String,
    pub status_code: Option<u16>,
    pub request_headers: Option<HashMap<String, String>>,
    pub request_body: Option<String>,
    pub response_headers: Option<HashMap<String, String>>,
    pub response_body: Option<String>,
}
