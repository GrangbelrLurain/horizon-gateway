use axum::{
    body::Body,
    extract::Request,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use std::sync::Arc;
use time::OffsetDateTime;
use tauri::Emitter;

use crate::model::api_log::ApiLogEntry;

use super::inject::{
    apply_html_injection_cache_headers, inject_inspector_script, should_inject_for_host,
};
use super::super::state::ProxyState;

const HOP_BY_HOP_HEADERS: &[&str] = &[
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "proxy-connection",
    "accept-encoding",
];

const SKIP_RESPONSE_HEADERS: &[&str] = &[
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "proxy-connection",
    "content-length",
];

#[allow(clippy::too_many_arguments)]
pub(crate) async fn handle_with_logging(
    state: &Arc<ProxyState>,
    req: Request,
    target_uri_str: &str,
    path: &str,
    host_h: &str,
    scheme: &str,
    local_origin: Option<&(String, u16, String)>,
    body_enabled: bool,
) -> Response {
    let (parts, body) = req.into_parts();
    let req_bytes = match axum::body::to_bytes(body, usize::MAX).await {
        Ok(b) => b,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                format!("Failed to read request body: {e}"),
            )
                .into_response();
        }
    };
    let req_body_str = if body_enabled {
        String::from_utf8(req_bytes.to_vec()).ok()
    } else {
        None
    };

    let method = parts.method.clone();
    let url_str = target_uri_str.to_string();

    let mut req_builder = if local_origin.is_some() {
        state.reqwest_client.request(method.clone(), &url_str)
    } else {
        state
            .reqwest_client_direct
            .request(method.clone(), &url_str)
    };

    let has_body = !matches!(
        parts.method,
        axum::http::Method::GET
            | axum::http::Method::HEAD
            | axum::http::Method::OPTIONS
            | axum::http::Method::TRACE
    );

    if has_body && !req_bytes.is_empty() {
        req_builder = req_builder.body(req_bytes.to_vec());
    }

    for (name, value) in &parts.headers {
        let name_str = name.as_str().to_lowercase();
        if name_str != "host" && !HOP_BY_HOP_HEADERS.contains(&name_str.as_str()) {
            req_builder = req_builder.header(name, value);
        }
    }
    if local_origin.is_some() {
        req_builder = req_builder.header("host", host_h);
        req_builder = req_builder.header("x-forwarded-proto", scheme);
        req_builder = req_builder.header("x-forwarded-host", host_h);
        req_builder = req_builder.header("x-forwarded-for", "127.0.0.1");
        req_builder = req_builder.header("x-real-ip", "127.0.0.1");
    }

    let start_time = OffsetDateTime::now_utc();
    let response = match req_builder.send().await {
        Ok(res) => res,
        Err(e) => {
            crate::proxy_log!("   reqwest error: {}", e);
            return (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response();
        }
    };

    let status = response.status();
    let mut res_headers = response.headers().clone();
    let res_bytes = match response.bytes().await {
        Ok(b) => b,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                format!("Failed to read response body: {e}"),
            )
                .into_response();
        }
    };

    let res_body_str = if body_enabled {
        String::from_utf8(res_bytes.to_vec()).ok()
    } else {
        None
    };

    let content_type = res_headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_lowercase();

    let is_html =
        content_type.contains("text/html") || content_type.contains("application/xhtml+xml");

    res_headers.remove(header::X_FRAME_OPTIONS);
    res_headers.remove(header::CONTENT_SECURITY_POLICY);
    res_headers.remove("content-security-policy-report-only");
    res_headers.remove("x-content-security-policy");
    res_headers.remove(header::ETAG);
    res_headers.remove(header::LAST_MODIFIED);
    res_headers.remove("alt-svc");

    let mut final_res_bytes = res_bytes.to_vec();
    if is_html && should_inject_for_host(state, host_h) {
        apply_html_injection_cache_headers(&mut res_headers);
        final_res_bytes = inject_inspector_script(final_res_bytes);
    }

    let entry = ApiLogEntry {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: start_time
            .format(&time::format_description::well_known::Rfc3339)
            .unwrap_or_default(),
        method: method.to_string(),
        url: target_uri_str.to_string(),
        host: host_h.to_string(),
        path: path.to_string(),
        status_code: Some(status.as_u16()),
        request_headers: Some(
            parts
                .headers
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                .collect(),
        ),
        request_body: req_body_str,
        response_headers: Some(
            res_headers
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                .collect(),
        ),
        response_body: res_body_str,
    };
    state.api_log_service.save_log(&entry);
    let _ = state.app_handle.emit("api-log-captured", entry);

    let mut builder = Response::builder().status(status);
    if let Some(headers) = builder.headers_mut() {
        for (k, v) in &res_headers {
            let k_str = k.as_str().to_lowercase();
            if !SKIP_RESPONSE_HEADERS.contains(&k_str.as_str()) {
                headers.insert(k, v.clone());
            }
        }
    }
    builder
        .body(Body::from(final_res_bytes))
        .unwrap_or_else(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to build response: {e}"),
            )
                .into_response()
        })
}
