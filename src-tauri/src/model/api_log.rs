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
    /// Present on list responses; true when a body sidecar exists (or legacy entry had bodies).
    #[serde(default)]
    pub has_bodies: bool,
    #[serde(default)]
    pub is_mocked: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct ApiLogSummary {
    pub id: String,
    pub timestamp: String,
    pub method: String,
    pub url: String,
    pub host: String,
    pub path: String,
    pub status_code: Option<u16>,
    pub has_bodies: bool,
    #[serde(default)]
    pub is_mocked: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct ApiLogSearchHit {
    pub summary: ApiLogSummary,
    pub snippet: Option<String>,
    /// True when this hit came from a cold body scan (unlearned param).
    #[serde(default)]
    pub from_scan: bool,
}

impl ApiLogEntry {
    pub fn summary(&self) -> ApiLogSummary {
        ApiLogSummary {
            id: self.id.clone(),
            timestamp: self.timestamp.clone(),
            method: self.method.clone(),
            url: self.url.clone(),
            host: self.host.clone(),
            path: self.path.clone(),
            status_code: self.status_code,
            has_bodies: self.has_bodies
                || self.request_body.is_some()
                || self.response_body.is_some()
                || self.request_headers.is_some()
                || self.response_headers.is_some(),
            is_mocked: self.is_mocked,
        }
    }
}

impl ApiLogSummary {
    pub fn to_list_entry(&self) -> ApiLogEntry {
        ApiLogEntry {
            id: self.id.clone(),
            timestamp: self.timestamp.clone(),
            method: self.method.clone(),
            url: self.url.clone(),
            host: self.host.clone(),
            path: self.path.clone(),
            status_code: self.status_code,
            request_headers: None,
            request_body: None,
            response_headers: None,
            response_body: None,
            has_bodies: self.has_bodies,
            is_mocked: self.is_mocked,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ApiLogBodyFile {
    pub request_headers: Option<HashMap<String, String>>,
    pub request_body: Option<String>,
    pub response_headers: Option<HashMap<String, String>>,
    pub response_body: Option<String>,
}
