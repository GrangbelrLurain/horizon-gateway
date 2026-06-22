use super::super::paths::build_pac_js;

#[test]
fn build_pac_js_contains_proxy() {
    let pac = build_pac_js("127.0.0.1", 8080);
    assert!(pac.contains("127.0.0.1"));
    assert!(pac.contains("8080"));
}
