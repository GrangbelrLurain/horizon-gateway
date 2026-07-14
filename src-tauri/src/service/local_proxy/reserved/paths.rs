use axum::http::{
    header::{self, HeaderValue, CONTENT_TYPE},
    StatusCode,
};
use axum::response::{Html, IntoResponse, Response};
use std::sync::Arc;

use super::super::state::ProxyState;
use super::super::tls::serve_cert_pem;

/// Reserved path prefix: proxy serves setup page and assets (no forward to local route).
pub(crate) const HORIZON_GATEWAY_PATH_PREFIX: &str = "/.horizon-gateway/";

/// PAC (Proxy Auto-Config). Returns PROXY for ALL traffic; filtering logic is handled in the proxy itself.
pub(crate) fn build_pac_js(proxy_host: &str, forward_port: u16) -> String {
format!(
        "function FindProxyForURL(url, host) {{ \
            if (host === 'localhost' || \
                host === '127.0.0.1' || \
                host.indexOf('tailscale') !== -1 || \
                host.indexOf('.ts.net') !== -1) {{ \
                return 'DIRECT'; \
            }} \
            return \"PROXY {proxy_host}:{forward_port}; DIRECT\"; \
         }}"
    )
}


pub(crate) async fn serve_horizon_gateway_reserved_path(
    state: Arc<ProxyState>,
    path: &str,
    host_h: &str,
) -> Response {
    if path == "/.horizon-gateway/proxy.pac" || path.starts_with("/.horizon-gateway/proxy.pac") {
        let Some(port) = state.forward_proxy_port else {
            return (StatusCode::NOT_FOUND, "Forward proxy port not configured").into_response();
        };

        let parsed_host = host_h.split(':').next().unwrap_or("");
        let is_loopback = parsed_host == "localhost"
            || parsed_host == "127.0.0.1"
            || parsed_host == "[::1]";

        let proxy_host = if is_loopback {
            "127.0.0.1".to_string()
        } else if parsed_host.ends_with(".trycloudflare.com") || parsed_host == "0.0.0.0" || parsed_host.is_empty() {
            crate::service::tunnel_service::get_tailscale_ip()
                .unwrap_or_else(|| "127.0.0.1".to_string())
        } else {
            parsed_host.to_string()
        };

        let pac = build_pac_js(&proxy_host, port);
        return (
            StatusCode::OK,
            [
                (
                    CONTENT_TYPE,
                    HeaderValue::from_static("application/x-ns-proxy-autoconfig"),
                ),
                (
                    header::CACHE_CONTROL,
                    HeaderValue::from_static("no-cache, no-store, must-revalidate"),
                ),
                (header::PRAGMA, HeaderValue::from_static("no-cache")),
                (header::EXPIRES, HeaderValue::from_static("0")),
            ],
            pac,
        )
            .into_response();
    }
    if path == "/.horizon-gateway/setup" || path.starts_with("/.horizon-gateway/setup") {
        let proxy_port_msg = state
            .forward_proxy_port
            .map(|p| format!(" (Forward proxy: 127.0.0.1:{p})"))
            .unwrap_or_default();
        let port = state.forward_proxy_port.unwrap_or(0);
        let html = include_str!("../../../../resources/setup.html")
            .replace("%PROXY_PORT_MSG%", &proxy_port_msg)
            .replace("%PROXY_PORT%", &port.to_string());
        return Html(html).into_response();
    }
    if path == "/.horizon-gateway/root.crt" {
        let ca_pem = state.ca_service.ca_cert_pem();
        return (
            StatusCode::OK,
            [
                (
                    CONTENT_TYPE,
                    HeaderValue::from_static("application/x-x509-ca-cert"),
                ),
                (
                    header::CONTENT_DISPOSITION,
                    HeaderValue::from_static("attachment; filename=\"horizon-gateway-root-ca.crt\""),
                ),
            ],
            ca_pem,
        )
            .into_response();
    }
    if path.starts_with("/.horizon-gateway/cert/") {
        let host = path.trim_start_matches("/.horizon-gateway/cert/").trim();
        if host.is_empty() {
            return (
                StatusCode::BAD_REQUEST,
                "Missing host in path: /.horizon-gateway/cert/<host>",
            )
                .into_response();
        }
        return serve_cert_pem(Arc::clone(&state), host).into_response();
    }
    if path == "/.horizon-gateway/ca.crt" || path.starts_with("/.horizon-gateway/ca.crt") {
        let pem = state.ca_service.ca_cert_pem();
        return (
            StatusCode::OK,
            [
                (
                    CONTENT_TYPE,
                    HeaderValue::from_static("application/x-x509-ca-cert"),
                ),
                (
                    axum::http::header::CONTENT_DISPOSITION,
                    HeaderValue::from_static("attachment; filename=\"horizon-gateway-ca.crt\""),
                ),
            ],
            pem,
        )
            .into_response();
    }
    if path == "/.horizon-gateway/inspector.js" {
        const INSPECTOR_JS_FALLBACK: &str =
            "console.warn('[horizon-gateway] inspector.js not built; run pnpm build:injection');";
        // Try to read from filesystem first (for live updates during dev)
        let js = std::fs::read_to_string("resources/inspector.js")
            .or_else(|_| std::fs::read_to_string("src-tauri/resources/inspector.js"))
            .unwrap_or_else(|_| INSPECTOR_JS_FALLBACK.to_string());

        return (
            StatusCode::OK,
            [
                (
                    CONTENT_TYPE,
                    HeaderValue::from_static("application/javascript"),
                ),
                (
                    header::CACHE_CONTROL,
                    HeaderValue::from_static("no-store, no-cache, must-revalidate"),
                ),
                (header::PRAGMA, HeaderValue::from_static("no-cache")),
            ],
            js,
        )
            .into_response();
    }
    if path == "/.horizon-gateway/logo.svg" {
        let svg = include_str!("../../../../../app-icon.svg");
        return (
            StatusCode::OK,
            [(CONTENT_TYPE, HeaderValue::from_static("image/svg+xml"))],
            svg,
        )
            .into_response();
    }
    if path == "/.horizon-gateway/api/annotation" {
        // We'll handle POST request in a separate part or here by checking method
        // But serve_horizon_gateway_reserved_path is called with the whole request context in proxy_handler_inner
        return (StatusCode::METHOD_NOT_ALLOWED, "Use POST for this endpoint").into_response();
    }
    (StatusCode::NOT_FOUND, "Not found").into_response()
}
