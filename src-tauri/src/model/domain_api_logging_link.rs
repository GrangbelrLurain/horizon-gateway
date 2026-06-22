use serde::{Deserialize, Serialize};

/// 도메인별 API 로깅 설정 링크.
/// `domain_id`에 해당하는 도메인의 API 트래픽 로깅 여부와 바디 저장 여부를 제어.
/// `schema_url`: OpenAPI/Swagger JSON을 다운로드할 수 있는 URL (선택).
#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DomainApiLoggingLink {
    pub domain_id: u32,
    #[serde(default = "default_true")]
    pub logging_enabled: bool,
    #[serde(default)]
    pub body_enabled: bool,
    /// OpenAPI/Swagger 스키마 다운로드 URL (예: <https://api.example.com/swagger.json>).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schema_url: Option<String>,
}

fn default_true() -> bool {
    true
}
