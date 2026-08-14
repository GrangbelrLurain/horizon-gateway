use std::sync::Arc;
use tokio::net::TcpStream;

use super::decrypt::handle_connect_tunnel_decrypted;
use super::local::handle_connect_tunnel_local;
use super::passthrough::handle_connect_passthrough;
use super::super::routing::{host_in_list, resolve_connect_target};
use super::super::state::ProxyState;

pub(crate) async fn handle_connect_tunnel(
    client: TcpStream,
    host: String,
    port: u16,
    state: Arc<ProxyState>,
    header_buf: Vec<u8>,
) {
    crate::proxy_log!("CONNECT {}:{}", host, port);

    let settings = state.proxy_settings.get();
    if host_in_list(&host, &settings.tls_bypass_hosts) {
        crate::proxy_log!("-> CONNECT TLS bypass for {}", host);
        handle_connect_passthrough(
            client,
            &host,
            port,
            state.resolver.as_ref(),
            header_buf,
            &state,
        )
        .await;
        return;
    }

    if host_in_list(&host, &settings.https_decrypt_hosts) {
        crate::proxy_log!("-> CONNECT decryption enabled for {}", host);
        handle_connect_tunnel_decrypted(client, host, state).await;
        return;
    }

    let routes = state.route_service.get_enabled();
    if let Some((target_host, target_port)) = resolve_connect_target(&host, &routes) {
        crate::proxy_log!("-> CONNECT local route -> {}:{}", target_host, target_port);
        handle_connect_tunnel_local(client, target_host, target_port, host, state, header_buf)
            .await;
        return;
    }

    crate::proxy_log!("-> CONNECT pass-through (upstream)");
    handle_connect_passthrough(
        client,
        &host,
        port,
        state.resolver.as_ref(),
        header_buf,
        &state,
    )
    .await;
}
