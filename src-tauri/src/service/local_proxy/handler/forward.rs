use axum::{
    body::Body,
    extract::Request,
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use futures::TryStreamExt;
use std::sync::Arc;
use tauri::Emitter;

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

pub(crate) async fn handle_pass_through(
    state: &Arc<ProxyState>,
    req: Request,
    target_uri_str: &str,
    path: &str,
    host_h: &str,
    scheme: &str,
    local_origin: Option<&(String, u16, String)>,
) -> Response {
    let method = req.method().clone();
    let url_str = target_uri_str.to_string();

    let mut req_builder = if local_origin.is_some() {
        state.reqwest_client.request(method.clone(), &url_str)
    } else {
        state
            .reqwest_client_direct
            .request(method.clone(), &url_str)
    };
    let (parts, body) = req.into_parts();

    let has_body = !matches!(
        parts.method,
        axum::http::Method::GET
            | axum::http::Method::HEAD
            | axum::http::Method::OPTIONS
            | axum::http::Method::TRACE
    );

    if has_body {
        let body_stream = TryStreamExt::map_err(
            TryStreamExt::map_ok(http_body_util::BodyStream::new(body), |frame| {
                frame.into_data().unwrap_or_default()
            }),
            |e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>,
        );
        let reqwest_body = reqwest::Body::wrap_stream(body_stream);
        req_builder = req_builder.body(reqwest_body);
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

    match req_builder.send().await {
        Ok(res) => {
            let status = res.status();
            let mut res_headers = res.headers().clone();

            res_headers.remove(header::X_FRAME_OPTIONS);
            res_headers.remove(header::CONTENT_SECURITY_POLICY);
            res_headers.remove("content-security-policy-report-only");
            res_headers.remove("x-content-security-policy");

            let mut cookie_updates = Vec::new();
            for (name, value) in &res_headers {
                if name == header::SET_COOKIE {
                    if let Ok(cookie_str) = value.to_str() {
                        let mut new_cookie = cookie_str.to_string();
                        if new_cookie.contains("SameSite=") {
                            new_cookie = new_cookie
                                .replace("SameSite=Lax", "SameSite=None")
                                .replace("SameSite=Strict", "SameSite=None");
                        } else {
                            new_cookie.push_str("; SameSite=None");
                        }
                        if !new_cookie.contains("Secure") {
                            new_cookie.push_str("; Secure");
                        }
                        cookie_updates.push(new_cookie);
                    }
                }
            }
            if !cookie_updates.is_empty() {
                res_headers.remove(header::SET_COOKIE);
                for cookie in cookie_updates {
                    if let Ok(hv) = HeaderValue::from_str(&cookie) {
                        res_headers.append(header::SET_COOKIE, hv);
                    }
                }
            }

            let entry = crate::model::api_log::ApiLogEntry {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                method: method.to_string(),
                url: url_str.clone(),
                host: host_h.to_string(),
                path: path.to_string(),
                status_code: Some(status.as_u16()),
                request_headers: None,
                request_body: None,
                response_headers: None,
                response_body: None,
            };
            state.api_log_service.save_log(&entry);
            let _ = state.app_handle.emit("api-log-captured", entry);

            let content_type = res_headers
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("unknown")
                .to_lowercase();

            let is_html = content_type.contains("text/html")
                || content_type.contains("application/xhtml+xml");

            res_headers.remove(header::ETAG);
            res_headers.remove(header::LAST_MODIFIED);
            res_headers.remove("alt-svc");

            if is_html && should_inject_for_host(state, host_h) {
                apply_html_injection_cache_headers(&mut res_headers);

                let full_body = match res.bytes().await {
                    Ok(b) => b,
                    Err(e) => {
                        crate::proxy_log!("❌ [Watchtower] Failed to read HTML body: {}", e);
                        return (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}"))
                            .into_response();
                    }
                };
                let final_res_bytes = inject_inspector_script(full_body.to_vec());

                let mut builder = Response::builder().status(status);
                if let Some(headers) = builder.headers_mut() {
                    for (k, v) in &res_headers {
                        let k_str = k.as_str().to_lowercase();
                        if !SKIP_RESPONSE_HEADERS.contains(&k_str.as_str()) {
                            headers.insert(k, v.clone());
                        }
                    }
                }
                return builder
                    .body(Body::from(final_res_bytes))
                    .unwrap_or_else(|e| {
                        (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response()
                    });
            }

            let mut builder = Response::builder().status(status);
            if let Some(headers) = builder.headers_mut() {
                for (k, v) in &res_headers {
                    let k_str = k.as_str().to_lowercase();
                    if !SKIP_RESPONSE_HEADERS.contains(&k_str.as_str()) {
                        headers.insert(k, v.clone());
                    }
                }
            }
            let stream = res.bytes_stream();
            let body = Body::from_stream(stream.map_err(std::io::Error::other));
            builder.body(body).unwrap_or_else(|e| {
                (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response()
            })
        }
        Err(e) => (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response(),
    }
}
