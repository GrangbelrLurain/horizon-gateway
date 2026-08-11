use crate::model::api_response::ApiResponse;
use crate::service::transparent_proxy_service::{TransparentProxyService, TransparentProxyStatus};

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StartTransparentProxyPayload {
    pub port: Option<u16>,
}

pub const START_TRANSPARENT_PROXY_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "start_transparent_proxy",
    description: "WinDivert 기반 Transparent Proxy를 시작합니다 (Windows 전용).",
    payload_example: r#"{"port": 8080}"#,
    category: "proxy",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn start_transparent_proxy(
    payload: Option<StartTransparentProxyPayload>,
) -> Result<ApiResponse<TransparentProxyStatus>, String> {
    start_transparent_proxy_svc(payload)
}

pub fn start_transparent_proxy_svc(
    payload: Option<StartTransparentProxyPayload>,
) -> Result<ApiResponse<TransparentProxyStatus>, String> {
    let port = payload.and_then(|p| p.port).unwrap_or(8080);
    match TransparentProxyService::start(port) {
        Ok(status) => Ok(ApiResponse {
            message: format!("Transparent proxy started for target port {port}"),
            success: true,
            data: status,
        }),
        Err(e) => Err(e),
    }
}

pub const STOP_TRANSPARENT_PROXY_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "stop_transparent_proxy",
    description: "실행 중인 Transparent Proxy를 중지합니다.",
    payload_example: "{}",
    category: "proxy",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn stop_transparent_proxy() -> Result<ApiResponse<TransparentProxyStatus>, String> {
    stop_transparent_proxy_svc()
}

pub fn stop_transparent_proxy_svc() -> Result<ApiResponse<TransparentProxyStatus>, String> {
    match TransparentProxyService::stop() {
        Ok(status) => Ok(ApiResponse {
            message: "Transparent proxy stopped".to_string(),
            success: true,
            data: status,
        }),
        Err(e) => Err(e),
    }
}

pub const GET_TRANSPARENT_PROXY_STATUS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_transparent_proxy_status",
    description: "Transparent Proxy의 현재 상태를 조회합니다.",
    payload_example: "{}",
    category: "proxy",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_transparent_proxy_status() -> Result<ApiResponse<TransparentProxyStatus>, String> {
    get_transparent_proxy_status_svc()
}

pub fn get_transparent_proxy_status_svc() -> Result<ApiResponse<TransparentProxyStatus>, String> {
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: TransparentProxyService::get_status(),
    })
}
