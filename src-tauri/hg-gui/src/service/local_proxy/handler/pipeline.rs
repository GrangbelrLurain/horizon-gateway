use axum::{
    extract::{Request, State},
    http::{StatusCode, Uri},
    response::{IntoResponse, Response},
};
use std::sync::Arc;

use crate::service::local_proxy::flags::is_local_routing_enabled;

use super::api::try_handle_api;
use super::capture::handle_with_logging;
use super::forward::handle_pass_through;
use super::mocking::try_mock_response;
use super::super::routing::{get_logging_config_for_host, host_key_for_logging_map, resolve_target};
use super::super::state::ProxyState;
use super::websocket::{handle_websocket_upgrade, is_websocket_upgrade};

pub(crate) async fn proxy_handler_inner(
    State(state): State<Arc<ProxyState>>,
    axum::Extension(scheme): axum::Extension<&'static str>,
    req: Request,
) -> Response {
    let method = req.method().to_string();
    let uri = req.uri().clone();
    let path = uri.path();

    let mut req = match try_handle_api(&state, req, path, &uri).await {
        Ok(response) => return response,
        Err(r) => r,
    };

    let host_h = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok())
        .map(std::string::ToString::to_string)
        .unwrap_or_default();
    crate::proxy_log!("request {} {} Host: {}", method, uri, host_h);

    if let Some(response) = try_mock_response(&state, &req, &method, &uri, path, &host_h) {
        return response;
    }

    let host_header = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok())
        .map(std::string::ToString::to_string);
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

    let host_key = host_key_for_logging_map(&host_h);
    let logging_config = state
        .api_logging_map
        .read()
        .ok()
        .and_then(|map| get_logging_config_for_host(&map, &host_key));

    let (logging_enabled, body_enabled) = logging_config.unwrap_or((false, false));

    if is_websocket_upgrade(&req) {
        return handle_websocket_upgrade(
            &state,
            req,
            local_origin.as_ref(),
            &target_uri,
            &target_uri_str,
            &host_h,
            &uri,
        )
        .await;
    }

    if logging_enabled {
        handle_with_logging(
            &state,
            req,
            &target_uri_str,
            path,
            &host_h,
            scheme,
            local_origin.as_ref(),
            body_enabled,
        )
        .await
    } else {
        handle_pass_through(
            &state,
            req,
            &target_uri_str,
            path,
            &host_h,
            scheme,
            local_origin.as_ref(),
        )
        .await
    }
}
