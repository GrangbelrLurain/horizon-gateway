use axum::{
    extract::Request,
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use std::sync::Arc;
use tauri::{Emitter, Manager};

use crate::model::inspector::Annotation;

use super::super::reserved::{serve_horizon_gateway_reserved_path, HORIZON_GATEWAY_PATH_PREFIX};
use super::super::state::ProxyState;

/// Handled API / reserved-path requests. `Err(req)` means the caller should continue the pipeline.
pub(crate) async fn try_handle_api(
    state: &Arc<ProxyState>,
    req: Request,
    path: &str,
    uri: &Uri,
) -> Result<Response, Request> {
    if path == "/api/ping" {
        let json = serde_json::json!({
            "app": "horizon_gateway_proxy",
            "status": "ok"
        });
        return Ok((
            StatusCode::OK,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/json"),
            )],
            json.to_string(),
        )
            .into_response());
    }

    let uri_str = uri.to_string();
    let is_horizon_gateway_path =
        path.starts_with(HORIZON_GATEWAY_PATH_PREFIX) || uri_str.contains(HORIZON_GATEWAY_PATH_PREFIX);

    if !is_horizon_gateway_path {
        return Err(req);
    }

    let normalized_path = if let Some(idx) = uri_str.find(HORIZON_GATEWAY_PATH_PREFIX) {
        &uri_str[idx..]
    } else {
        path
    };
    let clean_path = normalized_path.split('?').next().unwrap_or(normalized_path);

    let host_h = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok())
        .map(std::string::ToString::to_string)
        .unwrap_or_default();

    crate::proxy_log!(
        "-> horizon-gateway reserved: {} (Original: {})",
        clean_path,
        path
    );

    if clean_path == "/.horizon-gateway/api/focus" {
        if let Some(main) = state.app_handle.get_webview_window("main") {
            let _ = main.set_focus();
        }
        return Ok((
            StatusCode::OK,
            [(header::CONTENT_TYPE, HeaderValue::from_static("text/plain"))],
            "Focused",
        )
            .into_response());
    }

    if clean_path == "/.horizon-gateway/api/status" {
        let mocking_enabled = state.mocking_service.get_settings().enabled;
        let json = serde_json::json!({
            "proxy": true,
            "mocking": mocking_enabled,
            "logging": true
        });
        return Ok((
            StatusCode::OK,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/json"),
            )],
            json.to_string(),
        )
            .into_response());
    }

    if clean_path == "/.horizon-gateway/api/annotations" && req.method() == hyper::Method::GET {
        let list = state.inspector_service.get_all();
        let json = serde_json::to_string(&list).unwrap_or_else(|_| "[]".to_string());
        return Ok((
            StatusCode::OK,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/json"),
            )],
            json,
        )
            .into_response());
    }

    if clean_path == "/.horizon-gateway/api/annotation" && req.method() == hyper::Method::POST {
        let host_h = req
            .headers()
            .get(hyper::header::HOST)
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default()
            .to_string();

        let full_url = if req.uri().scheme().is_some() {
            req.uri().to_string()
        } else {
            format!("https://{}{}", host_h, req.uri())
        };

        let Ok(body) = axum::body::to_bytes(req.into_body(), usize::MAX).await else {
            return Ok((StatusCode::BAD_REQUEST, "Failed to read body").into_response());
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

            match serde_json::from_value::<Annotation>(annotation_val.clone()) {
                Ok(ann) => {
                    state.inspector_service.add_annotation(ann);
                    let count = state.inspector_service.get_all().len();
                    crate::proxy_log!(
                        "✅ [Horizon Gateway] Annotation saved to file. Total count: {}",
                        count
                    );
                    let _ = state.app_handle.emit("annotations-updated", ());
                }
                Err(e) => {
                    crate::proxy_log!("❌ [Horizon Gateway] Failed to parse annotation JSON: {}", e);
                }
            }

            let _ = state
                .app_handle
                .emit("annotation-dialog-requested", annotation_val);
            return Ok((StatusCode::OK, "Annotation saved").into_response());
        }
        return Ok((StatusCode::BAD_REQUEST, "Invalid JSON").into_response());
    }

    Ok(serve_horizon_gateway_reserved_path(state.clone(), clean_path, &host_h).await)
}
