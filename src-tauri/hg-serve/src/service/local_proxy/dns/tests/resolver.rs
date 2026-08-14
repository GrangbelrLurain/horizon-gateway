use super::super::resolver::{lookup_zone_ip, parse_dns_server};
use crate::model::proxy_settings::DnsZoneRecord;

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

#[test]
fn zone_a_record_wins() {
    let records = vec![DnsZoneRecord {
        host: "dev.local".to_string(),
        record_type: "A".to_string(),
        value: "10.0.0.9".to_string(),
    }];
    assert_eq!(
        lookup_zone_ip(&records, "dev.local").unwrap().to_string(),
        "10.0.0.9"
    );
}

#[test]
fn zone_cname_follows_a() {
    let records = vec![
        DnsZoneRecord {
            host: "app.dev".to_string(),
            record_type: "CNAME".to_string(),
            value: "origin.dev".to_string(),
        },
        DnsZoneRecord {
            host: "origin.dev".to_string(),
            record_type: "A".to_string(),
            value: "127.0.0.1".to_string(),
        },
    ];
    assert_eq!(
        lookup_zone_ip(&records, "app.dev").unwrap().to_string(),
        "127.0.0.1"
    );
}
