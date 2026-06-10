use crate::model::api_response::ApiResponse;
use crate::service::tunnel_service::TunnelService;
use tauri::State;
use std::sync::Arc;

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
