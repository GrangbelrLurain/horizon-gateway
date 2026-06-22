use super::super::resolver::parse_dns_server;

#[test]
fn parse_dns_server_ip_only() {
    let (ip, port) = parse_dns_server("8.8.8.8").unwrap();
    assert_eq!(port, 53);
    assert!(ip.to_string() == "8.8.8.8");
}

#[test]
fn parse_dns_server_with_port() {
    let (ip, port) = parse_dns_server("8.8.4.4:5353").unwrap();
    assert_eq!(port, 5353);
    assert!(ip.to_string() == "8.8.4.4");
}
