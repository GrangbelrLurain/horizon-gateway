//! Full app settings export/import payload (JSON / `.hg.json`).
//! Status logs (`DomainStatusLog`) are excluded - they are runtime data, not settings.
//! Root CA, tokens, and traffic logs are never included.

use crate::model::domain::Domain;
use crate::model::domain_group::DomainGroup;
use crate::model::domain_group_link::DomainGroupLink;
use crate::model::local_route::LocalRoute;
use crate::model::mock_rule::MockRule;
use crate::model::proxy_settings::ProxySettings;
use crate::model::scenario::Scenario;
use serde::{Deserialize, Serialize};

pub const SETTINGS_EXPORT_VERSION: u32 = 3;
pub const HG_APP_NAME: &str = "horizon-gateway";

/// Domain monitor settings (`check_enabled`, interval). Keyed by URL for import matching.
#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DomainMonitorExport {
    pub url: String,
    pub check_enabled: bool,
    pub interval_secs: u32,
}

fn default_domain_monitor() -> Vec<DomainMonitorExport> {
    Vec::new()
}

fn default_scenarios() -> Vec<Scenario> {
    Vec::new()
}

fn default_mock_rules() -> Vec<MockRule> {
    Vec::new()
}

fn default_app() -> String {
    HG_APP_NAME.to_string()
}

#[derive(Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SettingsExport {
    /// Bundle schema version (`.hg.json`). Same as `version` for v3+.
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    pub version: u32,
    #[serde(default = "default_app")]
    pub app: String,
    pub exported_at: String,
    pub domains: Vec<Domain>,
    pub groups: Vec<DomainGroup>,
    pub domain_group_links: Vec<DomainGroupLink>,
    pub local_routes: Vec<LocalRoute>,
    pub proxy_settings: ProxySettings,
    /// Monitor settings per domain (`check_enabled`, interval). Status logs are excluded.
    #[serde(alias = "domain_status", default = "default_domain_monitor")]
    pub domain_monitor: Vec<DomainMonitorExport>,
    #[serde(default = "default_scenarios")]
    pub scenarios: Vec<Scenario>,
    #[serde(default = "default_mock_rules")]
    pub mock_rules: Vec<MockRule>,
}

fn default_schema_version() -> u32 {
    SETTINGS_EXPORT_VERSION
}
