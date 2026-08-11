use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Localhost TCP address for the headless serve backend (Phase 1 IPC).
/// Named pipes on Windows can replace this in a later phase.
pub const SERVE_TCP_ADDR: &str = "127.0.0.1:17345";

/// One-way event stream from serve → GUI (NDJSON over TCP).
pub const SERVE_EVENT_ADDR: &str = "127.0.0.1:17346";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServeRequest {
    pub id: String,
    pub command: String,
    #[serde(default)]
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServeResponse {
    pub id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServeErrorResponse {
    pub ok: bool,
    pub error: String,
}

/// NDJSON line on the serve event stream (mirrors Tauri `emit(event, payload)`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServeEvent {
    pub event: String,
    pub payload: Value,
}

impl ServeErrorResponse {
    pub fn new(error: impl Into<String>) -> Self {
        Self {
            ok: false,
            error: error.into(),
        }
    }
}

impl ServeResponse {
    pub fn success(id: String, data: Value) -> Self {
        Self {
            id,
            ok: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn failure(id: String, error: impl Into<String>) -> Self {
        Self {
            id,
            ok: false,
            data: None,
            error: Some(error.into()),
        }
    }
}
