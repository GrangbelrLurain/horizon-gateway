use axum::{
    body::Body,
    extract::{Request, State},
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use futures::TryStreamExt;
use hyper_util::rt::TokioIo;
use std::sync::Arc;
use time::OffsetDateTime;
use tauri::{Emitter, Manager};

use crate::model::api_log::ApiLogEntry;
use crate::model::inspector::Annotation;
use crate::service::local_proxy::flags::{is_local_routing_enabled, is_mocking_enabled};

use super::inject::should_inject_for_host;
use super::super::reserved::{serve_watchtower_reserved_path, WATCHTOWER_PATH_PREFIX};
use super::super::routing::{
    get_logging_config_for_host, host_key_for_logging_map, resolve_target,
};
use super::super::state::ProxyState;

pub(crate) async fn proxy_handler_inner(
    State(state): State<Arc<ProxyState>>,
    axum::Extension(scheme): axum::Extension<&'static str>,
    mut req: Request,
) -> Response {
    let method = req.method().to_string();
    let uri = req.uri().clone();
    let path = uri.path();

    // Intercept `/api/ping` directly for Hybrid Handoff Tunnel checks
    if path == "/api/ping" {
        let json = serde_json::json!({
            "app": "watchtower_proxy",
            "status": "ok"
        });
        return (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, HeaderValue::from_static("application/json")),
            ],
            json.to_string(),
        ).into_response();
    }
    let host_h = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok())
        .map(std::string::ToString::to_string)
        .unwrap_or_default();
    crate::proxy_log!("request {} {} Host: {}", method, uri, host_h);

    let uri_str = uri.to_string();
    let is_watchtower_path =
        path.starts_with(WATCHTOWER_PATH_PREFIX) || uri_str.contains(WATCHTOWER_PATH_PREFIX);

    if is_watchtower_path {
        let normalized_path = if let Some(idx) = uri_str.find(WATCHTOWER_PATH_PREFIX) {
            &uri_str[idx..]
        } else {
            path
        };
        // Remove query strings for internal path matching
        let clean_path = normalized_path.split('?').next().unwrap_or(normalized_path);

        crate::proxy_log!(
            "-> watchtower reserved: {} (Original: {})",
            clean_path,
            path
        );

        // Handle App Focus
        if clean_path == "/.watchtower/api/focus" {
            if let Some(main) = state.app_handle.get_webview_window("main") {
                let _ = main.set_focus();
            }
            return (
                StatusCode::OK,
                [(header::CONTENT_TYPE, HeaderValue::from_static("text/plain"))],
                "Focused",
            )
                .into_response();
        }

        // Handle Status Request
        if clean_path == "/.watchtower/api/status" {
            let mocking_enabled = state.mocking_service.get_settings().enabled;
            let json = serde_json::json!({
                "proxy": true,
                "mocking": mocking_enabled,
                "logging": true
            });
            return (
                StatusCode::OK,
                [(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("application/json"),
                )],
                json.to_string(),
            )
                .into_response();
        }

        // Handle Get All Annotations
        if clean_path == "/.watchtower/api/annotations" && req.method() == hyper::Method::GET {
            let list = state.inspector_service.get_all();
            let json = serde_json::to_string(&list).unwrap_or_else(|_| "[]".to_string());
            return (
                StatusCode::OK,
                [(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("application/json"),
                )],
                json,
            )
                .into_response();
        }

        // Handle API Annotation POST
        if clean_path == "/.watchtower/api/annotation" && req.method() == hyper::Method::POST {
            let host_h = req
                .headers()
                .get(hyper::header::HOST)
                .and_then(|v| v.to_str().ok())
                .unwrap_or_default()
                .to_string();

            // Construct full URL (Assuming HTTPS since it's a proxy, or check scheme)
            let full_url = if req.uri().scheme().is_some() {
                req.uri().to_string()
            } else {
                format!("https://{}{}", host_h, req.uri())
            };

            let Ok(body) = axum::body::to_bytes(req.into_body(), usize::MAX).await else {
                return (StatusCode::BAD_REQUEST, "Failed to read body").into_response();
            };

            if let Ok(mut annotation_val) = serde_json::from_slice::<serde_json::Value>(&body) {
                if let Some(obj) = annotation_val.as_object_mut() {
                    if !obj.contains_key("domain") {
                        obj.insert("domain".to_string(), serde_json::Value::String(host_h));
                    }
                    if !obj.contains_key("url") {
                        obj.insert("url".to_string(), serde_json::Value::String(full_url));
                    }
                }

                // Parse into model and save to service
                match serde_json::from_value::<Annotation>(annotation_val.clone()) {
                    Ok(ann) => {
                        state.inspector_service.add_annotation(ann);
                        let count = state.inspector_service.get_all().len();
                        crate::proxy_log!(
                            "✅ [Watchtower] Annotation saved to file. Total count: {}",
                            count
                        );

                        // Emit event to all windows to refresh UI
                        let _ = state.app_handle.emit("annotations-updated", ());
                    }
                    Err(e) => {
                        crate::proxy_log!("❌ [Watchtower] Failed to parse annotation JSON: {}", e);
                    }
                }

                // Emit legacy event for backward compatibility
                let _ = state
                    .app_handle
                    .emit("annotation-dialog-requested", annotation_val);
                return (StatusCode::OK, "Annotation saved").into_response();
            }
            return (StatusCode::BAD_REQUEST, "Invalid JSON").into_response();
        }

        return serve_watchtower_reserved_path(state, clean_path, &host_h).await;
    }

    // --- MOCKING INTERCEPTOR ---
    if is_mocking_enabled() {
        let scenarios = state.mocking_service.get_scenarios();
        let enabled_scenario_ids: Vec<String> = scenarios
            .iter()
            .filter(|s| s.enabled)
            .map(|s| s.id.clone())
            .collect();

        let rules = state.mocking_service.get_mock_rules();
        let target_host = host_key_for_logging_map(&host_h);
        if let Some(rule) = rules.into_iter().find(|r| {
            r.enabled
                && enabled_scenario_ids.contains(&r.scenario_id)
                && r.method.eq_ignore_ascii_case(&method)
                && path.starts_with(&r.url_pattern)
                && (r.host.is_none()
                    || r.host
                        .as_deref()
                        .map(str::to_lowercase)
                        .unwrap_or_default()
                        == target_host)
        }) {
            crate::proxy_log!("-> mocked response for {} {}", method, uri);
            let mut builder = Response::builder().status(rule.response_status);
            if let Some(headers) = builder.headers_mut() {
                for (k, v) in &rule.response_headers {
                    let k_lower = k.to_lowercase();
                    if k_lower == "content-length"
                        || k_lower == "content-encoding"
                        || k_lower == "transfer-encoding"
                        || k_lower == "connection"
                    {
                        continue;
                    }
                    if let Ok(header_name) = header::HeaderName::from_bytes(k.as_bytes()) {
                        if let Ok(header_value) = header::HeaderValue::from_str(v) {
                            headers.insert(header_name, header_value);
                        }
                    }
                }
                headers.insert(
                    header::ACCESS_CONTROL_ALLOW_ORIGIN,
                    HeaderValue::from_static("*"),
                );
            }
            let body = rule.response_body.unwrap_or_default();

            // Save Log for mocked request
            let start_time = OffsetDateTime::now_utc();
            let entry = ApiLogEntry {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: start_time
                    .format(&time::format_description::well_known::Rfc3339)
                    .unwrap_or_default(),
                method: method.clone(),
                url: uri.to_string(),
                host: host_h.clone(),
                path: path.to_string(),
                status_code: Some(rule.response_status),
                request_headers: Some(
                    req.headers()
                        .iter()
                        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                        .collect(),
                ),
                request_body: None, // We don't read the body for most mocks to keep it fast, or we could read it if needed
                response_headers: Some(rule.response_headers.clone()),
                response_body: Some(body.clone()),
            };
            state.api_log_service.save_log(&entry);
            let _ = state.app_handle.emit("api-log-captured", entry);

            return builder.body(Body::from(body)).unwrap_or_else(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to build mock response: {e}"),
                )
                    .into_response()
            });
        }
    }
    // --- END MOCKING INTERCEPTOR ---

    let host_header = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok())
        .map(std::string::ToString::to_string);
    // When local routing is disabled, pass an empty slice so no routes match → pure pass-through.
    let routes = if is_local_routing_enabled() {
        state.route_service.get_enabled()
    } else {
        vec![]
    };
    let (target_uri_str, _pass_through_host, _target_host_value, local_origin) =
        resolve_target(&uri, host_header.as_deref(), &routes, scheme);

    if let Some((ref target_host, target_port, ref path_query)) = local_origin {
        crate::proxy_log!(
            "-> local route -> {}:{} path: {}",
            target_host,
            target_port,
            path_query
        );
    }
    let Ok(target_uri) = Uri::try_from(target_uri_str.as_str()) else {
        return (StatusCode::BAD_REQUEST, "Invalid target URI").into_response();
    };

    *req.uri_mut() = target_uri.clone();

    // API Logging check
    let host_key = host_key_for_logging_map(&host_h);
    let logging_config = state
        .api_logging_map
        .read()
        .ok()
        .and_then(|map| get_logging_config_for_host(&map, &host_key));

    let (logging_enabled, body_enabled) = logging_config.unwrap_or((false, false));
    let _is_local = local_origin.is_some();

    // ── [WebSocket / Upgrade Handling] ──────────────────────────────────────────
    // reqwest does not support WebSocket upgrades. We must handle them manually.
    let is_upgrade = req
        .headers()
        .get(header::UPGRADE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|s| s.to_lowercase() == "websocket");

    if is_upgrade {
        crate::proxy_log!("-> upgrade request (WebSocket) for {}", uri);

        if let Some((ref target_host, target_port, _)) = local_origin {
            let target_host_header = format!("{target_host}:{target_port}");
            crate::proxy_log!("-> WS routing (Raw Hyper): Target Host: {}, Original Host: {}", target_host_header, host_h);
            
            // 1. Connect directly to target server
            let stream = match tokio::net::TcpStream::connect(format!("{target_host}:{target_port}")).await {
                Ok(s) => s,
                Err(e) => {
                    crate::proxy_log!("❌ [WS] Failed to connect to upstream {}:{}: {}", target_host, target_port, e);
                    return (StatusCode::BAD_GATEWAY, format!("Proxy WS connect error: {e}")).into_response();
                }
            };

            let io = TokioIo::new(stream);
            let (mut sender, conn) = match hyper::client::conn::http1::handshake(io).await {
                Ok(c) => c,
                Err(e) => {
                    crate::proxy_log!("❌ [WS] Upstream handshake error: {}", e);
                    return (StatusCode::BAD_GATEWAY, format!("Proxy WS handshake error: {e}")).into_response();
                }
            };

            tokio::spawn(async move {
                if let Err(err) = conn.with_upgrades().await {
                    crate::proxy_log!("ℹ️ [WS] Upstream connection task error: {:?}", err);
                }
            });

            // 2. Prepare request for upstream
            let mut upstream_req = Request::new(Body::empty());
            *upstream_req.method_mut() = req.method().clone();
            if let Some(pq) = target_uri.path_and_query() {
                if let Ok(uri) = pq.as_str().parse::<Uri>() {
                    *upstream_req.uri_mut() = uri;
                }
            } else {
                *upstream_req.uri_mut() = target_uri.clone();
            }
            *upstream_req.version_mut() = hyper::Version::HTTP_11;

            // Copy headers (excluding hop-by-hop)
            let hop_by_hop_headers = [
                "connection",
                "keep-alive",
                "proxy-authenticate",
                "proxy-authorization",
                "te",
                "trailers",
                "transfer-encoding",
                "proxy-connection",
                "accept-encoding",
            ];

            let headers = upstream_req.headers_mut();
            for (name, value) in req.headers() {
                let name_str = name.as_str().to_lowercase();
                if name_str != "host" && !hop_by_hop_headers.contains(&name_str.as_str()) {
                    headers.insert(name.clone(), value.clone());
                }
            }

            // Force Host header to target
            if let Ok(hv) = HeaderValue::from_str(&target_host_header) {
                headers.insert(header::HOST, hv);
            }

            // Force Connection/Upgrade headers for handshake
            headers.insert(header::UPGRADE, HeaderValue::from_static("websocket"));
            headers.insert(header::CONNECTION, HeaderValue::from_static("upgrade"));

            // Rewrite Origin to match Next.js dev server's own origin
            let target_origin = format!("http://{target_host}:{target_port}");
            if let Ok(hv) = HeaderValue::from_str(&target_origin) {
                headers.insert(header::ORIGIN, hv);
            }

            // 3. Send request
            match sender.send_request(upstream_req).await {
                Ok(res) if res.status() == StatusCode::SWITCHING_PROTOCOLS => {
                    crate::proxy_log!(
                        "✅ [WS] Upstream handshake success (101). Headers: {:?}",
                        res.headers()
                    );

                    let mut res_builder = Response::builder().status(StatusCode::SWITCHING_PROTOCOLS);

                    // Copy response headers back to client
                    if let Some(h) = res_builder.headers_mut() {
                        for (k, v) in res.headers() {
                            let k_str = k.as_str().to_lowercase();
                            if !hop_by_hop_headers.contains(&k_str.as_str()) {
                                h.insert(k, v.clone());
                            }
                        }
                        // Ensure these are set
                        h.insert(header::UPGRADE, HeaderValue::from_static("websocket"));
                        h.insert(header::CONNECTION, HeaderValue::from_static("upgrade"));
                    }

                    // Handle Bidirectional Tunneling
                    let (parts, _) = req.into_parts();
                    let upgraded_client =
                        hyper::upgrade::on(axum::http::Request::from_parts(parts, Body::empty()));

                    tokio::spawn(async move {
                        crate::proxy_log!("🚀 [WS] Starting bidirectional copy...");
                        let mut upstream_io = match hyper::upgrade::on(res).await {
                            Ok(upgraded) => TokioIo::new(upgraded),
                            Err(e) => {
                                crate::proxy_log!("❌ [WS] Upstream upgrade failed (after 101): {e}");
                                return;
                            }
                        };

                        let mut client_io = match upgraded_client.await {
                            Ok(upgraded) => TokioIo::new(upgraded),
                            Err(e) => {
                                crate::proxy_log!("❌ [WS] Client upgrade failed (after 101): {e}");
                                return;
                            }
                        };

                        match tokio::io::copy_bidirectional(&mut client_io, &mut upstream_io).await {
                            Ok(_) => crate::proxy_log!("✅ [WS] Tunnel closed normally."),
                            Err(e) => crate::proxy_log!("ℹ️ [WS] Tunnel closed: {e}"),
                        }
                    });

                    return res_builder
                        .body(Body::empty())
                        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
                }
                Ok(res) => {
                    crate::proxy_log!(
                        "❌ [WS] Upstream refused upgrade. Status: {}, Headers: {:?}",
                        res.status(),
                        res.headers()
                    );
                    let status = res.status();
                    let mut res_builder = Response::builder().status(status);
                    if let Some(h) = res_builder.headers_mut() {
                        for (k, v) in res.headers() {
                            h.insert(k, v.clone());
                        }
                    }
                    let body_bytes = axum::body::to_bytes(Body::new(res.into_body()), usize::MAX).await.unwrap_or_default();
                    return res_builder
                        .body(Body::from(body_bytes))
                        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
                }
                Err(e) => {
                    crate::proxy_log!("❌ [WS] Upstream connection error: {e}");
                    return (StatusCode::BAD_GATEWAY, format!("Proxy WS error: {e}")).into_response();
                }
            }
        }

        // --- Pass-through fallback (if local_origin is None) ---
        let mut req_builder = state
            .reqwest_client_direct
            .request(req.method().clone(), &target_uri_str);
        req_builder = req_builder.version(reqwest::Version::HTTP_11);

        // Copy headers (excluding hop-by-hop)
        let hop_by_hop_headers = [
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "transfer-encoding",
            "proxy-connection",
            "accept-encoding",
        ];

        for (name, value) in req.headers() {
            let name_str = name.as_str().to_lowercase();
            if name_str != "host" && !hop_by_hop_headers.contains(&name_str.as_str()) {
                req_builder = req_builder.header(name, value);
            }
        }
        // Force Upgrade/Connection headers for handshake
        req_builder = req_builder.header(header::UPGRADE, "websocket");
        req_builder = req_builder.header(header::CONNECTION, "upgrade");

        crate::proxy_log!("-> WS handshake request headers (Pass-through): {:?}", req.headers());

        // 2. Perform Handshake
        match req_builder.send().await {
            Ok(res) if res.status() == StatusCode::SWITCHING_PROTOCOLS => {
                crate::proxy_log!(
                    "✅ [WS] Upstream handshake success (101). Headers: {:?}",
                    res.headers()
                );

                let mut res_builder = Response::builder().status(StatusCode::SWITCHING_PROTOCOLS);

                // Copy response headers back to client
                if let Some(h) = res_builder.headers_mut() {
                    for (k, v) in res.headers() {
                        let k_str = k.as_str().to_lowercase();
                        if !hop_by_hop_headers.contains(&k_str.as_str()) {
                            h.insert(k, v.clone());
                        }
                    }
                    // Ensure these are set
                    h.insert(header::UPGRADE, HeaderValue::from_static("websocket"));
                    h.insert(header::CONNECTION, HeaderValue::from_static("upgrade"));
                }

                // 3. Handle Bidirectional Tunneling
                let (parts, _) = req.into_parts();
                let upgraded_client =
                    hyper::upgrade::on(axum::http::Request::from_parts(parts, Body::empty()));

                tokio::spawn(async move {
                    crate::proxy_log!("🚀 [WS] Starting bidirectional copy...");
                    let mut upstream_io = match res.upgrade().await {
                        Ok(upgraded) => upgraded,
                        Err(e) => {
                            crate::proxy_log!("❌ [WS] Upstream upgrade failed (after 101): {e}");
                            return;
                        }
                    };

                    let mut client_io = match upgraded_client.await {
                        Ok(upgraded) => TokioIo::new(upgraded),
                        Err(e) => {
                            crate::proxy_log!("❌ [WS] Client upgrade failed (after 101): {e}");
                            return;
                        }
                    };

                    match tokio::io::copy_bidirectional(&mut client_io, &mut upstream_io).await {
                        Ok(_) => crate::proxy_log!("✅ [WS] Tunnel closed normally."),
                        Err(e) => crate::proxy_log!("ℹ️ [WS] Tunnel closed: {e}"),
                    }
                });

                return res_builder
                    .body(Body::empty())
                    .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
            }
            Ok(res) => {
                crate::proxy_log!(
                    "❌ [WS] Upstream refused upgrade. Status: {}, Headers: {:?}",
                    res.status(),
                    res.headers()
                );
                let status = res.status();
                let mut res_builder = Response::builder().status(status);
                if let Some(h) = res_builder.headers_mut() {
                    for (k, v) in res.headers() {
                        h.insert(k, v.clone());
                    }
                }
                let body_bytes = res.bytes().await.unwrap_or_default();
                return res_builder
                    .body(Body::from(body_bytes))
                    .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
            }
            Err(e) => {
                crate::proxy_log!("❌ [WS] Upstream connection error: {e}");
                return (StatusCode::BAD_GATEWAY, format!("Proxy WS error: {e}")).into_response();
            }
        }
    }

    if logging_enabled {
        // Read Request Body
        let (parts, body) = req.into_parts();
        let req_bytes = match axum::body::to_bytes(body, usize::MAX).await {
            Ok(b) => b,
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    format!("Failed to read request body: {e}"),
                )
                    .into_response()
            }
        };
        let req_body_str = if body_enabled {
            String::from_utf8(req_bytes.to_vec()).ok()
        } else {
            None
        };

        // Reconstruct request for forwarding (using reqwest)
        // Note: We already read the body into req_bytes.
        let method = parts.method.clone();
        let url_str = target_uri_str.clone(); /* target_uri_str is full URL */

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
            // Allow sending relatively large bodies for API logging
            req_builder = req_builder.body(req_bytes.to_vec());
        }

        // Copy headers
        let hop_by_hop_headers = [
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

        for (name, value) in &parts.headers {
            let name_str = name.as_str().to_lowercase();
            if name_str != "host" && !hop_by_hop_headers.contains(&name_str.as_str()) {
                req_builder = req_builder.header(name, value);
            }
        }
        // Add Host header if needed (Only for local routes, reqwest handles it for pass-through)
        if local_origin.is_some() {
            req_builder = req_builder.header("host", host_h.clone());
            req_builder = req_builder.header("x-forwarded-proto", scheme);
            req_builder = req_builder.header("x-forwarded-host", host_h.clone());
            req_builder = req_builder.header("x-forwarded-for", "127.0.0.1");
            req_builder = req_builder.header("x-real-ip", "127.0.0.1");
        }

        let start_time = OffsetDateTime::now_utc();

        // Send Request
        let response_result = req_builder.send().await;

        let response = match response_result {
            Ok(res) => res,
            Err(e) => {
                crate::proxy_log!("   reqwest error: {}", e);
                return (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response();
            }
        };

        // Read Response Body
        let status = response.status();
        let mut res_headers = response.headers().clone();
        let res_bytes = match response.bytes().await {
            Ok(b) => b,
            Err(e) => {
                return (
                    StatusCode::BAD_GATEWAY,
                    format!("Failed to read response body: {e}"),
                )
                    .into_response()
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

        // Aggressive HTML detection
        let is_html =
            content_type.contains("text/html") || content_type.contains("application/xhtml+xml");

        // ── [Aggressive Security Header Strip] allow iframing/injection ─────────
        res_headers.remove(header::X_FRAME_OPTIONS);
        res_headers.remove(header::CONTENT_SECURITY_POLICY);
        res_headers.remove("content-security-policy-report-only");
        res_headers.remove("x-content-security-policy");

        // Aggressive Cache & Protocol fix
        res_headers.remove(header::ETAG);
        res_headers.remove(header::LAST_MODIFIED);
        res_headers.remove("alt-svc"); // Disable HTTP/3 upgrade

        let mut final_res_bytes = res_bytes.to_vec();
        if is_html && should_inject_for_host(&state, &host_h) {
            // Force no-cache for HTML to ensure injection is always processed
            res_headers.insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("no-store, no-cache, must-revalidate, proxy-revalidate"),
            );
            res_headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
            res_headers.remove(header::EXPIRES);

            let injection_script = r#"<script id="wt-injection-marker" type="module" src="/.watchtower/inspector.js"></script>"#;

            // 1. Try UTF-8 injection
            let mut injected = false;
            if let Ok(body_str) = String::from_utf8(final_res_bytes.clone()) {
                let body_lower = body_str.to_lowercase();
                if body_lower.contains("</body>") && !body_str.contains("wt-injection-marker") {
                    if let Some(pos) = body_lower.rfind("</body>") {
                        let mut new_body = body_str[..pos].to_string();
                        new_body.push_str(injection_script);
                        new_body.push_str(&body_str[pos..]);
                        final_res_bytes = new_body.into_bytes();
                        injected = true;
                        crate::proxy_log!("✅ [Watchtower] Inspector injected (UTF-8).");
                    }
                }
            }

            // 2. Fallback to Byte-level injection if UTF-8 failed or tag not found in string
            if !injected {
                let pattern = b"</body>";
                let marker = b"wt-injection-marker";
                if !final_res_bytes.windows(marker.len()).any(|w| w == marker) {
                    if let Some(pos) = final_res_bytes
                        .windows(pattern.len())
                        .rposition(|w: &[u8]| w.eq_ignore_ascii_case(pattern))
                    {
                        let mut new_bytes =
                            Vec::with_capacity(final_res_bytes.len() + injection_script.len());
                        new_bytes.extend_from_slice(&final_res_bytes[..pos]);
                        new_bytes.extend_from_slice(injection_script.as_bytes());
                        new_bytes.extend_from_slice(&final_res_bytes[pos..]);
                        final_res_bytes = new_bytes;
                        crate::proxy_log!("✅ [Watchtower] Inspector injected (Byte-level).");
                    }
                }
            }
        }

        // Save Log
        let entry = ApiLogEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: start_time
                .format(&time::format_description::well_known::Rfc3339)
                .unwrap_or_default(),
            method: method.to_string(),
            url: target_uri_str.clone(),
            host: host_h.clone(),
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

        // Reconstruct response
        let mut builder = Response::builder().status(status);
        if let Some(headers) = builder.headers_mut() {
            let skip_headers = [
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
            for (k, v) in &res_headers {
                let k_str = k.as_str().to_lowercase();
                if !skip_headers.contains(&k_str.as_str()) {
                    headers.insert(k, v.clone());
                }
            }
        }
        // Use (potentially modified) Bytes
        builder
            .body(Body::from(final_res_bytes))
            .unwrap_or_else(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to build response: {e}"),
                )
                    .into_response()
            })
    } else {
        // Pass-through or local routing (Non-logging)
        // Use reqwest_client_direct for pass-through to ensure it doesn't try to use system proxy (itself)
        let method = req.method().clone();
        let url_str = target_uri_str.clone();

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

        // Headers
        let hop_by_hop_headers = [
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
        for (name, value) in &parts.headers {
            let name_str = name.as_str().to_lowercase();
            if name_str != "host" && !hop_by_hop_headers.contains(&name_str.as_str()) {
                req_builder = req_builder.header(name, value);
            }
        }
        // Note: Do NOT manually set "host" header for pass-through unless it's a local route
        // reqwest automatically sets it from the URL.
        if local_origin.is_some() {
            req_builder = req_builder.header("host", host_h.clone());
            req_builder = req_builder.header("x-forwarded-proto", scheme);
            req_builder = req_builder.header("x-forwarded-host", host_h.clone());
            req_builder = req_builder.header("x-forwarded-for", "127.0.0.1");
            req_builder = req_builder.header("x-real-ip", "127.0.0.1");
        }

        match req_builder.send().await {
            Ok(res) => {
                let status = res.status();
                let mut res_headers = res.headers().clone();

                // ── [Live Capture] Strip Security Headers to allow iframing ──────
                res_headers.remove(header::X_FRAME_OPTIONS);
                res_headers.remove(header::CONTENT_SECURITY_POLICY);
                res_headers.remove("content-security-policy-report-only");
                res_headers.remove("x-content-security-policy");

                // ── [Cookie Fix] Force SameSite=None; Secure for iframing ──────
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
                // ────────────────────────────────────────────────────────────────

                // Send real-time event even if logging is disabled for DB
                let entry = crate::model::api_log::ApiLogEntry {
                    id: uuid::Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    method: method.to_string(),
                    url: url_str.clone(),
                    host: host_h.clone(),
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

                // Aggressive HTML detection
                let is_html = content_type.contains("text/html")
                    || content_type.contains("application/xhtml+xml");

                // Aggressive Cache & Protocol fix
                res_headers.remove(header::ETAG);
                res_headers.remove(header::LAST_MODIFIED);
                res_headers.remove("alt-svc"); // Disable HTTP/3 upgrade

                if is_html && should_inject_for_host(&state, &host_h) {
                    // Force no-cache for HTML to ensure injection is always processed
                    res_headers.insert(
                        header::CACHE_CONTROL,
                        HeaderValue::from_static(
                            "no-store, no-cache, must-revalidate, proxy-revalidate",
                        ),
                    );
                    res_headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
                    res_headers.remove(header::EXPIRES);

                    let full_body = match res.bytes().await {
                        Ok(b) => b,
                        Err(e) => {
                            crate::proxy_log!("❌ [Watchtower] Failed to read HTML body: {}", e);
                            return (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}"))
                                .into_response();
                        }
                    };
                    let mut final_res_bytes = full_body.to_vec();
                    let injection_script = r#"<script id="wt-injection-marker" type="module" src="/.watchtower/inspector.js"></script>"#;

                    // 1. Try UTF-8 injection
                    let mut injected = false;
                    if let Ok(body_str) = String::from_utf8(final_res_bytes.clone()) {
                        let body_lower = body_str.to_lowercase();
                        if body_lower.contains("</body>")
                            && !body_str.contains("wt-injection-marker")
                        {
                            if let Some(pos) = body_lower.rfind("</body>") {
                                let mut new_body = body_str[..pos].to_string();
                                new_body.push_str(injection_script);
                                new_body.push_str(&body_str[pos..]);
                                final_res_bytes = new_body.into_bytes();
                                injected = true;
                                crate::proxy_log!("✅ [Watchtower] Inspector injected (UTF-8).");
                            }
                        }
                    }

                    // 2. Fallback to Byte-level injection
                    if !injected {
                        let pattern = b"</body>";
                        let marker = b"wt-injection-marker";
                        if !final_res_bytes.windows(marker.len()).any(|w| w == marker) {
                            if let Some(pos) = final_res_bytes
                                .windows(pattern.len())
                                .rposition(|w| w.eq_ignore_ascii_case(pattern))
                            {
                                let mut new_bytes = Vec::with_capacity(
                                    final_res_bytes.len() + injection_script.len(),
                                );
                                new_bytes.extend_from_slice(&final_res_bytes[..pos]);
                                new_bytes.extend_from_slice(injection_script.as_bytes());
                                new_bytes.extend_from_slice(&final_res_bytes[pos..]);
                                final_res_bytes = new_bytes;
                                crate::proxy_log!("✅ [Watchtower] Inspector injected (Byte-level).");
                            }
                        }
                    }

                    let mut builder = Response::builder().status(status);
                    if let Some(headers) = builder.headers_mut() {
                        let skip_headers = [
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
                        for (k, v) in &res_headers {
                            let k_str = k.as_str().to_lowercase();
                            if !skip_headers.contains(&k_str.as_str()) {
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
                    let skip_headers = [
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
                    for (k, v) in &res_headers {
                        let k_str = k.as_str().to_lowercase();
                        if !skip_headers.contains(&k_str.as_str()) {
                            headers.insert(k, v.clone());
                        }
                    }
                }
                let stream = res.bytes_stream();
                let body = Body::from_stream(
                    stream.map_err(std::io::Error::other),
                );
                builder.body(body).unwrap_or_else(|e| {
                    (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response()
                })
            }
            Err(e) => (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response(),
        }
    }
}
