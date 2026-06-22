pub(crate) fn is_system_connectivity_domain(host: &str) -> bool {
    let h = host.to_lowercase();
    h.contains("connectivitycheck")
        || h.contains("captiveportal")
        || h.contains("captive.apple.com")
        || h == "clients3.google.com"
        || h == "detectportal.firefox.com"
        || h == "msftconnecttest.com"
        || h == "msftncsi.com"
}


use std::sync::Arc;
use tokio::net::TcpStream;

use crate::service::local_proxy::flags::is_inspector_enabled;
use crate::service::local_proxy::flags::is_local_routing_enabled;

use super::decrypt::handle_connect_tunnel_decrypted;
use super::local::handle_connect_tunnel_local;
use super::passthrough::handle_connect_passthrough;
use super::super::routing::{get_logging_config_for_host, host_key_for_logging_map, resolve_connect_target};
use super::super::state::ProxyState;

pub(crate) async fn handle_connect_tunnel(
    client: TcpStream,
    host: String,
    port: u16,
    state: Arc<ProxyState>,
    header_buf: Vec<u8>,
) {
    crate::proxy_log!("CONNECT {}:{}", host, port);

    // 1. API Logging check FIRST
    let key = host_key_for_logging_map(&host);
    let use_api_logging = {
        let map_read = state.api_logging_map.read().ok();
        let config = map_read
            .as_ref()
            .and_then(|map| get_logging_config_for_host(map, &key));
        crate::proxy_log!(
            "[matching] host: {}, key: {}, found_in_map: {}",
            host,
            key,
            config.is_some()
        );
        config.is_some_and(|(logging_enabled, _)| logging_enabled)
    };

    // 2. Selective Decryption for Inspector/Injection
    let is_connectivity = is_system_connectivity_domain(&host);
    let should_decrypt = !is_connectivity && (use_api_logging || {
        if is_inspector_enabled() {
            let domains = state.inspector_service.get_injection_domains();
            if domains.is_empty() {
                true // No domains registered -> Apply globally
            } else {
                // Match host or subdomains
                domains
                    .iter()
                    .any(|d| host == *d || host.ends_with(&format!(".{d}")))
            }
        } else {
            false
        }
    });

    if should_decrypt {
        // Decrypt for API Logging or Inspector
        crate::proxy_log!("-> CONNECT decryption enabled for {}", host);
        handle_connect_tunnel_decrypted(client, host, state).await;
        return;
    }

    let routes = if is_local_routing_enabled() {
        state.route_service.get_enabled()
    } else {
        vec![]
    };
    if let Some((target_host, target_port)) = resolve_connect_target(&host, &routes) {
        crate::proxy_log!("-> CONNECT local route -> {}:{}", target_host, target_port);
        handle_connect_tunnel_local(client, target_host, target_port, host, state, header_buf)
            .await;
        return;
    }

    crate::proxy_log!("-> CONNECT pass-through (upstream)");
    handle_connect_passthrough(client, &host, port, state.resolver.as_ref(), header_buf).await;
}
