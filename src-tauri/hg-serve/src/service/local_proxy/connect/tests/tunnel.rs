use crate::model::proxy_settings::default_tls_bypass_hosts;
use crate::service::local_proxy::routing::host_in_list;

#[test]
fn default_bypass_covers_captive_and_sso() {
    let list = default_tls_bypass_hosts();
    assert!(host_in_list("clients3.google.com", &list));
    assert!(host_in_list("login.microsoftonline.com", &list));
    assert!(!host_in_list("example.com", &list));
}
