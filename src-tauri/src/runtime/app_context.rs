use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::service::api_log_service::ApiLogService;
use crate::service::api_logging_settings_service::ApiLoggingSettingsService;
use crate::service::ca_service::CaService;
use crate::service::crypto_preset_service::CryptoPresetService;
use crate::service::domain_group_link_service::DomainGroupLinkService;
use crate::service::domain_group_service::DomainGroupService;
use crate::service::domain_monitor_service::DomainMonitorService;
use crate::service::domain_service::DomainService;
use crate::service::inspector_service::InspectorService;
use crate::service::json_schema_registry_service::JsonSchemaRegistryService;
use crate::service::local_route_service::LocalRouteService;
use crate::service::mocking_service::MockingService;
use crate::service::pipeline_library_service::PipelineLibraryService;
use crate::service::proxy_settings_service::ProxySettingsService;
use crate::service::tunnel_service::TunnelService;
use crate::service::usb_service::UsbService;

use super::paths::resolve_app_data_dir;

pub struct AppContext {
    pub app_data_dir: PathBuf,
    pub ca_service: Arc<CaService>,
    pub domain_service: DomainService,
    pub group_service: DomainGroupService,
    pub link_service: DomainGroupLinkService,
    pub monitor_service: DomainMonitorService,
    pub local_route_service: Arc<LocalRouteService>,
    pub proxy_settings_service: ProxySettingsService,
    pub api_logging_service: ApiLoggingSettingsService,
    pub api_log_service: ApiLogService,
    pub mocking_service: Arc<MockingService>,
    pub inspector_service: InspectorService,
    pub tunnel_service: Arc<TunnelService>,
    pub usb_service: Arc<UsbService>,
    pub pipeline_library_service: Arc<PipelineLibraryService>,
    pub json_schema_registry_service: Arc<JsonSchemaRegistryService>,
    pub crypto_preset_service: Arc<CryptoPresetService>,
}

pub fn bootstrap_app_context() -> Result<AppContext, String> {
    let app_data_dir = resolve_app_data_dir()?;

    // Migration from Watchtower (com.lurain.watchtower) to Horizon Gateway (com.lurain.horizon-gateway)
    // Robust check: check if domains.json does not exist in new location, but does in old location
    let old_domains_path = dirs::data_dir()
        .map(|base| base.join("com.lurain.watchtower").join("domains.json"));
    let new_domains_path = app_data_dir.join("domains.json");

    if !new_domains_path.exists() {
        if let Some(old_path) = old_domains_path {
            if old_path.exists() {
                if let Some(old_dir) = dirs::data_dir().map(|base| base.join("com.lurain.watchtower")) {
                    if !app_data_dir.exists() {
                        let _ = fs::create_dir_all(&app_data_dir);
                    }
                    if let Err(e) = copy_dir_all(&old_dir, &app_data_dir) {
                        eprintln!("Failed to copy app data directory: {e}");
                    } else {
                        println!("Successfully migrated app data from Watchtower to Horizon Gateway.");
                    }
                }
            }
        }
    }

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).map_err(|e| format!("failed to create app data dir: {e}"))?;
    }

    crate::storage::migration::run_all(&app_data_dir);

    let storage_path = app_data_dir.join("domains.json");
    let groups_storage_path = app_data_dir.join("groups.json");
    let links_storage_path = app_data_dir.join("domain_group_links.json");
    let logs_dir = app_data_dir.join("logs");
    let monitor_links_path = app_data_dir.join("domain_monitor_links.json");
    let local_routes_path = app_data_dir.join("domain_local_routes.json");
    let proxy_settings_path = app_data_dir.join("proxy_settings.json");
    let api_logging_path = app_data_dir.join("domain_api_logging_links.json");
    let scenarios_path = app_data_dir.join("scenarios.json");
    let mock_rules_path = app_data_dir.join("mock_rules.json");
    let mocking_settings_path = app_data_dir.join("mocking_settings.json");
    let inspector_path = app_data_dir.join("inspector_annotations.json");
    let injection_domains_path = app_data_dir.join("injection_domains.json");
    let inspector_settings_path = app_data_dir.join("inspector_settings.json");
    let pipelines_path = app_data_dir.join("pipelines.json");
    let json_schemas_path = app_data_dir.join("json_schemas.json");
    let crypto_presets_path = app_data_dir.join("crypto_presets.json");

    let ca_service = Arc::new(
        CaService::new(&app_data_dir).map_err(|e| format!("failed to init ca service: {e}"))?,
    );
    let domain_service = DomainService::new(storage_path);
    let group_service = DomainGroupService::new(groups_storage_path);
    let link_service = DomainGroupLinkService::new(links_storage_path);
    let monitor_service = DomainMonitorService::new(logs_dir, monitor_links_path);
    let local_route_service = Arc::new(LocalRouteService::new(local_routes_path));
    let proxy_settings_service = ProxySettingsService::new(proxy_settings_path);
    let api_logging_service = ApiLoggingSettingsService::new(api_logging_path);
    let api_log_service = ApiLogService::new(app_data_dir.clone());
    let mocking_service = Arc::new(MockingService::new(
        scenarios_path.clone(),
        mock_rules_path.clone(),
        mocking_settings_path.clone(),
    ));
    let inspector_service = InspectorService::new(
        inspector_path,
        injection_domains_path,
        inspector_settings_path,
    );
    let tunnel_service = Arc::new(TunnelService::new());
    let usb_service = Arc::new(UsbService::new());
    let pipeline_library_service = Arc::new(PipelineLibraryService::new(pipelines_path));
    let json_schema_registry_service =
        Arc::new(JsonSchemaRegistryService::new(json_schemas_path));
    let crypto_preset_service = Arc::new(CryptoPresetService::new(crypto_presets_path));

    crate::service::local_proxy::set_mocking_enabled(mocking_service.get_settings().enabled);
    crate::service::local_proxy::set_inspector_enabled(inspector_service.get_settings().enabled);

    monitor_service.sync_with_domains(&domain_service.get_all());
    api_logging_service.refresh_map(&domain_service.get_all());
    local_route_service.sync_with_domains(&domain_service.get_all());

    Ok(AppContext {
        app_data_dir,
        ca_service,
        domain_service,
        group_service,
        link_service,
        monitor_service,
        local_route_service,
        proxy_settings_service,
        api_logging_service,
        api_log_service,
        mocking_service,
        inspector_service,
        tunnel_service,
        usb_service,
        pipeline_library_service,
        json_schema_registry_service,
        crypto_preset_service,
    })
}


fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bootstrap_app_context_smoke() {
        let temp = tempfile::tempdir().expect("tempdir");
        // Override via direct construction is not exposed; smoke-test default path resolves.
        let dir = super::super::paths::resolve_app_data_dir().expect("resolve");
        assert!(dir.ends_with("com.lurain.horizon-gateway"));
        let _ = temp;
    }
}
