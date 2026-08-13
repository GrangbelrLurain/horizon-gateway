use super::super::stream::parse_connect_target;

#[test]
fn parse_connect_target_basic() {
    let (host, port) = parse_connect_target("CONNECT example.com:443 HTTP/1.1").unwrap();
    assert_eq!(host, "example.com");
    assert_eq!(port, 443);
}
