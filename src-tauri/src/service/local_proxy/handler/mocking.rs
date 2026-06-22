use axum::{
    body::Body,
    extract::Request,
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use std::sync::Arc;
use time::OffsetDateTime;
use tauri::Emitter;

use crate::model::api_log::ApiLogEntry;
use crate::service::local_proxy::flags::is_mocking_enabled;

use super::super::routing::host_key_for_logging_map;
use super::super::state::ProxyState;

pub(crate) fn try_mock_response(
    state: &Arc<ProxyState>,
    req: &Request,
    method: &str,
    uri: &Uri,
    path: &str,
    host_h: &str,
) -> Option<Response> {
    if !is_mocking_enabled() {
        return None;
    }

    let scenarios = state.mocking_service.get_scenarios();
    let enabled_scenario_ids: Vec<String> = scenarios
        .iter()
        .filter(|s| s.enabled)
        .map(|s| s.id.clone())
        .collect();

    let rules = state.mocking_service.get_mock_rules();
    let target_host = host_key_for_logging_map(host_h);
    let rule = rules.into_iter().find(|r| {
        r.enabled
            && enabled_scenario_ids.contains(&r.scenario_id)
            && r.method.eq_ignore_ascii_case(method)
            && path.starts_with(&r.url_pattern)
            && (r.host.is_none()
                || r.host
                    .as_deref()
                    .map(str::to_lowercase)
                    .unwrap_or_default()
                    == target_host)
    })?;

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

    let start_time = OffsetDateTime::now_utc();
    let entry = ApiLogEntry {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: start_time
            .format(&time::format_description::well_known::Rfc3339)
            .unwrap_or_default(),
        method: method.to_string(),
        url: uri.to_string(),
        host: host_h.to_string(),
        path: path.to_string(),
        status_code: Some(rule.response_status),
        request_headers: Some(
            req.headers()
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                .collect(),
        ),
        request_body: None,
        response_headers: Some(rule.response_headers.clone()),
        response_body: Some(body.clone()),
    };
    state.api_log_service.save_log(&entry);
    let _ = state.app_handle.emit("api-log-captured", entry);

    Some(
        builder
            .body(Body::from(body))
            .unwrap_or_else(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to build mock response: {e}"),
                )
                    .into_response()
            }),
    )
}
