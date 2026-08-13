use super::super::tunnel::is_system_connectivity_domain;

#[test]
fn system_connectivity_domains() {
    assert!(is_system_connectivity_domain("clients3.google.com"));
    assert!(!is_system_connectivity_domain("example.com"));
}
