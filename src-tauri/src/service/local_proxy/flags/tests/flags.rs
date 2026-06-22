use crate::service::local_proxy::flags::{
    is_local_routing_enabled, set_local_routing_enabled,
};

#[test]
fn local_routing_toggle() {
    set_local_routing_enabled(true);
    assert!(is_local_routing_enabled());
    set_local_routing_enabled(false);
    assert!(!is_local_routing_enabled());
    set_local_routing_enabled(true);
    assert!(is_local_routing_enabled());
}
