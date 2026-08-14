use crate::model::api_response::ApiResponse;
use crate::service::transparent_proxy_service::{TransparentProxyService, TransparentProxyStatus};
pub use hg_core::model::transparent_proxy::{ApplyTransparentProxyAppsPayload, OsAppEntry};

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StartTransparentProxyPayload {
    pub port: Option<u16>,
    pub process_names: Option<Vec<String>>,
}

pub const START_TRANSPARENT_PROXY_CLI_INFO: crate::cli::CliCommandInfo =
    crate::cli::CliCommandInfo {
        name: "start_transparent_proxy",
        description: "WinDivert 기반 Transparent Proxy를 시작합니다 (Windows 전용).",
        payload_example: r#"{"port": 8080}"#,
        category: "proxy",
        gui_only: false,
    };

pub fn start_transparent_proxy_svc(
    payload: Option<StartTransparentProxyPayload>,
) -> Result<ApiResponse<TransparentProxyStatus>, String> {
    let port = payload.as_ref().and_then(|p| p.port).unwrap_or(8080);
    if let Some(names) = payload.as_ref().and_then(|p| p.process_names.clone()) {
        TransparentProxyService::set_allowlist(names);
    }
    match TransparentProxyService::start(port) {
        Ok(status) => Ok(ApiResponse {
            message: format!("Transparent proxy started for target port {port}"),
            success: true,
            data: status,
        }),
        Err(e) => Err(e),
    }
}

pub const STOP_TRANSPARENT_PROXY_CLI_INFO: crate::cli::CliCommandInfo =
    crate::cli::CliCommandInfo {
        name: "stop_transparent_proxy",
        description: "실행 중인 Transparent Proxy를 중지합니다.",
        payload_example: "{}",
        category: "proxy",
        gui_only: false,
    };

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

pub const GET_TRANSPARENT_PROXY_STATUS_CLI_INFO: crate::cli::CliCommandInfo =
    crate::cli::CliCommandInfo {
        name: "get_transparent_proxy_status",
        description: "Transparent Proxy의 현재 상태를 조회합니다.",
        payload_example: "{}",
        category: "proxy",
        gui_only: false,
    };

pub fn get_transparent_proxy_status_svc() -> Result<ApiResponse<TransparentProxyStatus>, String> {
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: TransparentProxyService::get_status(),
    })
}

pub fn apply_transparent_proxy_apps_svc(
    payload: ApplyTransparentProxyAppsPayload,
) -> Result<ApiResponse<TransparentProxyStatus>, String> {
    let port = payload.port.unwrap_or(8080);
    TransparentProxyService::set_allowlist(payload.process_names);
    if TransparentProxyService::is_running() {
        let _ = TransparentProxyService::stop();
    }
    match TransparentProxyService::start(port) {
        Ok(status) => Ok(ApiResponse {
            message: format!("Transparent proxy apps applied for port {port}"),
            success: true,
            data: status,
        }),
        Err(e) => Err(e),
    }
}

pub fn scan_os_apps_svc() -> Result<ApiResponse<Vec<OsAppEntry>>, String> {
    let mut apps = vec![
        OsAppEntry {
            name: "node.exe".into(),
            pids: vec![101],
            instance_count: 1,
        },
        OsAppEntry {
            name: "java.exe".into(),
            pids: vec![202],
            instance_count: 1,
        },
        OsAppEntry {
            name: "python.exe".into(),
            pids: vec![303],
            instance_count: 1,
        },
        OsAppEntry {
            name: "curl.exe".into(),
            pids: vec![404],
            instance_count: 1,
        },
    ];
    // Simple Windows tasklist check if available
    #[cfg(windows)]
    {
        if let Ok(output) = std::process::Command::new("tasklist").output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let mut detected: std::collections::HashMap<String, usize> =
                std::collections::HashMap::new();
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(exe) = parts.first() {
                    let exe_lower = exe.to_lowercase();
                    if exe_lower.ends_with(".exe") {
                        *detected.entry(exe_lower).or_insert(0) += 1;
                    }
                }
            }
            let dev_targets = [
                "node.exe",
                "java.exe",
                "python.exe",
                "python3.exe",
                "curl.exe",
                "git.exe",
                "go.exe",
            ];
            apps.clear();
            for target in &dev_targets {
                if let Some(&count) = detected.get(*target) {
                    apps.push(OsAppEntry {
                        name: (*target).to_string(),
                        pids: vec![],
                        instance_count: count as u32,
                    });
                }
            }
        }
    }
    Ok(ApiResponse {
        message: "OK".into(),
        success: true,
        data: apps,
    })
}

pub fn list_transparent_proxy_presets_svc() -> Result<ApiResponse<Vec<String>>, String> {
    Ok(ApiResponse {
        message: "OK".into(),
        success: true,
        data: vec![
            "node.exe".into(),
            "java.exe".into(),
            "python.exe".into(),
            "python3.exe".into(),
            "curl.exe".into(),
            "go.exe".into(),
        ],
    })
}
