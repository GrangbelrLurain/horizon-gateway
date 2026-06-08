use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 체크 결과 구조. 최신은 `메모리(last_checks)`, 과거는 logs/{date}.json
#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DomainStatusLog {
    pub url: String,
    pub status: String,
    pub level: String,
    pub latency: u32,
    pub ok: bool,
    pub group: String,
    pub timestamp: DateTime<Utc>,
    pub error_message: Option<String>,
}
