use hickory_resolver::config::{NameServerConfigGroup, ResolverConfig};
use hickory_resolver::name_server::TokioConnectionProvider;
use hickory_resolver::Resolver;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use tokio::net::TcpStream;

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
// ToSocketAddr for (host, port)
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
/// Connect to host:port. If resolver is set, resolve host via DNS first.
pub(crate) async fn connect_for_connect(
    host: &str,
    port: u16,
    resolver: Option<&Arc<TokioResolver>>,
) -> std::io::Result<TcpStream> {
    let addr = if let Some(r) = resolver {
        if let Some(ip) = resolve_host_via_dns(r, host).await {
            SocketAddr::new(ip, port)
        } else {
            (host, port)
                .to_socket_addr()
                .map_err(std::io::Error::other)?
        }
    } else {
        (host, port)
            .to_socket_addr()
            .map_err(std::io::Error::other)?
    };
    TcpStream::connect(addr).await
}
