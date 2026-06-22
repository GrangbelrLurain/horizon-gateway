use std::sync::Arc;

use axum::http::{header, HeaderMap, HeaderValue};

use crate::service::local_proxy::flags::is_inspector_enabled;

use super::super::routing::host_key_for_logging_map;
use super::super::state::ProxyState;

pub(crate) const INSPECTOR_INJECTION_SCRIPT: &str =
    r#"<script id="wt-injection-marker" type="module" src="/.watchtower/inspector.js"></script>"#;

pub(crate) fn apply_html_injection_cache_headers(headers: &mut HeaderMap) {
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store, no-cache, must-revalidate, proxy-revalidate"),
    );
    headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
    headers.remove(header::EXPIRES);
}

/// Injects the inspector script before `</body>` (UTF-8 first, then byte-level fallback).
pub(crate) fn inject_inspector_script(mut body: Vec<u8>) -> Vec<u8> {
    let injection_script = INSPECTOR_INJECTION_SCRIPT;

    let mut injected = false;
    if let Ok(body_str) = String::from_utf8(body.clone()) {
        let body_lower = body_str.to_lowercase();
        if body_lower.contains("</body>") && !body_str.contains("wt-injection-marker") {
            if let Some(pos) = body_lower.rfind("</body>") {
                let mut new_body = body_str[..pos].to_string();
                new_body.push_str(injection_script);
                new_body.push_str(&body_str[pos..]);
                body = new_body.into_bytes();
                injected = true;
                crate::proxy_log!("✅ [Watchtower] Inspector injected (UTF-8).");
            }
        }
    }

    if !injected {
        let pattern = b"</body>";
        let marker = b"wt-injection-marker";
        if !body.windows(marker.len()).any(|w| w == marker) {
            if let Some(pos) = body
                .windows(pattern.len())
                .rposition(|w: &[u8]| w.eq_ignore_ascii_case(pattern))
            {
                let mut new_bytes = Vec::with_capacity(body.len() + injection_script.len());
                new_bytes.extend_from_slice(&body[..pos]);
                new_bytes.extend_from_slice(injection_script.as_bytes());
                new_bytes.extend_from_slice(&body[pos..]);
                body = new_bytes;
                crate::proxy_log!("✅ [Watchtower] Inspector injected (Byte-level).");
            }
        }
    }

    body
}

pub(crate) fn should_inject_for_host(state: &Arc<ProxyState>, host: &str) -> bool {
    if !is_inspector_enabled() {
        return false;
    }
    let domains = state.inspector_service.get_injection_domains();
    if domains.is_empty() {
        return true;
    }
    let host_key = host_key_for_logging_map(host);
    domains.iter().any(|d| {
        let d_lower = d.to_lowercase();
        host_key == d_lower || host_key.ends_with(&format!(".{d_lower}"))
    })
}
