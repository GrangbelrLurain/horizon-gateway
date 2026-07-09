use crate::model::api_response::ApiResponse;
use crate::service::usb_service::{AdbStatus, UsbService};
use tauri::State;
use std::sync::Arc;

pub const CHECK_ADB_STATUS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "check_adb_status",
    description: "ADB 연결 상태와 연결된 디바이스 목록을 조회합니다.",
    payload_example: "{}",
    category: "mobile",
    gui_only: false,
};

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

pub const START_USB_REVERSE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "start_usb_reverse",
    description: "ADB를 통해 USB 리버스 터널을 시작합니다.",
    payload_example: r#"{"port": 8080}"#,
    category: "mobile",
    gui_only: false,
};

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

pub const STOP_USB_REVERSE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "stop_usb_reverse",
    description: "ADB USB 리버스 터널을 중지합니다.",
    payload_example: r#"{"port": 8080}"#,
    category: "mobile",
    gui_only: false,
};

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
