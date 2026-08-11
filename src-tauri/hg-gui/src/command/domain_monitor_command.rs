use crate::model::api_response::ApiResponse;
use crate::model::domain_monitor_link::DomainMonitorWithUrl;
use crate::model::domain_status_log::DomainStatusLog;
use crate::service::domain_group_link_service::DomainGroupLinkService;
use crate::service::domain_group_service::DomainGroupService;
use crate::service::domain_service::DomainService;
use crate::service::domain_monitor_service::DomainMonitorService;
use crate::service::proxy_settings_service::ProxySettingsService;

pub const GET_LATEST_STATUS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_latest_status",
    description: "모니터링 대상 도메인들의 최신 상태를 조회합니다.",
    payload_example: "{}",
    category: "monitor",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_latest_status(
    monitor_service: tauri::State<'_, DomainMonitorService>,
) -> Result<ApiResponse<Vec<DomainStatusLog>>, String> {
    get_latest_status_svc(&monitor_service)
}

pub fn get_latest_status_svc(monitor_service: &DomainMonitorService) -> Result<ApiResponse<Vec<DomainStatusLog>>, String> {
    let list = monitor_service.get_last_status();
    Ok(ApiResponse {
        message: format!("{}개의 최신 상태 조회 완료", list.len()),
        success: true,
        data: list,
    })
}

pub const CHECK_DOMAIN_STATUS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "check_domain_status",
    description: "도메인들의 HTTP 상태를 직접 체크하여 최신 상태를 리턴합니다.",
    payload_example: "{}",
    category: "monitor",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub async fn check_domain_status(
    domain_service: tauri::State<'_, DomainService>,
    group_service: tauri::State<'_, DomainGroupService>,
    link_service: tauri::State<'_, DomainGroupLinkService>,
    monitor_service: tauri::State<'_, DomainMonitorService>,
    proxy_settings_service: tauri::State<'_, ProxySettingsService>,
) -> Result<ApiResponse<Vec<DomainStatusLog>>, String> {
    check_domain_status_svc(&domain_service, &group_service, &link_service, &monitor_service, &proxy_settings_service).await
}

pub async fn check_domain_status_svc(domain_service: &DomainService, group_service: &DomainGroupService, link_service: &DomainGroupLinkService, monitor_service: &DomainMonitorService, proxy_settings_service: &ProxySettingsService) -> Result<ApiResponse<Vec<DomainStatusLog>>, String> {
    let results = monitor_service
        .check_domains(
            &domain_service,
            &group_service,
            &link_service,
            &proxy_settings_service,
        )
        .await;
   Ok(ApiResponse {
        message: format!("{}개의 도메인 상태 체크 완료", results.len()),
        success: true,
        data: results,
    })
}

pub const GET_DOMAIN_MONITOR_LIST_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_domain_monitor_list",
    description: "모니터링 설정이 적용된 도메인 목록과 상태를 조회합니다.",
    payload_example: "{}",
    category: "monitor",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_domain_monitor_list(
    domain_service: tauri::State<'_, DomainService>,
    monitor_service: tauri::State<'_, DomainMonitorService>,
) -> Result<ApiResponse<Vec<DomainMonitorWithUrl>>, String> {
    get_domain_monitor_list_svc(&domain_service, &monitor_service)
}

pub fn get_domain_monitor_list_svc(domain_service: &DomainService, monitor_service: &DomainMonitorService) -> Result<ApiResponse<Vec<DomainMonitorWithUrl>>, String> {
    let list = monitor_service.get_domain_monitor_list(&domain_service);
    Ok(ApiResponse {
        message: format!("{}개 도메인 monitor 설정 조회", list.len()),
        success: true,
        data: list,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SetDomainMonitorCheckEnabledPayload {
    pub domain_ids: Vec<u32>,
    pub enabled: bool,
}

pub const SET_DOMAIN_MONITOR_CHECK_ENABLED_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "set_domain_monitor_check_enabled",
    description: "특정 도메인들의 상태 모니터링 활성화 여부를 설정합니다.",
    payload_example: r#"{"domainIds": [1, 2], "enabled": true}"#,
    category: "monitor",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn set_domain_monitor_check_enabled(
    payload: SetDomainMonitorCheckEnabledPayload,
    monitor_service: tauri::State<'_, DomainMonitorService>,
) -> Result<ApiResponse<bool>, String> {
    set_domain_monitor_check_enabled_svc(payload, &monitor_service)
}

pub fn set_domain_monitor_check_enabled_svc(payload: SetDomainMonitorCheckEnabledPayload, monitor_service: &DomainMonitorService) -> Result<ApiResponse<bool>, String> {
    monitor_service.set_domain_monitor_check_enabled(&payload.domain_ids, payload.enabled);
    Ok(ApiResponse {
        message: format!(
            "{}개 도메인 체크 {}",
            payload.domain_ids.len(),
            if payload.enabled { "활성화" } else { "비활성화" }
        ),
        success: true,
        data: true,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetDomainStatusLogsPayload {
    pub date: String,
}

pub const GET_DOMAIN_STATUS_LOGS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_domain_status_logs",
    description: "특정 날짜의 도메인 상태 체크 로그를 조회합니다.",
    payload_example: r#"{"date": "2026-07-06"}"#,
    category: "monitor",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_domain_status_logs(
    payload: GetDomainStatusLogsPayload,
    monitor_service: tauri::State<'_, DomainMonitorService>,
) -> Result<ApiResponse<Vec<DomainStatusLog>>, String> {
    get_domain_status_logs_svc(payload, &monitor_service)
}

pub fn get_domain_status_logs_svc(payload: GetDomainStatusLogsPayload, monitor_service: &DomainMonitorService) -> Result<ApiResponse<Vec<DomainStatusLog>>, String> {
    let logs = monitor_service.get_logs_by_date(payload.date);
    Ok(ApiResponse {
        message: format!("{} 건의 로그가 조회되었습니다.", logs.len()),
        success: true,
        data: logs,
    })
}
