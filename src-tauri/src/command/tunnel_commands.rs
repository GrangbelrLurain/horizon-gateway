use crate::model::api_response::ApiResponse;
use crate::service::tunnel_service::TunnelService;
use tauri::State;
use std::sync::Arc;

pub const GET_TAILSCALE_IP_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_tailscale_ip",
    description: "Tailscale VPN을 통해 할당된 로컬 IP를 조회합니다.",
    payload_example: "{}",
};

#[tauri::command]
#[specta::specta]
pub fn get_tailscale_ip(
    tunnel_service: State<'_, Arc<TunnelService>>,
) -> Result<ApiResponse<Option<String>>, String> {
    let ip = tunnel_service.get_tailscale_ip();
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: ip,
    })
}

pub const START_CLOUDFLARE_TUNNEL_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "start_cloudflare_tunnel",
    description: "Cloudflare 터널을 시작하고 표준 툰널 URL을 반환합니다.",
    payload_example: "{}",
};

#[tauri::command]
#[specta::specta]
pub async fn start_cloudflare_tunnel(
    tunnel_service: State<'_, Arc<TunnelService>>,
) -> Result<ApiResponse<String>, String> {
    match tunnel_service.start_tunnel().await {
        Ok(url) => Ok(ApiResponse {
            message: "Tunnel started successfully".to_string(),
            success: true,
            data: url,
        }),
        Err(e) => Err(e),
    }
}

pub const STOP_CLOUDFLARE_TUNNEL_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "stop_cloudflare_tunnel",
    description: "실행 중인 Cloudflare 터널을 중지합니다.",
    payload_example: "{}",
};

#[tauri::command]
#[specta::specta]
pub async fn stop_cloudflare_tunnel(
    tunnel_service: State<'_, Arc<TunnelService>>,
) -> Result<ApiResponse<()>, String> {
    match tunnel_service.stop_tunnel().await {
        Ok(()) => Ok(ApiResponse {
            message: "Tunnel stopped successfully".to_string(),
            success: true,
            data: (),
        }),
        Err(e) => Err(e),
    }
}
