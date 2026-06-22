use std::sync::Arc;

use crate::service::local_proxy::flags::is_inspector_enabled;

use super::super::routing::host_key_for_logging_map;
use super::super::state::ProxyState;

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
