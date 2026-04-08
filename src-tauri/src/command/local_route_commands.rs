use crate::model::api_response::ApiResponse;
use crate::model::local_route::LocalRoute;
use crate::model::proxy_settings::ProxySettings;
use crate::service::api_logging_settings_service::ApiLoggingSettingsService;
use crate::service::api_log_service::ApiLogService;
use crate::service::ca_service::CaService;
use crate::service::local_proxy;
use crate::service::local_route_service::LocalRouteService;
use crate::service::proxy_settings_service::ProxySettingsService;
use crate::service::system_proxy_service::SystemProxyService;
use std::fmt::Write;
use std::io;
use std::sync::atomic::{AtomicU16, Ordering};
use tauri::{AppHandle, Emitter};

/// Build a ProxyStatusPayload from the current global state. Public for use in setup hook.
pub fn get_proxy_status_payload() -> ProxyStatusPayload {
    current_proxy_status()
}

/// Helper: build a ProxyStatusPayload from the current global state.
fn current_proxy_status() -> ProxyStatusPayload {
    let port = PROXY_PORT.load(Ordering::Relaxed);
    let rh = PROXY_REVERSE_HTTP.load(Ordering::Relaxed);
    let rht = PROXY_REVERSE_HTTPS.load(Ordering::Relaxed);
    ProxyStatusPayload {
        running: port != 0,
        port,
        reverse_http_port: if rh != 0 { Some(rh) } else { None },
        reverse_https_port: if rht != 0 { Some(rht) } else { None },
        local_routing_enabled: local_proxy::is_local_routing_enabled(),
    }
}

/// Turns a bind/listen error into a user-friendly message (e.g. port already in use).
fn map_bind_error(port: u16, e: io::Error) -> String {
    let code = e.raw_os_error();
    if code == Some(10048) {
        // Windows WSAEADDRINUSE
        return format!(
            "Port {port} is already in use. Stop the other process using this port or choose a different port in settings."
        );
    }
    if code == Some(98) || code == Some(48) {
        // Linux EADDRINUSE, macOS EADDRINUSE
        return format!(
            "Port {port} is already in use. Stop the other process or choose a different port."
        );
    }
    format!("Failed to bind port {port}: {e}")
}

/// Abort all proxy tasks so bound ports are released. Call when start fails partway.
fn abort_proxy_handles(handles: &mut Vec<tokio::task::JoinHandle<()>>) {
    for h in handles.drain(..) {
        h.abort();
    }
}

#[tauri::command]
pub fn get_local_routes(
    route_service: tauri::State<'_, std::sync::Arc<LocalRouteService>>,
) -> Result<ApiResponse<Vec<LocalRoute>>, String> {
    let list = route_service.get_all();
    Ok(ApiResponse {
        message: format!("{} routes", list.len()),
        success: true,
        data: list,
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddLocalRoutePayload {
    pub domain: String,
    pub target_host: String,
    pub target_port: u16,
}

#[tauri::command]
pub fn add_local_route(
    payload: AddLocalRoutePayload,
    route_service: tauri::State<'_, std::sync::Arc<LocalRouteService>>,
) -> Result<ApiResponse<LocalRoute>, String> {
    let route = route_service.add(payload.domain, payload.target_host, payload.target_port);
    Ok(ApiResponse {
        message: "Route added".to_string(),
        success: true,
        data: route,
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLocalRoutePayload {
    pub id: u32,
    pub domain: Option<String>,
    pub target_host: Option<String>,
    pub target_port: Option<u16>,
    pub enabled: Option<bool>,
}

#[tauri::command]
pub fn update_local_route(
    payload: UpdateLocalRoutePayload,
    route_service: tauri::State<'_, std::sync::Arc<LocalRouteService>>,
) -> Result<ApiResponse<Option<LocalRoute>>, String> {
    let route = route_service.update(
        payload.id,
        payload.domain,
        payload.target_host,
        payload.target_port,
        payload.enabled,
    );
    Ok(ApiResponse {
        message: if route.is_some() {
            "Route updated"
        } else {
            "Route not found"
        }
        .to_string(),
        success: true,
        data: route,
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveLocalRoutePayload {
    pub id: u32,
}

#[tauri::command]
pub fn remove_local_route(
    payload: RemoveLocalRoutePayload,
    route_service: tauri::State<'_, std::sync::Arc<LocalRouteService>>,
) -> Result<ApiResponse<Option<LocalRoute>>, String> {
    let route = route_service.remove(payload.id);
    Ok(ApiResponse {
        message: if route.is_some() {
            "Route removed"
        } else {
            "Route not found"
        }
        .to_string(),
        success: true,
        data: route,
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetLocalRouteEnabledPayload {
    pub id: u32,
    pub enabled: bool,
}

#[tauri::command]
pub fn set_local_route_enabled(
    payload: SetLocalRouteEnabledPayload,
    route_service: tauri::State<'_, std::sync::Arc<LocalRouteService>>,
) -> Result<ApiResponse<Option<LocalRoute>>, String> {
    let route = route_service.set_enabled(payload.id, payload.enabled);
    Ok(ApiResponse {
        message: if route.is_some() {
            "Route updated"
        } else {
            "Route not found"
        }
        .to_string(),
        success: true,
        data: route,
    })
}

/// Last auto-start error (persisted until proxy starts successfully or cleared).
static PROXY_AUTO_START_ERR: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

/// Store auto-start error for FE to query.
pub fn set_auto_start_error(err: Option<String>) {
    if let Ok(mut guard) = PROXY_AUTO_START_ERR.lock() {
        *guard = err;
    }
}

/// Current proxy port when running; 0 when stopped.
static PROXY_PORT: AtomicU16 = AtomicU16::new(0);
/// Reverse HTTP port when running; 0 when not used.
static PROXY_REVERSE_HTTP: AtomicU16 = AtomicU16::new(0);
/// Reverse HTTPS port when running; 0 when not used.
static PROXY_REVERSE_HTTPS: AtomicU16 = AtomicU16::new(0);
static PROXY_HANDLES: std::sync::Mutex<Vec<tokio::task::JoinHandle<()>>> =
    std::sync::Mutex::new(Vec::new());

/// Returns the auto-start error if proxy failed to start on launch, or null if OK.
#[tauri::command]
pub fn get_proxy_auto_start_error() -> Result<ApiResponse<Option<String>>, String> {
    let err = PROXY_AUTO_START_ERR
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    Ok(ApiResponse {
        message: if err.is_some() {
            "Auto-start failed"
        } else {
            "OK"
        }
        .to_string(),
        success: true,
        data: err,
    })
}

#[tauri::command]
pub async fn get_proxy_status() -> Result<ApiResponse<ProxyStatusPayload>, String> {
    let status = current_proxy_status();
    Ok(ApiResponse {
        message: if status.running {
            "Proxy running"
        } else {
            "Proxy stopped"
        }
        .to_string(),
        success: true,
        data: status,
    })
}

#[derive(serde::Serialize)]
pub struct ProxyStatusPayload {
    pub running: bool,
    pub port: u16,
    /// Reverse HTTP listener port (no system proxy; use hosts + this port).
    pub reverse_http_port: Option<u16>,
    /// Reverse HTTPS listener port (TLS by Host).
    pub reverse_https_port: Option<u16>,
    /// When true, local routes are applied; when false, all traffic passes through.
    pub local_routing_enabled: bool,
}

pub const PROXY_STATUS_CHANGED: &str = "proxy-status-changed";
pub const PROXY_AUTO_START_ERROR: &str = "proxy-auto-start-error";

#[tauri::command]
pub fn get_proxy_settings(
    proxy_settings_service: tauri::State<'_, ProxySettingsService>,
) -> Result<ApiResponse<ProxySettings>, String> {
    let settings = proxy_settings_service.get();
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: settings,
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetProxyDnsServerPayload {
    pub dns_server: Option<String>,
}

#[tauri::command]
pub fn set_proxy_dns_server(
    payload: SetProxyDnsServerPayload,
    proxy_settings_service: tauri::State<'_, ProxySettingsService>,
) -> Result<ApiResponse<ProxySettings>, String> {
    let settings = proxy_settings_service.set_dns_server(payload.dns_server);
    Ok(ApiResponse {
        message: "DNS server updated".to_string(),
        success: true,
        data: settings,
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetProxyPortPayload {
    pub port: u16,
}

#[tauri::command]
pub fn set_proxy_port(
    payload: SetProxyPortPayload,
    proxy_settings_service: tauri::State<'_, ProxySettingsService>,
) -> Result<ApiResponse<ProxySettings>, String> {
    let settings = proxy_settings_service.set_proxy_port(payload.port);
    Ok(ApiResponse {
        message: format!("Proxy port set to {}", settings.proxy_port),
        success: true,
        data: settings,
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartLocalProxyPayload {
    pub port: Option<u16>,
}

#[tauri::command]
pub async fn start_local_proxy(
    app: AppHandle,
    payload: Option<StartLocalProxyPayload>,
    route_service: tauri::State<'_, std::sync::Arc<LocalRouteService>>,
    proxy_settings_service: tauri::State<'_, ProxySettingsService>,
    api_logging_service: tauri::State<'_, ApiLoggingSettingsService>,
    api_log_service: tauri::State<'_, ApiLogService>,
    ca_service: tauri::State<'_, std::sync::Arc<CaService>>,
    mocking_service: tauri::State<'_, std::sync::Arc<crate::service::mocking_service::MockingService>>,
) -> Result<ApiResponse<ProxyStatusPayload>, String> {
    let port = payload
        .and_then(|p| p.port)
        .unwrap_or_else(|| proxy_settings_service.get().proxy_port);
    if PROXY_PORT.load(Ordering::Relaxed) != 0 {
        let payload = current_proxy_status();
        let _ = app.emit(PROXY_STATUS_CHANGED, &payload);
        return Ok(ApiResponse {
            message: "Proxy already running".to_string(),
            success: true,
            data: payload,
        });
    }
    let settings = proxy_settings_service.get();
    let dns_server = settings.dns_server;
    let reverse_http = settings.reverse_http_port.filter(|&p| p > 0);
    let reverse_https = settings.reverse_https_port.filter(|&p| p > 0);

    // Ports must be distinct (each socket address can only be used once).
    let mut used = std::collections::HashSet::from([port]);
    if let Some(rh) = reverse_http {
        if !used.insert(rh) {
            return Err(format!(
                "Reverse HTTP port {rh} is already used by the main proxy port. Use different ports."
            ));
        }
    }
    if let Some(rht) = reverse_https {
        if !used.insert(rht) {
            return Err(format!(
                "Reverse HTTPS port {rht} is already in use (same as proxy or reverse HTTP). Use a different port."
            ));
        }
    }

    let mut handles = Vec::new();
    let api_logging_map = api_logging_service.settings_map_arc();
    let api_log_service_arc = std::sync::Arc::new((*api_log_service).clone());
    let ca_service_arc = (*ca_service).clone();
    let mocking_service_arc = (*mocking_service).clone();

    match local_proxy::run_proxy(
        port,
        std::sync::Arc::clone(&*route_service),
        dns_server.clone(),
        api_logging_map.clone(),
        api_log_service_arc.clone(),
        ca_service_arc.clone(),
        mocking_service_arc.clone(),
    )
    .await
    {
        Ok(h0) => handles.push(h0),
        Err(e) => return Err(map_bind_error(port, e)),
    }

    if let Some(rh) = reverse_http {
        match local_proxy::run_reverse_proxy_http(
            rh,
            std::sync::Arc::clone(&*route_service),
            dns_server.clone(),
            Some(port),
            api_logging_map.clone(),
            api_log_service_arc.clone(),
            ca_service_arc.clone(),
            mocking_service_arc.clone(),
        )
        .await
        {
            Ok(h) => {
                handles.push(h);
                PROXY_REVERSE_HTTP.store(rh, Ordering::Relaxed);
            }
            Err(e) => {
                abort_proxy_handles(&mut handles);
                return Err(map_bind_error(rh, e));
            }
        }
    }
    if let Some(rht) = reverse_https {
        match local_proxy::run_reverse_proxy_https(
            rht,
            std::sync::Arc::clone(&*route_service),
            dns_server,
            Some(port),
            api_logging_map,
            api_log_service_arc.clone(),
            ca_service_arc,
            mocking_service_arc.clone(),
        )
        .await
        {
            Ok(h) => {
                handles.push(h);
                PROXY_REVERSE_HTTPS.store(rht, Ordering::Relaxed);
            }
            Err(e) => {
                abort_proxy_handles(&mut handles);
                return Err(map_bind_error(rht, e));
            }
        }
    }

    PROXY_PORT.store(port, Ordering::Relaxed);
    set_auto_start_error(None); // clear any previous error
    let mut guard = PROXY_HANDLES.lock().map_err(|e| e.to_string())?;
    *guard = handles;

    // Set system PAC URL
    let pac_url = format!("http://127.0.0.1:{}/.watchtower/proxy.pac", port);
    if let Err(e) = SystemProxyService::set_pac_url(&pac_url) {
        eprintln!("Failed to set system proxy: {}", e);
    }

    let payload = ProxyStatusPayload {
        running: true,
        port,
        reverse_http_port: reverse_http,
        reverse_https_port: reverse_https,
        local_routing_enabled: local_proxy::is_local_routing_enabled(),
    };
    let _ = app.emit(PROXY_STATUS_CHANGED, &payload);
    let mut msg = format!("Proxy started on 127.0.0.1:{port}");
    if let Some(p) = reverse_http {
        let _ = write!(&mut msg, ", reverse HTTP :{p}");
    }
    if let Some(p) = reverse_https {
        let _ = write!(&mut msg, ", reverse HTTPS :{p}");
    }
    Ok(ApiResponse {
        message: msg,
        success: true,
        data: payload,
    })
}

/// Returns the setup page URL when proxy is running and a reverse port is configured.
/// Frontend can open this URL in the browser (e.g. via opener plugin).
#[tauri::command]
pub fn get_proxy_setup_url() -> Result<ApiResponse<String>, String> {
    let port = PROXY_PORT.load(Ordering::Relaxed);
    if port == 0 {
        return Err("Proxy is not running".to_string());
    }
    let rh = PROXY_REVERSE_HTTP.load(Ordering::Relaxed);
    let rht = PROXY_REVERSE_HTTPS.load(Ordering::Relaxed);
    let url = if rh != 0 {
        format!("http://127.0.0.1:{rh}/.watchtower/setup")
    } else if rht != 0 {
        format!("https://127.0.0.1:{rht}/.watchtower/setup")
    } else {
        return Err(
            "No reverse port configured. Set reverse HTTP or HTTPS port and start the proxy."
                .to_string(),
        );
    };
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: url,
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetProxyReversePortsPayload {
    pub reverse_http_port: Option<u16>,
    pub reverse_https_port: Option<u16>,
}

#[tauri::command]
pub fn set_proxy_reverse_ports(
    payload: SetProxyReversePortsPayload,
    proxy_settings_service: tauri::State<'_, ProxySettingsService>,
) -> Result<ApiResponse<ProxySettings>, String> {
    let settings = proxy_settings_service
        .set_reverse_ports(payload.reverse_http_port, payload.reverse_https_port);
    Ok(ApiResponse {
        message: "Reverse ports updated (apply on next proxy start)".to_string(),
        success: true,
        data: settings,
    })
}

#[tauri::command]
pub fn stop_local_proxy(app: AppHandle) -> Result<ApiResponse<ProxyStatusPayload>, String> {
    let mut guard = PROXY_HANDLES.lock().map_err(|e| e.to_string())?;
    for h in guard.drain(..) {
        h.abort();
    }

    // Clear system PAC URL
    let _ = SystemProxyService::clear_pac_url();

    let _ = PROXY_PORT.swap(0, Ordering::Relaxed);
    let _ = PROXY_REVERSE_HTTP.swap(0, Ordering::Relaxed);
    let _ = PROXY_REVERSE_HTTPS.swap(0, Ordering::Relaxed);
    let payload = ProxyStatusPayload {
        running: false,
        port: 0,
        reverse_http_port: None,
        reverse_https_port: None,
        local_routing_enabled: local_proxy::is_local_routing_enabled(),
    };
    let _ = app.emit(PROXY_STATUS_CHANGED, &payload);
    Ok(ApiResponse {
        message: "Proxy stopped".to_string(),
        success: true,
        data: payload,
    })
}

// ── Local routing toggle ───────────────────────────────────────────────

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetLocalRoutingEnabledPayload {
    pub enabled: bool,
}

#[tauri::command]
pub fn set_local_routing_enabled(
    app: AppHandle,
    payload: SetLocalRoutingEnabledPayload,
    proxy_settings_service: tauri::State<'_, ProxySettingsService>,
) -> Result<ApiResponse<ProxyStatusPayload>, String> {
    // Update runtime flag
    local_proxy::set_local_routing_enabled(payload.enabled);
    // Persist
    proxy_settings_service.set_local_routing_enabled(payload.enabled);

    let status = current_proxy_status();
    let _ = app.emit(PROXY_STATUS_CHANGED, &status);
    Ok(ApiResponse {
        message: format!(
            "Local routing {}",
            if payload.enabled { "enabled" } else { "disabled" }
        ),
        success: true,
        data: status,
    })
}

// ── Auto-start (called from setup hook) ────────────────────────────────

/// Start the proxy using persisted settings. Designed to be called once from the Tauri setup hook.
pub async fn auto_start_proxy(
    route_service: std::sync::Arc<LocalRouteService>,
    settings: &ProxySettings,
    api_logging_map: std::sync::Arc<std::sync::RwLock<std::collections::HashMap<String, (bool, bool)>>>,
    api_log_service: std::sync::Arc<ApiLogService>,
    ca_service: std::sync::Arc<CaService>,
    mocking_service: std::sync::Arc<crate::service::mocking_service::MockingService>,
) -> Result<(), String> {
    // Restore persisted local_routing_enabled flag
    local_proxy::set_local_routing_enabled(settings.local_routing_enabled);

    if PROXY_PORT.load(Ordering::Relaxed) != 0 {
        return Ok(()); // already running
    }

    let port = settings.proxy_port;
    let dns_server = settings.dns_server.clone();
    let reverse_http = settings.reverse_http_port.filter(|&p| p > 0);
    let reverse_https = settings.reverse_https_port.filter(|&p| p > 0);

    let mut used = std::collections::HashSet::from([port]);
    if let Some(rh) = reverse_http {
        if !used.insert(rh) {
            return Err(format!("Reverse HTTP port {rh} conflicts with main proxy port"));
        }
    }
    if let Some(rht) = reverse_https {
        if !used.insert(rht) {
            return Err(format!("Reverse HTTPS port {rht} conflicts"));
        }
    }

    let mut handles = Vec::new();
    match local_proxy::run_proxy(
        port,
        std::sync::Arc::clone(&route_service),
        dns_server.clone(),
        api_logging_map.clone(),
        api_log_service.clone(),
        ca_service.clone(),
        mocking_service.clone(),
    )
    .await
    {
        Ok(h) => handles.push(h),
        Err(e) => return Err(format!("Failed to bind proxy port {port}: {e}")),
    }

    if let Some(rh) = reverse_http {
        match local_proxy::run_reverse_proxy_http(
            rh,
            std::sync::Arc::clone(&route_service),
            dns_server.clone(),
            Some(port),
            api_logging_map.clone(),
            api_log_service.clone(),
            ca_service.clone(),
            mocking_service.clone(),
        )
        .await
        {
            Ok(h) => {
                handles.push(h);
                PROXY_REVERSE_HTTP.store(rh, Ordering::Relaxed);
            }
            Err(e) => {
                abort_proxy_handles(&mut handles);
                return Err(format!("Failed to bind reverse HTTP port {rh}: {e}"));
            }
        }
    }
    if let Some(rht) = reverse_https {
        match local_proxy::run_reverse_proxy_https(
            rht,
            std::sync::Arc::clone(&route_service),
            dns_server,
            Some(port),
            api_logging_map,
            api_log_service.clone(),
            ca_service,
            mocking_service.clone(),
        )
        .await
        {
            Ok(h) => {
                handles.push(h);
                PROXY_REVERSE_HTTPS.store(rht, Ordering::Relaxed);
            }
            Err(e) => {
                abort_proxy_handles(&mut handles);
                return Err(format!("Failed to bind reverse HTTPS port {rht}: {e}"));
            }
        }
    }

    PROXY_PORT.store(port, Ordering::Relaxed);
    let mut guard = PROXY_HANDLES.lock().map_err(|e| e.to_string())?;
    *guard = handles;

    // Set system PAC URL
    let pac_url = format!("http://127.0.0.1:{}/.watchtower/proxy.pac", port);
    if let Err(e) = SystemProxyService::set_pac_url(&pac_url) {
        eprintln!("[auto-start] Failed to set system proxy: {}", e);
    }

    let mut msg = format!("[auto-start] Proxy on 127.0.0.1:{port}");
    if let Some(p) = reverse_http {
        let _ = write!(&mut msg, ", reverse HTTP :{p}");
    }
    if let Some(p) = reverse_https {
        let _ = write!(&mut msg, ", reverse HTTPS :{p}");
    }
    eprintln!("{msg}");
    Ok(())
}
