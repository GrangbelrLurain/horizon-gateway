use crate::model::api_response::ApiResponse;
use crate::service::usb_service::{AdbStatus, UsbService};
use tauri::State;
use std::sync::Arc;

#[tauri::command]
#[specta::specta]
pub async fn check_adb_status(
    usb_service: State<'_, Arc<UsbService>>,
) -> Result<ApiResponse<AdbStatus>, String> {
    let status = usb_service.check_status();
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: status,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn start_usb_reverse(
    usb_service: State<'_, Arc<UsbService>>,
    port: u16,
) -> Result<ApiResponse<()>, String> {
    match usb_service.start_reverse(port) {
        Ok(()) => Ok(ApiResponse {
            message: "Reverse tunnel started successfully".to_string(),
            success: true,
            data: (),
        }),
        Err(e) => Err(e),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn stop_usb_reverse(
    usb_service: State<'_, Arc<UsbService>>,
    port: u16,
) -> Result<ApiResponse<()>, String> {
    match usb_service.stop_reverse(port) {
        Ok(()) => Ok(ApiResponse {
            message: "Reverse tunnel stopped successfully".to_string(),
            success: true,
            data: (),
        }),
        Err(e) => Err(e),
    }
}
