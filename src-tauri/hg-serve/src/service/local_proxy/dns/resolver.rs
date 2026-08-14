use crate::model::proxy_settings::DnsZoneRecord;
use hickory_resolver::config::{NameServerConfigGroup, ResolverConfig};
use hickory_resolver::name_server::TokioConnectionProvider;
use hickory_resolver::Resolver;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpStream;

use crate::service::local_proxy::routing::{host_key_for_logging_map, host_matches_key};

pub(crate) type TokioResolver = Resolver<TokioConnectionProvider>;

/// Parse "8.8.8.8" or "8.8.8.8:53" into (`IpAddr`, port). Returns None if invalid.
pub(crate) fn parse_dns_server(s: &str) -> Option<(IpAddr, u16)> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    if let Some((ip_str, port_str)) = s.split_once(':') {
        let ip: IpAddr = ip_str.trim().parse().ok()?;
        let port: u16 = port_str.trim().parse().ok()?;
        Some((ip, port))
    } else {
        let ip: IpAddr = s.parse().ok()?;
        Some((ip, 53))
    }
}

pub(crate) fn build_resolver(dns_server: &str) -> Option<Arc<TokioResolver>> {
    let (ip, port) = parse_dns_server(dns_server)?;
    let config = ResolverConfig::from_parts(
        None,
        vec![],
        NameServerConfigGroup::from_ips_clear(&[ip], port, true),
    );
    let r = Resolver::builder_with_config(config, TokioConnectionProvider::default()).build();
    Some(Arc::new(r))
}

/// Resolve hostname to an IPv4 or IPv6 address using the configured resolver. Returns first IP.
pub(crate) async fn resolve_host_via_dns(resolver: &TokioResolver, host: &str) -> Option<IpAddr> {
    let lookup = resolver.lookup_ip(host).await.ok()?;
    lookup.iter().next()
}

fn find_zone_record<'a>(records: &'a [DnsZoneRecord], host: &str) -> Option<&'a DnsZoneRecord> {
    let key = host_key_for_logging_map(host);
    records
        .iter()
        .filter(|r| host_matches_key(&key, &r.host))
        .max_by_key(|r| r.host.len())
}

/// Zone A record, following CNAME within the zone when possible.
pub(crate) fn lookup_zone_ip(records: &[DnsZoneRecord], host: &str) -> Option<IpAddr> {
    lookup_zone_ip_inner(records, host, 0)
}

fn lookup_zone_ip_inner(records: &[DnsZoneRecord], host: &str, depth: u8) -> Option<IpAddr> {
    if depth > 8 {
        return None;
    }
    let rec = find_zone_record(records, host)?;
    match rec.record_type.to_ascii_uppercase().as_str() {
        "CNAME" => lookup_zone_ip_inner(records, rec.value.trim(), depth + 1),
        _ => rec.value.trim().parse().ok(),
    }
}

pub(crate) fn lookup_zone_cname<'a>(records: &'a [DnsZoneRecord], host: &str) -> Option<&'a str> {
    let rec = find_zone_record(records, host)?;
    if rec.record_type.eq_ignore_ascii_case("CNAME") {
        Some(rec.value.trim())
    } else {
        None
    }
}

trait ToSocketAddr {
    fn to_socket_addr(&self) -> std::io::Result<SocketAddr>;
}
impl ToSocketAddr for (&str, u16) {
    fn to_socket_addr(&self) -> std::io::Result<SocketAddr> {
        use std::net::ToSocketAddrs;
        let (host, port) = *self;
        let mut addrs = (host, port).to_socket_addrs()?;
        addrs.next().ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::NotFound, "could not resolve host")
        })
    }
}

/// Connect to host:port. Zone records win when DNS capture is on, then the configured resolver.
pub(crate) async fn connect_for_connect(
    host: &str,
    port: u16,
    resolver: Option<&Arc<TokioResolver>>,
    zone: &[DnsZoneRecord],
    dns_capture: bool,
    timeout: Duration,
) -> std::io::Result<TcpStream> {
    let connect = async {
        let mut resolve_host = host.to_string();
        if dns_capture {
            if let Some(ip) = lookup_zone_ip(zone, host) {
                return TcpStream::connect(SocketAddr::new(ip, port)).await;
            }
            if let Some(cname) = lookup_zone_cname(zone, host) {
                resolve_host = cname.to_string();
            }
        }
        let addr = if let Some(r) = resolver {
            if let Some(ip) = resolve_host_via_dns(r, &resolve_host).await {
                SocketAddr::new(ip, port)
            } else {
                (resolve_host.as_str(), port)
                    .to_socket_addr()
                    .map_err(std::io::Error::other)?
            }
        } else {
            (resolve_host.as_str(), port)
                .to_socket_addr()
                .map_err(std::io::Error::other)?
        };
        TcpStream::connect(addr).await
    };
    match tokio::time::timeout(timeout, connect).await {
        Ok(result) => result,
        Err(_) => Err(std::io::Error::new(
            std::io::ErrorKind::TimedOut,
            format!("connect to {host}:{port} timed out"),
        )),
    }
}
