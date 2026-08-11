use serde::{Deserialize, Serialize};

/// Domain–Monitor 링크. 체크 대상 도메인 + 옵션 (체크 결과 아님)
#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DomainMonitorLink {
    pub domain_id: u32,
    #[serde(default = "default_check_enabled")]
    pub check_enabled: bool,
    #[serde(default = "default_interval")]
    pub interval_secs: u32,
}

fn default_check_enabled() -> bool {
    true
}

fn default_interval() -> u32 {
    120
}

/// `DomainMonitorLink` + url (FE 표시용)
#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DomainMonitorWithUrl {
    pub domain_id: u32,
    pub url: String,
    pub check_enabled: bool,
    pub interval_secs: u32,
}
