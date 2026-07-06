use crate::model::api_response::ApiResponse;
use crate::model::settings_export::{SettingsExport, SETTINGS_EXPORT_VERSION};
use crate::service::ca_service::CaService;
use crate::service::domain_group_link_service::DomainGroupLinkService;
use crate::service::domain_group_service::DomainGroupService;
use crate::service::domain_service::DomainService;
use crate::service::domain_monitor_service::DomainMonitorService;
use crate::service::local_route_service::LocalRouteService;
use crate::service::proxy_settings_service::ProxySettingsService;
use std::sync::Arc;
use tauri_plugin_dialog::DialogExt;

pub const SAVE_ROOT_CA_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "save_root_ca",
    description: "Root CA 인증서를 파일로 저장합니다 (저장 다이얼로그 피요).",
    payload_example: "{}",
};

#[tauri::command]
#[specta::specta]
pub async fn save_root_ca(
    app: tauri::AppHandle,
    ca_service: tauri::State<'_, Arc<CaService>>,
) -> Result<ApiResponse<String>, String> {
    let pem = ca_service.ca_cert_pem();

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_file_name("root.crt")
        .add_filter("Certificate", &["crt"])
        .save_file(|path| {
            let _ = tx.send(path);
        });

    let file_path = rx.await.map_err(|e| e.to_string())?;

    if let Some(path) = file_path {
        let path_buf = path.as_path().ok_or("Invalid path")?;
        std::fs::write(path_buf, pem).map_err(|e| e.to_string())?;
        Ok(ApiResponse {
            message: "Root CA saved successfully".to_string(),
            success: true,
            data: "Saved".to_string(),
        })
    } else {
        Err("Save cancelled".to_string())
    }
}

pub const EXPORT_ALL_SETTINGS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "export_all_settings",
    description: "도메인, 그룹, 라우팅 등 앱의 모든 설정을 JSON으로 내보냅니다.",
    payload_example: "{}",
};

#[tauri::command]
#[specta::specta]
pub fn export_all_settings(
    domain_service: tauri::State<'_, DomainService>,
    group_service: tauri::State<'_, DomainGroupService>,
    link_service: tauri::State<'_, DomainGroupLinkService>,
    route_service: tauri::State<'_, Arc<LocalRouteService>>,
    proxy_settings_service: tauri::State<'_, ProxySettingsService>,
    monitor_service: tauri::State<'_, DomainMonitorService>,
) -> Result<ApiResponse<SettingsExport>, String> {
    let exported_at = chrono::Utc::now().to_rfc3339();
    let payload = SettingsExport {
        version: SETTINGS_EXPORT_VERSION,
        exported_at,
        domains: domain_service.get_all(),
        groups: group_service.get_all(),
        domain_group_links: link_service.get_all_links(),
        local_routes: route_service.get_all(),
        proxy_settings: proxy_settings_service.get(),
        domain_monitor: monitor_service.get_domain_monitor_for_export(&domain_service),
    };
    Ok(ApiResponse {
        message: "Export ready".to_string(),
        success: true,
        data: payload,
    })
}

pub const IMPORT_ALL_SETTINGS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "import_all_settings",
    description: "JSON 설정 파일을 일괄 임포트하여 모든 설정을 복원합니다.",
    payload_example: r#"{"version": 1, "domains": [], "groups": [], "domainGroupLinks": [], "localRoutes": [], "proxySettings": {}}"#,
};

#[tauri::command]
#[specta::specta]
pub fn import_all_settings(
    payload: SettingsExport,
    domain_service: tauri::State<'_, DomainService>,
    group_service: tauri::State<'_, DomainGroupService>,
    link_service: tauri::State<'_, DomainGroupLinkService>,
    route_service: tauri::State<'_, Arc<LocalRouteService>>,
    proxy_settings_service: tauri::State<'_, ProxySettingsService>,
    monitor_service: tauri::State<'_, DomainMonitorService>,
) -> Result<ApiResponse<bool>, String> {
    if payload.version > SETTINGS_EXPORT_VERSION {
        return Err(format!(
            "Unsupported export version {} (max {})",
            payload.version, SETTINGS_EXPORT_VERSION
        ));
    }
    domain_service.import_from_json(payload.domains);
    monitor_service.sync_with_domains(&domain_service.get_all());
    monitor_service.import_domain_monitor(&payload.domain_monitor, &domain_service);
    group_service.replace_all(payload.groups);
    link_service.replace_all(payload.domain_group_links);
    route_service.replace_all(payload.local_routes);
    proxy_settings_service.replace_all(payload.proxy_settings);
    Ok(ApiResponse {
        message: "Import completed".to_string(),
        success: true,
        data: true,
    })
}
