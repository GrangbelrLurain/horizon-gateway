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

fn default_exported_at() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn default_schema_version() -> u32 {
    SETTINGS_EXPORT_VERSION
}

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SettingsExport {
    /// Bundle schema version (`.hg.json`). Same as `version` for v3+.
    #[serde(default = "default_schema_version", alias = "schema_version")]
    pub schema_version: u32,
    #[serde(default = "default_schema_version")]
    pub version: u32,
    #[serde(default = "default_app")]
    pub app: String,
    #[serde(default = "default_exported_at", alias = "exported_at")]
    pub exported_at: String,
    #[serde(default)]
    pub domains: Vec<Domain>,
    #[serde(default)]
    pub groups: Vec<DomainGroup>,
    #[serde(default, alias = "domain_group_links")]
    pub domain_group_links: Vec<DomainGroupLink>,
    #[serde(default, alias = "local_routes")]
    pub local_routes: Vec<LocalRoute>,
    #[serde(default, alias = "proxy_settings")]
    pub proxy_settings: ProxySettings,
    /// Monitor settings per domain (`check_enabled`, interval). Status logs are excluded.
    #[serde(
        alias = "domain_status",
        alias = "domain_monitor",
        default = "default_domain_monitor"
    )]
    pub domain_monitor: Vec<DomainMonitorExport>,
    #[serde(default = "default_scenarios")]
    pub scenarios: Vec<Scenario>,
    #[serde(default = "default_mock_rules", alias = "mock_rules")]
    pub mock_rules: Vec<MockRule>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_payload_without_version() {
        let json = r#"{"domains": [], "groups": []}"#;
        let export: SettingsExport = serde_json::from_str(json).unwrap();
        assert_eq!(export.version, SETTINGS_EXPORT_VERSION);
        assert_eq!(export.schema_version, SETTINGS_EXPORT_VERSION);
        assert_eq!(export.app, HG_APP_NAME);
        assert!(export.domains.is_empty());
        assert!(export.groups.is_empty());
    }

    #[test]
    fn deserializes_payload_with_only_schema_version_snake_case() {
        let json = r#"{"schema_version": 2, "domains": [], "groups": []}"#;
        let export: SettingsExport = serde_json::from_str(json).unwrap();
        assert_eq!(export.schema_version, 2);
        assert_eq!(export.version, SETTINGS_EXPORT_VERSION);
    }

    #[test]
    fn deserializes_payload_with_camel_case_and_all_fields() {
        let json = r#"{
            "schemaVersion": 3,
            "version": 3,
            "app": "horizon-gateway",
            "exportedAt": "2026-08-18T00:00:00Z",
            "domains": [],
            "groups": [],
            "domainGroupLinks": [],
            "localRoutes": [],
            "proxySettings": {
                "proxyPort": 8888,
                "corsRewriteEnabled": true,
                "connectTimeoutSecs": 15,
                "upstreamTimeoutSecs": 30,
                "tlsBypassHosts": [],
                "httpsDecryptHosts": []
            },
            "domainMonitor": [],
            "scenarios": [],
            "mockRules": []
        }"#;
        let export: SettingsExport = serde_json::from_str(json).unwrap();
        assert_eq!(export.version, 3);
        assert_eq!(export.schema_version, 3);
    }
}
