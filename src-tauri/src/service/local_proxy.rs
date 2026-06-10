//! Local HTTP proxy: Host-based routing to local backends.
//! Listens on 127.0.0.1:port. When client uses this as HTTP proxy,
//! requests are forwarded; if Host matches a route, target is local host:port.
//! When no route matches, the host can be resolved via an optional DNS server before forwarding.
//! CONNECT (HTTPS) is supported: for local routes we do TLS termination and forward HTTP to localhost;
//! for pass-through we establish a tunnel to the target.

use axum::{
    body::Body,
    extract::{Request, State},
    http::{
        header::{self, HeaderMap, HeaderValue, CONTENT_TYPE},
        uri::Uri,
    },
    response::{Html, IntoResponse, Response},
    routing::any,
    Router,
};
use hickory_resolver::config::{NameServerConfigGroup, ResolverConfig};
use hickory_resolver::name_server::TokioConnectionProvider;
use hickory_resolver::Resolver;
use hyper::server::conn::http1::Builder as Http1Builder;
use hyper::StatusCode;

use futures::TryStreamExt;

use hyper_util::rt::TokioIo;
use hyper_util::service::TowerToHyperService;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::server::{ClientHello, ResolvesServerCert};
use rustls::sign::CertifiedKey;
use std::collections::HashMap;
use std::io::Cursor;
use std::net::{IpAddr, SocketAddr};
use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
use std::sync::{Arc, RwLock};
use std::task::{Context, Poll};
use time::OffsetDateTime;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, ReadBuf};
use tokio::net::TcpStream;
use tokio::task::JoinHandle;
use tokio_rustls::TlsAcceptor;

use crate::model::local_route::LocalRoute;
use crate::service::local_route_service::LocalRouteService;

macro_rules! proxy_log {
    ($($t:tt)*) => { tracing::info!("[proxy] {}", format!($($t)*)) }
}

type TokioResolver = Resolver<TokioConnectionProvider>;

// ── Local routing toggle ───────────────────────────────────────────────
/// Global flag: when `false` the proxy still runs but passes all traffic through
/// without matching local routes (pure pass-through mode).
static LOCAL_ROUTING_ENABLED: AtomicBool = AtomicBool::new(true);
static MOCKING_ENABLED: AtomicBool = AtomicBool::new(true);
static INSPECTOR_ENABLED: AtomicBool = AtomicBool::new(false);

pub fn is_local_routing_enabled() -> bool {
    LOCAL_ROUTING_ENABLED.load(AtomicOrdering::Relaxed)
}

pub fn set_local_routing_enabled(enabled: bool) {
    LOCAL_ROUTING_ENABLED.store(enabled, AtomicOrdering::Relaxed);
}

pub fn is_mocking_enabled() -> bool {
    MOCKING_ENABLED.load(AtomicOrdering::Relaxed)
}

pub fn set_mocking_enabled(enabled: bool) {
    MOCKING_ENABLED.store(enabled, AtomicOrdering::Relaxed);
}

pub fn is_inspector_enabled() -> bool {
    INSPECTOR_ENABLED.load(AtomicOrdering::Relaxed)
}

pub fn set_inspector_enabled(enabled: bool) {
    INSPECTOR_ENABLED.store(enabled, AtomicOrdering::Relaxed);
}

fn should_inject_for_host(state: &Arc<ProxyState>, host: &str) -> bool {
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
        host_key == d_lower || host_key.ends_with(&format!(".{}", d_lower))
    })
}

/// Parse "8.8.8.8" or "8.8.8.8:53" into (`IpAddr`, port). Returns None if invalid.
fn parse_dns_server(s: &str) -> Option<(IpAddr, u16)> {
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

use crate::model::api_log::ApiLogEntry;
use crate::model::inspector::Annotation;
use crate::service::api_log_service::ApiLogService;
use crate::service::ca_service::CaService;

use tauri::{Emitter, Manager};

pub struct ProxyState {
    pub app_handle: tauri::AppHandle,
    route_service: Arc<LocalRouteService>,
    resolver: Option<Arc<TokioResolver>>,
    pub forward_proxy_port: Option<u16>,
    cert_cache: Arc<HostCertCache>,
    /// 호스트(소문자) → (logging_enabled, body_enabled). API 로깅 대상이면 CONNECT 시 TLS 종료 후 proxy_app으로.
    pub api_logging_map: Arc<RwLock<HashMap<String, (bool, bool)>>>,
    pub api_log_service: Arc<ApiLogService>,
    pub ca_service: Arc<CaService>,
    pub reqwest_client: reqwest::Client,
    /// Dedicated client for pass-through that might need custom DNS resolution to avoid infinite loops if system proxy is set to this app.
    pub reqwest_client_direct: reqwest::Client,
    pub mocking_service: Arc<crate::service::mocking_service::MockingService>,
    pub inspector_service: Arc<crate::service::inspector_service::InspectorService>,
}

impl ProxyState {
    fn new(
        app_handle: tauri::AppHandle,
        route_service: Arc<LocalRouteService>,
        dns_server: Option<String>,
        forward_proxy_port: Option<u16>,
        api_logging_map: Arc<RwLock<HashMap<String, (bool, bool)>>>,
        api_log_service: Arc<ApiLogService>,
        ca_service: Arc<CaService>,
        mocking_service: Arc<crate::service::mocking_service::MockingService>,
        inspector_service: Arc<crate::service::inspector_service::InspectorService>,
    ) -> Self {
        let resolver = dns_server
            .as_ref()
            .and_then(|s| parse_dns_server(s))
            .map(|(ip, port)| {
                let config = ResolverConfig::from_parts(
                    None,
                    vec![],
                    NameServerConfigGroup::from_ips_clear(&[ip], port, true),
                );
                let r = Resolver::builder_with_config(config, TokioConnectionProvider::default())
                    .build();
                Arc::new(r)
            });
        Self {
            app_handle,
            route_service,
            resolver,
            forward_proxy_port,
            cert_cache: Arc::new(HostCertCache::new(ca_service.clone())),
            api_logging_map,
            api_log_service,
            ca_service,
            reqwest_client: reqwest::Client::builder()
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
                .gzip(true)
                .brotli(true)
                .build()
                .unwrap(),
            reqwest_client_direct: reqwest::Client::builder()
                .no_proxy() // Crucial: avoid using system proxy for pass-through to prevent infinite loops
                .redirect(reqwest::redirect::Policy::none())
                .gzip(true)
                .brotli(true)
                .build()
                .unwrap(),
            mocking_service,
            inspector_service,
        }
    }
}

fn host_key_for_logging_map(host: &str) -> String {
    let host = host.trim();
    if host.starts_with('[') {
        if let Some(end) = host.rfind(']') {
            return host[0..=end].to_lowercase();
        }
    }
    host.split(':').next().unwrap_or(host).to_lowercase()
}

/// 로깅 설정 조회. 정확 일치 후 서브도메인 매칭(host.ends_with("." + key)); 여러 매칭 시 가장 긴 키 사용.
fn get_logging_config_for_host(
    map: &std::sync::RwLockReadGuard<'_, HashMap<String, (bool, bool)>>,
    host_key: &str,
) -> Option<(bool, bool)> {
    if let Some(cfg) = map.get(host_key) {
        return Some(*cfg);
    }
    let mut best: Option<(String, (bool, bool))> = None;
    for (key, cfg) in map.iter() {
        if key.is_empty() {
            continue;
        }
        if *host_key == *key || host_key.ends_with(&format!(".{}", key)) {
            if best.as_ref().map(|(k, _)| k.len()).unwrap_or(0) < key.len() {
                best = Some((key.clone(), *cfg));
            }
        }
    }
    best.map(|(_, cfg)| cfg)
}

/// Extract hostname from route domain: "<https://dev.modetour.local>/" -> "dev.modetour.local", "dev.modetour.local" -> "dev.modetour.local".
fn route_domain_to_host(domain: &str) -> &str {
    let domain = domain.trim();
    if let Some(after) = domain
        .strip_prefix("https://")
        .or_else(|| domain.strip_prefix("http://"))
    {
        let host_part = after.split('/').next().unwrap_or(after).trim();
        let host_only = host_part.split(':').next().unwrap_or(host_part).trim();
        return if host_only.is_empty() {
            domain
        } else {
            host_only
        };
    }
    let host_only = domain.split(':').next().unwrap_or(domain).trim();
    if host_only.is_empty() {
        domain
    } else {
        host_only
    }
}

/// True if route domain is scheme-specific (e.g. "https://..."). Used to prefer scheme-specific routes.
fn route_domain_scheme(domain: &str) -> Option<&'static str> {
    let d = domain.trim();
    if d.starts_with("https://") {
        return Some("https");
    }
    if d.starts_with("http://") {
        return Some("http");
    }
    None
}

/// (`target_uri_string`, `pass_through_host`, `target_host_header`, `local_origin`).
/// When local route matches, `local_origin` = `Some((target_host`, `target_port`, `path_and_query`))
/// so we can connect directly and send request in origin-form (GET /path HTTP/1.1).
/// Route domain can be hostname (dev.modetour.local) or URL (<https://dev.modetour.local>/); we match by host.
fn resolve_target(
    uri: &Uri,
    host_from_header: Option<&str>,
    routes: &[crate::model::local_route::LocalRoute],
    connection_scheme: &str,
) -> (
    String,
    Option<String>,
    Option<String>,
    Option<(String, u16, String)>,
) {
    let host = uri
        .authority()
        .map(axum::http::uri::Authority::host)
        .or(host_from_header)
        .unwrap_or("");
    let host_no_port = host.split(':').next().unwrap_or(host).trim();

    let path_query = uri
        .path_and_query()
        .map_or("/", axum::http::uri::PathAndQuery::as_str);
    let request_scheme = uri.scheme_str().unwrap_or(connection_scheme);

    // Collect matching routes (by normalized host); prefer scheme-specific (https for https request, etc.)
    let mut best: Option<&LocalRoute> = None;
    for r in routes {
        if !r.enabled {
            continue;
        }
        let route_host = route_domain_to_host(r.domain.as_str());
        if !route_host.eq_ignore_ascii_case(host_no_port) {
            continue;
        }
        let route_scheme = route_domain_scheme(r.domain.as_str());
        match (best, route_scheme) {
            (None, _) => best = Some(r),
            (Some(_prev), None) => { /* keep prev (more specific) */ }
            (Some(prev), Some(rs)) => {
                let prev_scheme = route_domain_scheme(prev.domain.as_str());
                if prev_scheme.is_none() && rs == request_scheme {
                    best = Some(r); // prefer scheme-specific match
                } else if prev_scheme == Some(request_scheme) && rs != request_scheme {
                    /* keep prev */
                } else if rs == request_scheme {
                    best = Some(r);
                }
            }
        }
    }
    if let Some(r) = best {
        let path = path_query.to_string();
        return (
            format!("http://{}:{}{}", r.target_host, r.target_port, path_query),
            None,
            Some(r.target_host.clone()),
            Some((r.target_host.clone(), r.target_port, path)),
        );
    }

    // No hosts file: when Host is 127.0.0.1 or localhost, use first enabled route so
    // browser can open http://127.0.0.1:reverse_port and get the local app (which can show settings).
    let host_no_port = host.split(':').next().unwrap_or(host).trim();
    if (host_no_port.eq_ignore_ascii_case("127.0.0.1")
        || host_no_port.eq_ignore_ascii_case("localhost"))
        && !host_no_port.is_empty()
    {
        if let Some(r) = routes.iter().find(|r| r.enabled) {
            let path = path_query.to_string();
            return (
                format!("http://{}:{}{}", r.target_host, r.target_port, path_query),
                None,
                Some(r.target_host.clone()),
                Some((r.target_host.clone(), r.target_port, path)),
            );
        }
    }

    // Pass-through
    let target = if uri.scheme().is_some() && uri.authority().is_some() {
        uri.to_string()
    } else if let Some(h) = host_from_header {
        let scheme = uri.scheme_str().unwrap_or(connection_scheme);
        let host_part = h.trim_end_matches('/');
        let path_part = if path_query.starts_with('/') {
            path_query
        } else {
            &format!("/{}", path_query)
        };
        format!("{scheme}://{host_part}{path_part}")
    } else {
        let host_part = host.trim_end_matches('/');
        let path_part = if path_query.starts_with('/') {
            path_query
        } else {
            &format!("/{}", path_query)
        };
        format!("{connection_scheme}://{host_part}{path_part}")
    };
    (target, Some(host.to_string()), None, None)
}

/// For CONNECT host:port, if host matches a local route return `Some((target_host`, `target_port`)).
/// CONNECT is always HTTPS; prefer route whose domain is "https://..." when multiple match.
fn resolve_connect_target(host: &str, routes: &[LocalRoute]) -> Option<(String, u16)> {
    let host_no_port = host.split(':').next().unwrap_or(host).trim();
    let mut best: Option<&LocalRoute> = None;
    for r in routes {
        if !r.enabled {
            continue;
        }
        let route_host = route_domain_to_host(r.domain.as_str());
        if !route_host.eq_ignore_ascii_case(host_no_port) {
            continue;
        }
        let route_scheme = route_domain_scheme(r.domain.as_str());
        match (best, route_scheme) {
            (None, _) => best = Some(r),
            (Some(_prev), None) => { /* keep prev */ }
            (Some(prev), Some(rs)) => {
                let prev_scheme = route_domain_scheme(prev.domain.as_str());
                if rs == "https" && prev_scheme != Some("https") {
                    best = Some(r); // prefer https-specific for CONNECT
                } else if prev_scheme == Some("https") && rs != "https" {
                    /* keep prev */
                } else {
                    best = Some(r);
                }
            }
        }
    }
    best.map(|r| (r.target_host.clone(), r.target_port))
}

/// Shared cache: same cert per host for both TLS and download (so installing the downloaded cert trusts the server).
struct HostCertCache {
    inner: std::sync::Mutex<HashMap<String, (Arc<CertifiedKey>, String)>>,
    ca_service: Arc<CaService>,
}

impl HostCertCache {
    fn new(ca_service: Arc<CaService>) -> Self {
        Self {
            inner: std::sync::Mutex::new(HashMap::new()),
            ca_service,
        }
    }

    /// Get or create (`CertifiedKey` for TLS, PEM for download). Same cert is used for both.
    /// Uses host as CN and reasonable validity (not 1975) so OS/browsers don't show extra warnings.
    fn get_or_create(&self, host: &str) -> Option<(Arc<CertifiedKey>, String)> {
        {
            let g = self.inner.lock().ok()?;
            if let Some((ck, pem)) = g.get(host) {
                return Some((Arc::clone(ck), pem.clone()));
            }
        }

        let (cert, key_pair) = self.ca_service.sign_host_certificate(host).ok()?;
        let pem = cert.pem();
        let cert_der = CertificateDer::from(cert.der().as_ref().to_vec());
        let key_der = key_pair.serialize_der();
        let private_key = PrivateKeyDer::try_from(key_der).ok()?;
        let provider = rustls::crypto::ring::default_provider();
        let signer = provider.key_provider.load_private_key(private_key).ok()?;
        let ck = Arc::new(CertifiedKey::new(vec![cert_der], signer));

        {
            let mut g = self.inner.lock().ok()?;
            g.entry(host.to_string())
                .or_insert_with(|| (Arc::clone(&ck), pem.clone()));
            let (ck, pem) = g.get(host).unwrap();
            Some((Arc::clone(ck), pem.clone()))
        }
    }
}

/// Dynamic certificate resolver: uses shared `HostCertCache` so TLS and download serve the same cert.
struct DynamicCertResolver {
    cache: Arc<HostCertCache>,
}

impl std::fmt::Debug for DynamicCertResolver {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DynamicCertResolver")
            .finish_non_exhaustive()
    }
}

impl ResolvesServerCert for DynamicCertResolver {
    fn resolve(&self, client_hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
        let name = client_hello.server_name()?;
        let name_str = name.to_string();
        self.cache.get_or_create(&name_str).map(|(ck, _)| ck)
    }
}

/// Resolve hostname to an IPv4 or IPv6 address using the configured resolver. Returns first IP.
async fn resolve_host_via_dns(resolver: &TokioResolver, host: &str) -> Option<IpAddr> {
    let lookup = resolver.lookup_ip(host).await.ok()?;
    lookup.iter().next()
}

/// Wraps a `TcpStream` with a prepended buffer (e.g. first HTTP request) for re-injection.
struct PrependIo {
    buf: Cursor<Vec<u8>>,
    stream: TcpStream,
}

impl PrependIo {
    fn new(buf: Vec<u8>, stream: TcpStream) -> Self {
        Self {
            buf: Cursor::new(buf),
            stream,
        }
    }
}

impl AsyncRead for PrependIo {
    fn poll_read(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        let buf_len = self.buf.get_ref().len();
        let pos = self.buf.position();
        if pos < buf_len as u64 {
            let remain = (buf_len as u64 - pos) as usize;
            let n = remain.min(buf.remaining());
            let start = pos as usize;
            buf.put_slice(&self.buf.get_ref()[start..start + n]);
            self.buf.set_position(pos + n as u64);
            return Poll::Ready(Ok(()));
        }
        AsyncRead::poll_read(std::pin::Pin::new(&mut self.stream), cx, buf)
    }
}

impl AsyncWrite for PrependIo {
    fn poll_write(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        AsyncWrite::poll_write(std::pin::Pin::new(&mut self.stream), cx, buf)
    }
    fn poll_flush(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        AsyncWrite::poll_flush(std::pin::Pin::new(&mut self.stream), cx)
    }
    fn poll_shutdown(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        AsyncWrite::poll_shutdown(std::pin::Pin::new(&mut self.stream), cx)
    }
}

const MAX_HEADER_LEN: usize = 8192;

/// Read from stream until \r\n\r\n or max size. Returns the buffer.
async fn read_request_headers(stream: &mut TcpStream) -> std::io::Result<Vec<u8>> {
    let mut buf = Vec::with_capacity(1024);
    let mut search = 0usize;
    loop {
        if buf.len() >= MAX_HEADER_LEN {
            break Ok(buf);
        }
        let mut tmp = [0u8; 256];
        let n = AsyncReadExt::read(stream, &mut tmp).await?;
        if n == 0 {
            break Ok(buf);
        }
        buf.extend_from_slice(&tmp[..n]);
        while search + 3 < buf.len() {
            if buf[search] == b'\r'
                && buf[search + 1] == b'\n'
                && buf[search + 2] == b'\r'
                && buf[search + 3] == b'\n'
            {
                return Ok(buf);
            }
            search += 1;
        }
    }
}

/// Parse first line for CONNECT: "CONNECT host:port HTTP/1.x" -> (host, port).
fn parse_connect_target(first_line: &str) -> Option<(String, u16)> {
    let first_line = first_line.trim();
    if !first_line.to_uppercase().starts_with("CONNECT ") {
        return None;
    }
    let rest = first_line
        .strip_prefix("CONNECT ")
        .unwrap_or(first_line)
        .trim();
    let authority = rest.split_whitespace().next()?;
    let (host, port_str) = authority.split_once(':').unwrap_or((authority, "443"));
    let port: u16 = port_str.parse().ok().unwrap_or(443);
    Some((host.to_string(), port))
}

/// Connect to host:port. If resolver is set, resolve host via DNS first.
async fn connect_for_connect(
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

/// TLS-terminate CONNECT and forward HTTP to local backend.
/// Sends `original_host` (e.g. dev.modetour.local) so backend that expects that Host returns 200.
async fn handle_connect_tunnel_local(
    mut client: TcpStream,
    target_host: String,
    target_port: u16,
    original_host: String,
    state: Arc<ProxyState>,
    header_buf: Vec<u8>,
) {
    let response = b"HTTP/1.1 200 Connection Established\r\n\r\n";
    if client.write_all(response).await.is_err() {
        return;
    }
    let body_start = header_buf
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .map_or(header_buf.len(), |i| i + 4);
    let prepend = if body_start < header_buf.len() {
        header_buf[body_start..].to_vec()
    } else {
        vec![]
    };
    let config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_cert_resolver(Arc::new(DynamicCertResolver {
            cache: Arc::clone(&state.cert_cache),
        }));
    let acceptor = TlsAcceptor::from(Arc::new(config));
    let tls_stream = match acceptor.accept(PrependIo::new(prepend, client)).await {
        Ok(s) => s,
        Err(e) => {
            let msg = format!("{e:?}");
            if msg.contains("CertificateUnknown") || msg.contains("AlertReceived") {
                proxy_log!("TLS failed: client rejected our certificate (use -k with curl, or install CA from setup page)");
            } else {
                proxy_log!("TLS accept failed: {}", msg);
            }
            return;
        }
    };
    proxy_log!(
        "CONNECT local: TLS done, forwarding to {}:{} (Host: {})",
        target_host,
        target_port,
        original_host
    );
    let io = TokioIo::new(tls_stream);
    let app = proxy_app(Arc::clone(&state), "https");
    let svc = TowerToHyperService::new(app);
    let _ = Http1Builder::new().serve_connection(io, svc).await.ok();
}

/// API 로깅: CONNECT 대상을 TLS 종료한 뒤 proxy_app으로 HTTP 전달 (로깅·포워드 가능).
async fn handle_connect_tunnel_decrypted(
    mut client: TcpStream,
    _host: String,
    state: Arc<ProxyState>,
) {
    let response = b"HTTP/1.1 200 Connection Established\r\n\r\n";
    if client.write_all(response).await.is_err() {
        return;
    }
    if client.flush().await.is_err() {
        return;
    }
    let config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_cert_resolver(Arc::new(DynamicCertResolver {
            cache: Arc::clone(&state.cert_cache),
        }));
    let acceptor = TlsAcceptor::from(Arc::new(config));
    let tls_stream = match acceptor.accept(client).await {
        Ok(s) => s,
        Err(e) => {
            let msg = format!("{e:?}");
            if !msg.contains("UnexpectedEof") {
                proxy_log!("TLS accept (api-logging) failed: {}", msg);
            }
            return;
        }
    };
    let io = TokioIo::new(tls_stream);
    let app = proxy_app(Arc::clone(&state), "https");
    let svc = TowerToHyperService::new(app);
    let _ = Http1Builder::new().serve_connection(io, svc).await.ok();
}

fn is_system_connectivity_domain(host: &str) -> bool {
    let h = host.to_lowercase();
    h.contains("connectivitycheck")
        || h.contains("captiveportal")
        || h.contains("captive.apple.com")
        || h == "clients3.google.com"
        || h == "detectportal.firefox.com"
        || h == "msftconnecttest.com"
        || h == "msftncsi.com"
}

async fn handle_connect_tunnel(
    mut client: TcpStream,
    host: String,
    port: u16,
    state: Arc<ProxyState>,
    header_buf: Vec<u8>,
) {
    proxy_log!("CONNECT {}:{}", host, port);

    // 1. API Logging check FIRST
    let key = host_key_for_logging_map(&host);
    let use_api_logging = {
        let map_read = state.api_logging_map.read().ok();
        let config = map_read
            .as_ref()
            .and_then(|map| get_logging_config_for_host(map, &key));
        proxy_log!(
            "[matching] host: {}, key: {}, found_in_map: {}",
            host,
            key,
            config.is_some()
        );
        config.map_or(false, |(logging_enabled, _)| logging_enabled)
    };

    // 2. Selective Decryption for Inspector/Injection
    let is_connectivity = is_system_connectivity_domain(&host);
    let should_decrypt = !is_connectivity && (use_api_logging || {
        if is_inspector_enabled() {
            let domains = state.inspector_service.get_injection_domains();
            if domains.is_empty() {
                true // No domains registered -> Apply globally
            } else {
                // Match host or subdomains
                domains
                    .iter()
                    .any(|d| host == *d || host.ends_with(&format!(".{}", d)))
            }
        } else {
            false
        }
    });

    if should_decrypt {
        // Decrypt for API Logging or Inspector
        proxy_log!("-> CONNECT decryption enabled for {}", host);
        handle_connect_tunnel_decrypted(client, host, state).await;
        return;
    }

    let routes = if is_local_routing_enabled() {
        state.route_service.get_enabled()
    } else {
        vec![]
    };
    if let Some((target_host, target_port)) = resolve_connect_target(&host, &routes) {
        proxy_log!("-> CONNECT local route -> {}:{}", target_host, target_port);
        handle_connect_tunnel_local(client, target_host, target_port, host, state, header_buf)
            .await;
        return;
    }
    proxy_log!("-> CONNECT pass-through (upstream)");
    let mut upstream = match connect_for_connect(&host, port, state.resolver.as_ref()).await {
        Ok(s) => s,
        Err(_e) => {
            let _ = client
                .write_all(
                    b"HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
                )
                .await;
            return;
        }
    };
    let response = b"HTTP/1.1 200 Connection Established\r\n\r\n";
    if client.write_all(response).await.is_err() {
        return;
    }
    let body_start = header_buf
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .map_or(header_buf.len(), |i| i + 4);
    if body_start < header_buf.len() {
        let _ = upstream.write_all(&header_buf[body_start..]).await;
    }
    let (mut client_r, mut client_w) = client.into_split();
    let (mut up_r, mut up_w) = upstream.into_split();
    let t1 = tokio::spawn(async move { tokio::io::copy(&mut client_r, &mut up_w).await });
    let t2 = tokio::spawn(async move { tokio::io::copy(&mut up_r, &mut client_w).await });
    let _ = t1.await;
    let _ = t2.await;
}

/// Reserved path prefix: proxy serves setup page and assets (no forward to local route).
const WATCHTOWER_PATH_PREFIX: &str = "/.watchtower/";

/// PAC (Proxy Auto-Config). Returns PROXY for ALL traffic; filtering logic is handled in the proxy itself.
fn build_pac_js(proxy_host: &str, forward_port: u16) -> String {
    format!(
        "function FindProxyForURL(url, host) {{ \
            if (host === 'localhost' || \
                host === '127.0.0.1' || \
                host.indexOf('tailscale') !== -1 || \
                host.indexOf('.ts.net') !== -1) {{ \
                return 'DIRECT'; \
            }} \
            return \"PROXY {proxy_host}:{forward_port}; DIRECT\"; \
         }}"
    )
}

async fn serve_watchtower_reserved_path(state: Arc<ProxyState>, path: &str, host_h: &str) -> Response {
    if path == "/.watchtower/proxy.pac" || path.starts_with("/.watchtower/proxy.pac") {
        let Some(port) = state.forward_proxy_port else {
            return (StatusCode::NOT_FOUND, "Forward proxy port not configured").into_response();
        };

        let parsed_host = host_h.split(':').next().unwrap_or("");
        let is_loopback = parsed_host == "localhost"
            || parsed_host == "127.0.0.1"
            || parsed_host == "[::1]";

        let proxy_host = if is_loopback {
            "127.0.0.1".to_string()
        } else if parsed_host.ends_with(".trycloudflare.com") || parsed_host == "0.0.0.0" || parsed_host.is_empty() {
            crate::service::tunnel_service::get_tailscale_ip()
                .unwrap_or_else(|| "127.0.0.1".to_string())
        } else {
            parsed_host.to_string()
        };

        let pac = build_pac_js(&proxy_host, port);
        return (
            StatusCode::OK,
            [
                (
                    CONTENT_TYPE,
                    HeaderValue::from_static("application/x-ns-proxy-autoconfig"),
                ),
                (
                    header::CACHE_CONTROL,
                    HeaderValue::from_static("no-cache, no-store, must-revalidate"),
                ),
                (header::PRAGMA, HeaderValue::from_static("no-cache")),
                (header::EXPIRES, HeaderValue::from_static("0")),
            ],
            pac,
        )
            .into_response();
    }
    if path == "/.watchtower/setup" || path.starts_with("/.watchtower/setup") {
        let proxy_port_msg = state
            .forward_proxy_port
            .map(|p| format!(" (Forward proxy: 127.0.0.1:{p})"))
            .unwrap_or_default();
        let port = state.forward_proxy_port.unwrap_or(0);
        let html = include_str!("../../resources/setup.html")
            .replace("%PROXY_PORT_MSG%", &proxy_port_msg)
            .replace("%PROXY_PORT%", &port.to_string());
        return Html(html).into_response();
    }
    if path == "/.watchtower/root.crt" {
        let ca_pem = state.ca_service.ca_cert_pem();
        return (
            StatusCode::OK,
            [
                (
                    CONTENT_TYPE,
                    HeaderValue::from_static("application/x-x509-ca-cert"),
                ),
                (
                    header::CONTENT_DISPOSITION,
                    HeaderValue::from_static("attachment; filename=\"watchtower-root-ca.crt\""),
                ),
            ],
            ca_pem,
        )
            .into_response();
    }
    if path.starts_with("/.watchtower/cert/") {
        let host = path.trim_start_matches("/.watchtower/cert/").trim();
        if host.is_empty() {
            return (
                StatusCode::BAD_REQUEST,
                "Missing host in path: /.watchtower/cert/<host>",
            )
                .into_response();
        }
        return serve_cert_pem(Arc::clone(&state), host).into_response();
    }
    if path == "/.watchtower/ca.crt" || path.starts_with("/.watchtower/ca.crt") {
        let pem = state.ca_service.ca_cert_pem();
        return (
            StatusCode::OK,
            [
                (
                    CONTENT_TYPE,
                    HeaderValue::from_static("application/x-x509-ca-cert"),
                ),
                (
                    axum::http::header::CONTENT_DISPOSITION,
                    HeaderValue::from_static("attachment; filename=\"watchtower-ca.crt\""),
                ),
            ],
            pem,
        )
            .into_response();
    }
    if path == "/.watchtower/inspector.js" {
        // Try to read from filesystem first (for live updates during dev)
        let js = std::fs::read_to_string("resources/inspector.js")
            .or_else(|_| std::fs::read_to_string("src-tauri/resources/inspector.js"))
            .unwrap_or_else(|_| include_str!("../../resources/inspector.js").to_string());

        return (
            StatusCode::OK,
            [
                (
                    CONTENT_TYPE,
                    HeaderValue::from_static("application/javascript"),
                ),
                (
                    header::CACHE_CONTROL,
                    HeaderValue::from_static("no-store, no-cache, must-revalidate"),
                ),
                (header::PRAGMA, HeaderValue::from_static("no-cache")),
            ],
            js,
        )
            .into_response();
    }
    if path == "/.watchtower/logo.svg" {
        let svg = include_str!("../../../app-icon.svg");
        return (
            StatusCode::OK,
            [(CONTENT_TYPE, HeaderValue::from_static("image/svg+xml"))],
            svg,
        )
            .into_response();
    }
    if path == "/.watchtower/api/annotation" {
        // We'll handle POST request in a separate part or here by checking method
        // But serve_watchtower_reserved_path is called with the whole request context in proxy_handler_inner
        return (StatusCode::METHOD_NOT_ALLOWED, "Use POST for this endpoint").into_response();
    }
    (StatusCode::NOT_FOUND, "Not found").into_response()
}

/// Return PEM for download. Uses the same cert as TLS for this host (from shared cache) so installing it trusts the server.
fn serve_cert_pem(state: Arc<ProxyState>, host: &str) -> Response {
    let Some((_, pem)) = state.cert_cache.get_or_create(host) else {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to generate certificate",
        )
            .into_response();
    };
    // .crt 확장자로 내려주면 Windows에서 더블클릭 시 인증서 설치 마법사가 뜸 (.pem은 연결 프로그램 없음)
    let filename = format!("watchtower-{}.crt", host.replace(['.', ':'], "-"));
    let disposition = format!("attachment; filename=\"{filename}\"");
    (
        StatusCode::OK,
        [
            (
                CONTENT_TYPE,
                HeaderValue::from_static("application/x-pem-file"),
            ),
            (
                axum::http::header::CONTENT_DISPOSITION,
                HeaderValue::try_from(disposition)
                    .unwrap_or(HeaderValue::from_static("attachment")),
            ),
        ],
        pem,
    )
        .into_response()
}

async fn proxy_handler(
    state: State<Arc<ProxyState>>,
    ext: axum::Extension<&'static str>,
    req: Request,
) -> Response {
    let req_headers = req.headers().clone();
    let origin = req_headers
        .get(header::ORIGIN)
        .cloned()
        .unwrap_or_else(|| HeaderValue::from_static("*"));

    // 1. Handle Preflight OPTIONS
    if req.method() == hyper::Method::OPTIONS {
        let mut res_headers = HeaderMap::new();
        res_headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin.clone());
        res_headers.insert(
            header::ACCESS_CONTROL_ALLOW_METHODS,
            HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS, PATCH"),
        );

        // Echo back requested headers to be permissive
        if let Some(req_hdrs) = req_headers.get(header::ACCESS_CONTROL_REQUEST_HEADERS) {
            res_headers.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, req_hdrs.clone());
        } else {
            res_headers.insert(
                header::ACCESS_CONTROL_ALLOW_HEADERS,
                HeaderValue::from_static("*"),
            );
        }

        // Broad compatibility for credentials (only if origin is not *)
        if origin != "*" {
            res_headers.insert(
                header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
                HeaderValue::from_static("true"),
            );
        }

        return (StatusCode::OK, res_headers, Body::empty()).into_response();
    }

    // 2. Handle actual request
    let mut response = proxy_handler_inner(state, ext, req).await;

    // 3. Skip CORS for WebSocket Upgrades (101 Switching Protocols)
    // Adding CORS headers to 101 responses can cause browser to fail the handshake.
    if response.status() == StatusCode::SWITCHING_PROTOCOLS {
        return response;
    }

    // 4. Inject CORS headers into the response
    let res_headers = response.headers_mut();
    res_headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin.clone());
    res_headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS, PATCH"),
    );

    if let Some(req_hdrs) = req_headers.get(header::ACCESS_CONTROL_REQUEST_HEADERS) {
        res_headers.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, req_hdrs.clone());
    } else {
        res_headers.insert(
            header::ACCESS_CONTROL_ALLOW_HEADERS,
            HeaderValue::from_static("*"),
        );
    }

    if origin != "*" {
        res_headers.insert(
            header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
            HeaderValue::from_static("true"),
        );
    }

    // Expose headers so extensions/scripts can read them
    res_headers.insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        HeaderValue::from_static("*"),
    );

    // Add Vary: Origin to avoid caching issues with CORS
    res_headers.append(header::VARY, HeaderValue::from_static("Origin"));

    response
}

async fn proxy_handler_inner(
    State(state): State<Arc<ProxyState>>,
    axum::Extension(scheme): axum::Extension<&'static str>,
    mut req: Request,
) -> Response {
    let method = req.method().to_string();
    let uri = req.uri().clone();
    let path = uri.path();

    // Intercept `/api/ping` directly for Hybrid Handoff Tunnel checks
    if path == "/api/ping" {
        let json = serde_json::json!({
            "app": "watchtower_proxy",
            "status": "ok"
        });
        return (
            StatusCode::OK,
            [
                (CONTENT_TYPE, HeaderValue::from_static("application/json")),
            ],
            json.to_string(),
        ).into_response();
    }
    let host_h = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_default();
    proxy_log!("request {} {} Host: {}", method, uri, host_h);

    let uri_str = uri.to_string();
    let is_watchtower_path =
        path.starts_with(WATCHTOWER_PATH_PREFIX) || uri_str.contains(WATCHTOWER_PATH_PREFIX);

    if is_watchtower_path {
        let normalized_path = if let Some(idx) = uri_str.find(WATCHTOWER_PATH_PREFIX) {
            &uri_str[idx..]
        } else {
            path
        };
        // Remove query strings for internal path matching
        let clean_path = normalized_path.split('?').next().unwrap_or(normalized_path);

        proxy_log!(
            "-> watchtower reserved: {} (Original: {})",
            clean_path,
            path
        );

        // Handle App Focus
        if clean_path == "/.watchtower/api/focus" {
            if let Some(main) = state.app_handle.get_webview_window("main") {
                let _ = main.set_focus();
            }
            return (
                StatusCode::OK,
                [(header::CONTENT_TYPE, HeaderValue::from_static("text/plain"))],
                "Focused",
            )
                .into_response();
        }

        // Handle Status Request
        if clean_path == "/.watchtower/api/status" {
            let mocking_enabled = state.mocking_service.get_settings().enabled;
            let json = serde_json::json!({
                "proxy": true,
                "mocking": mocking_enabled,
                "logging": true
            });
            return (
                StatusCode::OK,
                [(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("application/json"),
                )],
                json.to_string(),
            )
                .into_response();
        }

        // Handle Get All Annotations
        if clean_path == "/.watchtower/api/annotations" && req.method() == hyper::Method::GET {
            let list = state.inspector_service.get_all();
            let json = serde_json::to_string(&list).unwrap_or_else(|_| "[]".to_string());
            return (
                StatusCode::OK,
                [(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("application/json"),
                )],
                json,
            )
                .into_response();
        }

        // Handle API Annotation POST
        if clean_path == "/.watchtower/api/annotation" && req.method() == hyper::Method::POST {
            let host_h = req
                .headers()
                .get(hyper::header::HOST)
                .and_then(|v| v.to_str().ok())
                .unwrap_or_default()
                .to_string();

            // Construct full URL (Assuming HTTPS since it's a proxy, or check scheme)
            let full_url = if req.uri().scheme().is_some() {
                req.uri().to_string()
            } else {
                format!("https://{}{}", host_h, req.uri())
            };

            let body = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
                Ok(b) => b,
                Err(_) => return (StatusCode::BAD_REQUEST, "Failed to read body").into_response(),
            };

            if let Ok(mut annotation_val) = serde_json::from_slice::<serde_json::Value>(&body) {
                if let Some(obj) = annotation_val.as_object_mut() {
                    if !obj.contains_key("domain") {
                        obj.insert("domain".to_string(), serde_json::Value::String(host_h));
                    }
                    if !obj.contains_key("url") {
                        obj.insert("url".to_string(), serde_json::Value::String(full_url));
                    }
                }

                // Parse into model and save to service
                match serde_json::from_value::<Annotation>(annotation_val.clone()) {
                    Ok(ann) => {
                        state.inspector_service.add_annotation(ann);
                        let count = state.inspector_service.get_all().len();
                        proxy_log!(
                            "✅ [Watchtower] Annotation saved to file. Total count: {}",
                            count
                        );

                        // Emit event to all windows to refresh UI
                        let _ = state.app_handle.emit("annotations-updated", ());
                    }
                    Err(e) => {
                        proxy_log!("❌ [Watchtower] Failed to parse annotation JSON: {}", e);
                    }
                }

                // Emit legacy event for backward compatibility
                let _ = state
                    .app_handle
                    .emit("annotation-dialog-requested", annotation_val);
                return (StatusCode::OK, "Annotation saved").into_response();
            }
            return (StatusCode::BAD_REQUEST, "Invalid JSON").into_response();
        }

        return serve_watchtower_reserved_path(state, clean_path, &host_h).await;
    }

    // --- MOCKING INTERCEPTOR ---
    if is_mocking_enabled() {
        let scenarios = state.mocking_service.get_scenarios();
        let enabled_scenario_ids: Vec<String> = scenarios
            .iter()
            .filter(|s| s.enabled)
            .map(|s| s.id.clone())
            .collect();

        let rules = state.mocking_service.get_mock_rules();
        let target_host = host_key_for_logging_map(&host_h);
        if let Some(rule) = rules.into_iter().find(|r| {
            r.enabled
                && enabled_scenario_ids.contains(&r.scenario_id)
                && r.method.eq_ignore_ascii_case(&method)
                && path.starts_with(&r.url_pattern)
                && (r.host.is_none()
                    || r.host
                        .as_deref()
                        .map(|h| h.to_lowercase())
                        .unwrap_or_default()
                        == target_host)
        }) {
            proxy_log!("-> mocked response for {} {}", method, uri);
            let mut builder = Response::builder().status(rule.response_status);
            if let Some(headers) = builder.headers_mut() {
                for (k, v) in &rule.response_headers {
                    let k_lower = k.to_lowercase();
                    if k_lower == "content-length"
                        || k_lower == "content-encoding"
                        || k_lower == "transfer-encoding"
                        || k_lower == "connection"
                    {
                        continue;
                    }
                    if let Ok(header_name) = header::HeaderName::from_bytes(k.as_bytes()) {
                        if let Ok(header_value) = header::HeaderValue::from_str(v) {
                            headers.insert(header_name, header_value);
                        }
                    }
                }
                headers.insert(
                    header::ACCESS_CONTROL_ALLOW_ORIGIN,
                    HeaderValue::from_static("*"),
                );
            }
            let body = rule.response_body.unwrap_or_default();

            // Save Log for mocked request
            let start_time = OffsetDateTime::now_utc();
            let entry = ApiLogEntry {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: start_time
                    .format(&time::format_description::well_known::Rfc3339)
                    .unwrap_or_default(),
                method: method.to_string(),
                url: uri.to_string(),
                host: host_h.to_string(),
                path: path.to_string(),
                status_code: Some(rule.response_status),
                request_headers: Some(
                    req.headers()
                        .iter()
                        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                        .collect(),
                ),
                request_body: None, // We don't read the body for most mocks to keep it fast, or we could read it if needed
                response_headers: Some(rule.response_headers.clone()),
                response_body: Some(body.clone()),
            };
            state.api_log_service.save_log(&entry);
            let _ = state.app_handle.emit("api-log-captured", entry);

            return builder.body(Body::from(body)).unwrap_or_else(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to build mock response: {e}"),
                )
                    .into_response()
            });
        }
    }
    // --- END MOCKING INTERCEPTOR ---

    let host_header = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    // When local routing is disabled, pass an empty slice so no routes match → pure pass-through.
    let routes = if is_local_routing_enabled() {
        state.route_service.get_enabled()
    } else {
        vec![]
    };
    let (target_uri_str, _pass_through_host, _target_host_value, local_origin) =
        resolve_target(&uri, host_header.as_deref(), &routes, scheme);

    if let Some((ref target_host, target_port, ref path_query)) = local_origin {
        proxy_log!(
            "-> local route -> {}:{} path: {}",
            target_host,
            target_port,
            path_query
        );
    }
    let Ok(target_uri) = Uri::try_from(target_uri_str.as_str()) else {
        return (StatusCode::BAD_REQUEST, "Invalid target URI").into_response();
    };

    *req.uri_mut() = target_uri.clone();

    // API Logging check
    let host_key = host_key_for_logging_map(&host_h);
    let logging_config = state
        .api_logging_map
        .read()
        .ok()
        .and_then(|map| get_logging_config_for_host(&map, &host_key));

    let (logging_enabled, body_enabled) = logging_config.unwrap_or((false, false));
    let _is_local = local_origin.is_some();

    // ── [WebSocket / Upgrade Handling] ──────────────────────────────────────────
    // reqwest does not support WebSocket upgrades. We must handle them manually.
    let is_upgrade = req
        .headers()
        .get(header::UPGRADE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_lowercase() == "websocket")
        .unwrap_or(false);

    if is_upgrade {
        proxy_log!("-> upgrade request (WebSocket) for {}", uri);

        // 1. Prepare request for upstream (Force HTTP/1.1)
        // Use reqwest_client_direct for pass-through to ensure it doesn't try to use system proxy (itself)
        let mut req_builder = if local_origin.is_some() {
            state
                .reqwest_client
                .request(req.method().clone(), &target_uri_str)
        } else {
            state
                .reqwest_client_direct
                .request(req.method().clone(), &target_uri_str)
        };
        req_builder = req_builder.version(reqwest::Version::HTTP_11);

        // Copy headers (excluding hop-by-hop)
        let hop_by_hop_headers = [
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "transfer-encoding",
            "proxy-connection",
            "accept-encoding",
        ];

        for (name, value) in req.headers().iter() {
            let name_str = name.as_str().to_lowercase();
            if name_str != "host" && !hop_by_hop_headers.contains(&name_str.as_str()) {
                req_builder = req_builder.header(name, value);
            }
        }
        // Force Upgrade/Connection headers for handshake
        req_builder = req_builder.header(header::UPGRADE, "websocket");
        req_builder = req_builder.header(header::CONNECTION, "upgrade");

        if local_origin.is_some() {
            req_builder = req_builder.header("host", host_h.clone());
        }

        // 2. Perform Handshake
        match req_builder.send().await {
            Ok(res) if res.status() == StatusCode::SWITCHING_PROTOCOLS => {
                proxy_log!(
                    "✅ [WS] Upstream handshake success (101). Headers: {:?}",
                    res.headers()
                );

                let mut res_builder = Response::builder().status(StatusCode::SWITCHING_PROTOCOLS);

                // Copy response headers back to client
                if let Some(h) = res_builder.headers_mut() {
                    for (k, v) in res.headers() {
                        let k_str = k.as_str().to_lowercase();
                        if !hop_by_hop_headers.contains(&k_str.as_str()) {
                            h.insert(k, v.clone());
                        }
                    }
                    // Ensure these are set
                    h.insert(header::UPGRADE, HeaderValue::from_static("websocket"));
                    h.insert(header::CONNECTION, HeaderValue::from_static("upgrade"));
                }

                // 3. Handle Bidirectional Tunneling
                let (parts, _) = req.into_parts();
                let upgraded_client =
                    hyper::upgrade::on(axum::http::Request::from_parts(parts, Body::empty()));

                tokio::spawn(async move {
                    proxy_log!("🚀 [WS] Starting bidirectional copy...");
                    let mut upstream_io = match res.upgrade().await {
                        Ok(upgraded) => upgraded,
                        Err(e) => {
                            proxy_log!("❌ [WS] Upstream upgrade failed (after 101): {e}");
                            return;
                        }
                    };

                    let mut client_io = match upgraded_client.await {
                        Ok(upgraded) => TokioIo::new(upgraded),
                        Err(e) => {
                            proxy_log!("❌ [WS] Client upgrade failed (after 101): {e}");
                            return;
                        }
                    };

                    match tokio::io::copy_bidirectional(&mut client_io, &mut upstream_io).await {
                        Ok(_) => proxy_log!("✅ [WS] Tunnel closed normally."),
                        Err(e) => proxy_log!("ℹ️ [WS] Tunnel closed: {e}"),
                    }
                });

                return res_builder
                    .body(Body::empty())
                    .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
            }
            Ok(res) => {
                proxy_log!(
                    "❌ [WS] Upstream refused upgrade. Status: {}, Headers: {:?}",
                    res.status(),
                    res.headers()
                );
                let status = res.status();
                let mut res_builder = Response::builder().status(status);
                if let Some(h) = res_builder.headers_mut() {
                    for (k, v) in res.headers() {
                        h.insert(k, v.clone());
                    }
                }
                let body_bytes = res.bytes().await.unwrap_or_default();
                return res_builder
                    .body(Body::from(body_bytes))
                    .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
            }
            Err(e) => {
                proxy_log!("❌ [WS] Upstream connection error: {e}");
                return (StatusCode::BAD_GATEWAY, format!("Proxy WS error: {e}")).into_response();
            }
        }
    }

    if !logging_enabled {
        // Pass-through or local routing (Non-logging)
        // Use reqwest_client_direct for pass-through to ensure it doesn't try to use system proxy (itself)
        let method = req.method().clone();
        let url_str = target_uri_str.clone();

        let mut req_builder = if local_origin.is_some() {
            state.reqwest_client.request(method.clone(), &url_str)
        } else {
            state
                .reqwest_client_direct
                .request(method.clone(), &url_str)
        };
        let (parts, body) = req.into_parts();

        let has_body = !matches!(
            parts.method,
            axum::http::Method::GET
                | axum::http::Method::HEAD
                | axum::http::Method::OPTIONS
                | axum::http::Method::TRACE
        );

        if has_body {
            let body_stream = TryStreamExt::map_err(
                TryStreamExt::map_ok(http_body_util::BodyStream::new(body), |frame| {
                    frame.into_data().unwrap_or_default()
                }),
                |e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>,
            );
            let reqwest_body = reqwest::Body::wrap_stream(body_stream);
            req_builder = req_builder.body(reqwest_body);
        }

        // Headers
        let hop_by_hop_headers = [
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "transfer-encoding",
            "upgrade",
            "proxy-connection",
            "accept-encoding",
        ];
        for (name, value) in parts.headers.iter() {
            let name_str = name.as_str().to_lowercase();
            if name_str != "host" && !hop_by_hop_headers.contains(&name_str.as_str()) {
                req_builder = req_builder.header(name, value);
            }
        }
        // Note: Do NOT manually set "host" header for pass-through unless it's a local route
        // reqwest automatically sets it from the URL.
        if local_origin.is_some() {
            req_builder = req_builder.header("host", host_h.clone());
        }

        match req_builder.send().await {
            Ok(res) => {
                let status = res.status();
                let mut res_headers = res.headers().clone();

                // ── [Live Capture] Strip Security Headers to allow iframing ──────
                res_headers.remove(header::X_FRAME_OPTIONS);
                res_headers.remove(header::CONTENT_SECURITY_POLICY);
                res_headers.remove("content-security-policy-report-only");
                res_headers.remove("x-content-security-policy");

                // ── [Cookie Fix] Force SameSite=None; Secure for iframing ──────
                let mut cookie_updates = Vec::new();
                for (name, value) in res_headers.iter() {
                    if name == header::SET_COOKIE {
                        if let Ok(cookie_str) = value.to_str() {
                            let mut new_cookie = cookie_str.to_string();
                            if !new_cookie.contains("SameSite=") {
                                new_cookie.push_str("; SameSite=None");
                            } else {
                                new_cookie = new_cookie
                                    .replace("SameSite=Lax", "SameSite=None")
                                    .replace("SameSite=Strict", "SameSite=None");
                            }
                            if !new_cookie.contains("Secure") {
                                new_cookie.push_str("; Secure");
                            }
                            cookie_updates.push(new_cookie);
                        }
                    }
                }
                if !cookie_updates.is_empty() {
                    res_headers.remove(header::SET_COOKIE);
                    for cookie in cookie_updates {
                        if let Ok(hv) = HeaderValue::from_str(&cookie) {
                            res_headers.append(header::SET_COOKIE, hv);
                        }
                    }
                }
                // ────────────────────────────────────────────────────────────────

                // Send real-time event even if logging is disabled for DB
                let entry = crate::model::api_log::ApiLogEntry {
                    id: uuid::Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    method: method.to_string(),
                    url: url_str.clone(),
                    host: host_h.clone(),
                    path: path.to_string(),
                    status_code: Some(status.as_u16()),
                    request_headers: None,
                    request_body: None,
                    response_headers: None,
                    response_body: None,
                };
                state.api_log_service.save_log(&entry);
                let _ = state.app_handle.emit("api-log-captured", entry);

                let content_type = res_headers
                    .get(header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("unknown")
                    .to_lowercase();

                // Aggressive HTML detection
                let is_html = content_type.contains("text/html")
                    || content_type.contains("application/xhtml+xml");

                // Aggressive Cache & Protocol fix
                res_headers.remove(header::ETAG);
                res_headers.remove(header::LAST_MODIFIED);
                res_headers.remove("alt-svc"); // Disable HTTP/3 upgrade

                if is_html && should_inject_for_host(&state, &host_h) {
                    // Force no-cache for HTML to ensure injection is always processed
                    res_headers.insert(
                        header::CACHE_CONTROL,
                        HeaderValue::from_static(
                            "no-store, no-cache, must-revalidate, proxy-revalidate",
                        ),
                    );
                    res_headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
                    res_headers.remove(header::EXPIRES);

                    let full_body = match res.bytes().await {
                        Ok(b) => b,
                        Err(e) => {
                            proxy_log!("❌ [Watchtower] Failed to read HTML body: {}", e);
                            return (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}"))
                                .into_response();
                        }
                    };
                    let mut final_res_bytes = full_body.to_vec();
                    let injection_script = r#"<script id="wt-injection-marker" type="module" src="/.watchtower/inspector.js"></script>"#;

                    // 1. Try UTF-8 injection
                    let mut injected = false;
                    if let Ok(body_str) = String::from_utf8(final_res_bytes.clone()) {
                        let body_lower = body_str.to_lowercase();
                        if body_lower.contains("</body>")
                            && !body_str.contains("wt-injection-marker")
                        {
                            if let Some(pos) = body_lower.rfind("</body>") {
                                let mut new_body = body_str[..pos].to_string();
                                new_body.push_str(injection_script);
                                new_body.push_str(&body_str[pos..]);
                                final_res_bytes = new_body.into_bytes();
                                injected = true;
                                proxy_log!("✅ [Watchtower] Inspector injected (UTF-8).");
                            }
                        }
                    }

                    // 2. Fallback to Byte-level injection
                    if !injected {
                        let pattern = b"</body>";
                        let marker = b"wt-injection-marker";
                        if !final_res_bytes.windows(marker.len()).any(|w| w == marker) {
                            if let Some(pos) = final_res_bytes
                                .windows(pattern.len())
                                .rposition(|w| w.eq_ignore_ascii_case(pattern))
                            {
                                let mut new_bytes = Vec::with_capacity(
                                    final_res_bytes.len() + injection_script.len(),
                                );
                                new_bytes.extend_from_slice(&final_res_bytes[..pos]);
                                new_bytes.extend_from_slice(injection_script.as_bytes());
                                new_bytes.extend_from_slice(&final_res_bytes[pos..]);
                                final_res_bytes = new_bytes;
                                proxy_log!("✅ [Watchtower] Inspector injected (Byte-level).");
                            }
                        }
                    }

                    let mut builder = Response::builder().status(status);
                    if let Some(headers) = builder.headers_mut() {
                        let skip_headers = [
                            "connection",
                            "keep-alive",
                            "proxy-authenticate",
                            "proxy-authorization",
                            "te",
                            "trailers",
                            "transfer-encoding",
                            "upgrade",
                            "proxy-connection",
                            "content-length",
                        ];
                        for (k, v) in &res_headers {
                            let k_str = k.as_str().to_lowercase();
                            if !skip_headers.contains(&k_str.as_str()) {
                                headers.insert(k, v.clone());
                            }
                        }
                    }
                    return builder
                        .body(Body::from(final_res_bytes))
                        .unwrap_or_else(|e| {
                            (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response()
                        });
                }

                let mut builder = Response::builder().status(status);
                if let Some(headers) = builder.headers_mut() {
                    let skip_headers = [
                        "connection",
                        "keep-alive",
                        "proxy-authenticate",
                        "proxy-authorization",
                        "te",
                        "trailers",
                        "transfer-encoding",
                        "upgrade",
                        "proxy-connection",
                        "content-length",
                    ];
                    for (k, v) in &res_headers {
                        let k_str = k.as_str().to_lowercase();
                        if !skip_headers.contains(&k_str.as_str()) {
                            headers.insert(k, v.clone());
                        }
                    }
                }
                let stream = res.bytes_stream();
                let body = Body::from_stream(
                    stream.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)),
                );
                builder.body(body).unwrap_or_else(|e| {
                    (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response()
                })
            }
            Err(e) => (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response(),
        }
    } else {
        // Read Request Body
        let (parts, body) = req.into_parts();
        let req_bytes = match axum::body::to_bytes(body, usize::MAX).await {
            Ok(b) => b,
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    format!("Failed to read request body: {e}"),
                )
                    .into_response()
            }
        };
        let req_body_str = if body_enabled {
            String::from_utf8(req_bytes.to_vec()).ok()
        } else {
            None
        };

        // Reconstruct request for forwarding (using reqwest)
        // Note: We already read the body into req_bytes.
        let method = parts.method.clone();
        let url_str = target_uri_str.clone(); /* target_uri_str is full URL */

        let mut req_builder = if local_origin.is_some() {
            state.reqwest_client.request(method.clone(), &url_str)
        } else {
            state
                .reqwest_client_direct
                .request(method.clone(), &url_str)
        };

        let has_body = !matches!(
            parts.method,
            axum::http::Method::GET
                | axum::http::Method::HEAD
                | axum::http::Method::OPTIONS
                | axum::http::Method::TRACE
        );

        if has_body && !req_bytes.is_empty() {
            // Allow sending relatively large bodies for API logging
            req_builder = req_builder.body(req_bytes.to_vec());
        }

        // Copy headers
        let hop_by_hop_headers = [
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "transfer-encoding",
            "upgrade",
            "proxy-connection",
            "accept-encoding",
        ];

        for (name, value) in parts.headers.iter() {
            let name_str = name.as_str().to_lowercase();
            if name_str != "host" && !hop_by_hop_headers.contains(&name_str.as_str()) {
                req_builder = req_builder.header(name, value);
            }
        }
        // Add Host header if needed (Only for local routes, reqwest handles it for pass-through)
        if local_origin.is_some() {
            req_builder = req_builder.header("host", host_h.clone());
        }

        let start_time = OffsetDateTime::now_utc();

        // Send Request
        let response_result = req_builder.send().await;

        let response = match response_result {
            Ok(res) => res,
            Err(e) => {
                proxy_log!("   reqwest error: {}", e);
                return (StatusCode::BAD_GATEWAY, format!("Proxy error: {e}")).into_response();
            }
        };

        // Read Response Body
        let status = response.status();
        let mut res_headers = response.headers().clone();
        let res_bytes = match response.bytes().await {
            Ok(b) => b,
            Err(e) => {
                return (
                    StatusCode::BAD_GATEWAY,
                    format!("Failed to read response body: {e}"),
                )
                    .into_response()
            }
        };

        let res_body_str = if body_enabled {
            String::from_utf8(res_bytes.to_vec()).ok()
        } else {
            None
        };

        let content_type = res_headers
            .get(header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("unknown")
            .to_lowercase();

        // Aggressive HTML detection
        let is_html =
            content_type.contains("text/html") || content_type.contains("application/xhtml+xml");

        // ── [Aggressive Security Header Strip] allow iframing/injection ─────────
        res_headers.remove(header::X_FRAME_OPTIONS);
        res_headers.remove(header::CONTENT_SECURITY_POLICY);
        res_headers.remove("content-security-policy-report-only");
        res_headers.remove("x-content-security-policy");

        // Aggressive Cache & Protocol fix
        res_headers.remove(header::ETAG);
        res_headers.remove(header::LAST_MODIFIED);
        res_headers.remove("alt-svc"); // Disable HTTP/3 upgrade

        let mut final_res_bytes = res_bytes.to_vec();
        if is_html && should_inject_for_host(&state, &host_h) {
            // Force no-cache for HTML to ensure injection is always processed
            res_headers.insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("no-store, no-cache, must-revalidate, proxy-revalidate"),
            );
            res_headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
            res_headers.remove(header::EXPIRES);

            let injection_script = r#"<script id="wt-injection-marker" type="module" src="/.watchtower/inspector.js"></script>"#;

            // 1. Try UTF-8 injection
            let mut injected = false;
            if let Ok(body_str) = String::from_utf8(final_res_bytes.clone()) {
                let body_lower = body_str.to_lowercase();
                if body_lower.contains("</body>") && !body_str.contains("wt-injection-marker") {
                    if let Some(pos) = body_lower.rfind("</body>") {
                        let mut new_body = body_str[..pos].to_string();
                        new_body.push_str(injection_script);
                        new_body.push_str(&body_str[pos..]);
                        final_res_bytes = new_body.into_bytes();
                        injected = true;
                        proxy_log!("✅ [Watchtower] Inspector injected (UTF-8).");
                    }
                }
            }

            // 2. Fallback to Byte-level injection if UTF-8 failed or tag not found in string
            if !injected {
                let pattern = b"</body>";
                let marker = b"wt-injection-marker";
                if !final_res_bytes.windows(marker.len()).any(|w| w == marker) {
                    if let Some(pos) = final_res_bytes
                        .windows(pattern.len())
                        .rposition(|w: &[u8]| w.eq_ignore_ascii_case(pattern))
                    {
                        let mut new_bytes =
                            Vec::with_capacity(final_res_bytes.len() + injection_script.len());
                        new_bytes.extend_from_slice(&final_res_bytes[..pos]);
                        new_bytes.extend_from_slice(injection_script.as_bytes());
                        new_bytes.extend_from_slice(&final_res_bytes[pos..]);
                        final_res_bytes = new_bytes;
                        proxy_log!("✅ [Watchtower] Inspector injected (Byte-level).");
                    }
                }
            }
        }

        // Save Log
        let entry = ApiLogEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: start_time
                .format(&time::format_description::well_known::Rfc3339)
                .unwrap_or_default(),
            method: method.to_string(),
            url: target_uri_str.clone(),
            host: host_h.to_string(),
            path: path.to_string(),
            status_code: Some(status.as_u16()),
            request_headers: Some(
                parts
                    .headers
                    .iter()
                    .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                    .collect(),
            ),
            request_body: req_body_str,
            response_headers: Some(
                res_headers
                    .iter()
                    .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                    .collect(),
            ),
            response_body: res_body_str,
        };
        state.api_log_service.save_log(&entry);
        let _ = state.app_handle.emit("api-log-captured", entry);

        // Reconstruct response
        let mut builder = Response::builder().status(status);
        if let Some(headers) = builder.headers_mut() {
            let skip_headers = [
                "connection",
                "keep-alive",
                "proxy-authenticate",
                "proxy-authorization",
                "te",
                "trailers",
                "transfer-encoding",
                "upgrade",
                "proxy-connection",
                "content-length",
            ];
            for (k, v) in res_headers.iter() {
                let k_str = k.as_str().to_lowercase();
                if !skip_headers.contains(&k_str.as_str()) {
                    headers.insert(k, v.clone());
                }
            }
        }
        // Use (potentially modified) Bytes
        builder
            .body(Body::from(final_res_bytes))
            .unwrap_or_else(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to build response: {e}"),
                )
                    .into_response()
            })
    }
}

/// Build shared app (Router + state) for `proxy_handler`.
fn proxy_app(state: Arc<ProxyState>, scheme: &'static str) -> Router {
    Router::new()
        .route("/", any(proxy_handler))
        .route("/*path", any(proxy_handler))
        .with_state(state)
        .layer(axum::Extension(scheme))
}

/// Bind to 127.0.0.1:port and run the proxy. Returns the `JoinHandle` so the caller can abort it.
/// Handles CONNECT (HTTPS tunnel) and regular HTTP; when `dns_server` is set, pass-through hosts are resolved via it.
pub async fn run_proxy(
    app_handle: tauri::AppHandle,
    port: u16,
    route_service: Arc<LocalRouteService>,
    dns_server: Option<String>,
    api_logging_map: Arc<RwLock<HashMap<String, (bool, bool)>>>,
    api_log_service: Arc<ApiLogService>,
    ca_service: Arc<CaService>,
    mocking_service: Arc<crate::service::mocking_service::MockingService>,
    inspector_service: Arc<crate::service::inspector_service::InspectorService>,
) -> std::io::Result<JoinHandle<()>> {
    // Bind to 0.0.0.0 so the proxy is reachable via Tailscale IP (100.x.x.x)
    // from mobile devices on the same VPN network for cert downloads and PAC access.
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let state = Arc::new(ProxyState::new(
        app_handle,
        route_service,
        dns_server,
        Some(port),
        api_logging_map,
        api_log_service,
        ca_service,
        mocking_service,
        inspector_service,
    ));
    let app = proxy_app(Arc::clone(&state), "http");
    let handle = tokio::spawn(async move {
        loop {
            let Ok((stream, _)) = listener.accept().await else {
                continue;
            };
            let state = Arc::clone(&state);
            let app = app.clone();
            tokio::spawn(async move {
                let mut stream = stream;
                let Ok(buf) = read_request_headers(&mut stream).await else {
                    return;
                };
                let first_line = buf
                    .splitn(2, |&c| c == b'\n')
                    .next()
                    .and_then(|line| std::str::from_utf8(line).ok())
                    .unwrap_or("")
                    .trim_end_matches('\r')
                    .trim();
                if let Some((host, port)) = parse_connect_target(first_line) {
                    handle_connect_tunnel(stream, host, port, state, buf).await;
                } else {
                    let io = TokioIo::new(PrependIo::new(buf, stream));
                    let svc = TowerToHyperService::new(app);
                    let _ = Http1Builder::new().serve_connection(io, svc).await.ok();
                }
            });
        }
    });

    Ok(handle)
}

/// Reverse HTTP listener: no system proxy. Client connects directly (e.g. hosts 127.0.0.1 dev.modetour.local, then http://dev.modetour.local:port).
/// Requests are origin-form (GET /path); routing by Host header.
/// `forward_proxy_port`: port of the main (forward) proxy, for PAC generation.
pub async fn run_reverse_proxy_http(
    app_handle: tauri::AppHandle,
    port: u16,
    route_service: Arc<LocalRouteService>,
    dns_server: Option<String>,
    forward_proxy_port: Option<u16>,
    api_logging_map: Arc<RwLock<HashMap<String, (bool, bool)>>>,
    api_log_service: Arc<ApiLogService>,
    ca_service: Arc<CaService>,
    mocking_service: Arc<crate::service::mocking_service::MockingService>,
    inspector_service: Arc<crate::service::inspector_service::InspectorService>,
) -> std::io::Result<JoinHandle<()>> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let state = Arc::new(ProxyState::new(
        app_handle,
        route_service,
        dns_server,
        forward_proxy_port,
        api_logging_map,
        api_log_service,
        ca_service,
        mocking_service,
        inspector_service,
    ));
    let app = proxy_app(Arc::clone(&state), "http");
    let handle = tokio::spawn(async move {
        loop {
            let Ok((stream, _)) = listener.accept().await else {
                continue;
            };
            let app = app.clone();
            tokio::spawn(async move {
                let io = TokioIo::new(stream);
                let svc = TowerToHyperService::new(app);
                let _ = Http1Builder::new().serve_connection(io, svc).await.ok();
            });
        }
    });

    Ok(handle)
}

/// Reverse HTTPS listener: TLS termination by Host (SNI), then forward by Host. Use https://dev.modetour.local:port with hosts.
/// `forward_proxy_port`: port of the main (forward) proxy, for PAC generation.
pub async fn run_reverse_proxy_https(
    app_handle: tauri::AppHandle,
    port: u16,
    route_service: Arc<LocalRouteService>,
    dns_server: Option<String>,
    forward_proxy_port: Option<u16>,
    api_logging_map: Arc<RwLock<HashMap<String, (bool, bool)>>>,
    api_log_service: Arc<ApiLogService>,
    ca_service: Arc<CaService>,
    mocking_service: Arc<crate::service::mocking_service::MockingService>,
    inspector_service: Arc<crate::service::inspector_service::InspectorService>,
) -> std::io::Result<JoinHandle<()>> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let state = Arc::new(ProxyState::new(
        app_handle,
        route_service,
        dns_server,
        forward_proxy_port,
        api_logging_map,
        api_log_service,
        ca_service,
        mocking_service,
        inspector_service,
    ));
    let app = proxy_app(Arc::clone(&state), "https");
    let config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_cert_resolver(Arc::new(DynamicCertResolver {
            cache: Arc::clone(&state.cert_cache),
        }));
    let acceptor = TlsAcceptor::from(Arc::new(config));

    let handle = tokio::spawn(async move {
        loop {
            let Ok((stream, _)) = listener.accept().await else {
                continue;
            };
            let acceptor = acceptor.clone();
            let app = app.clone();
            tokio::spawn(async move {
                let Ok(tls_stream) = acceptor.accept(stream).await else {
                    return;
                };
                let io = TokioIo::new(tls_stream);
                let svc = TowerToHyperService::new(app);
                let _ = Http1Builder::new().serve_connection(io, svc).await.ok();
            });
        }
    });

    Ok(handle)
}

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════
#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::local_route::LocalRoute;

    // ── LOCAL_ROUTING_ENABLED toggle ───────────────────────────────────
    #[test]
    fn test_local_routing_toggle() {
        // Reset to known state
        set_local_routing_enabled(true);
        assert!(is_local_routing_enabled());

        set_local_routing_enabled(false);
        assert!(!is_local_routing_enabled());

        set_local_routing_enabled(true);
        assert!(is_local_routing_enabled());
    }

    // ── resolve_target: empty routes → pure pass-through ───────────────
    #[test]
    fn test_resolve_target_empty_routes_passthrough() {
        let uri: Uri = "http://example.com/path?q=1".parse().unwrap();
        let (target_uri, _pass_host, _target_host_value, local_origin) =
            resolve_target(&uri, Some("example.com"), &[], "http");

        // No local route matched → local_origin is None
        assert!(
            local_origin.is_none(),
            "empty routes should yield no local_origin"
        );
        // Target URI is the original (pass-through)
        assert!(
            target_uri.contains("example.com"),
            "pass-through target should contain original host, got: {target_uri}"
        );
    }

    // ── resolve_target: matching route → local routing ─────────────────
    #[test]
    fn test_resolve_target_with_matching_route() {
        let route = LocalRoute {
            id: 1,
            domain: "api.example.com".to_string(),
            target_host: "127.0.0.1".to_string(),
            target_port: 3000,
            enabled: true,
        };
        let uri: Uri = "http://api.example.com/foo".parse().unwrap();
        let (_target_uri, _pass_host, _target_host_value, local_origin) =
            resolve_target(&uri, Some("api.example.com"), &[route], "http");

        assert!(
            local_origin.is_some(),
            "matching route should yield local_origin"
        );
        let (host, port, path) = local_origin.unwrap();
        assert_eq!(host, "127.0.0.1");
        assert_eq!(port, 3000);
        assert_eq!(path, "/foo");
    }

    // ── resolve_target: disabled route should NOT match ─────────────────
    #[test]
    fn test_resolve_target_disabled_route_no_match() {
        let route = LocalRoute {
            id: 1,
            domain: "api.example.com".to_string(),
            target_host: "127.0.0.1".to_string(),
            target_port: 3000,
            enabled: false,
        };
        let uri: Uri = "http://api.example.com/foo".parse().unwrap();
        let (_target_uri, _pass_host, _target_host_value, local_origin) =
            resolve_target(&uri, Some("api.example.com"), &[route], "http");

        assert!(local_origin.is_none(), "disabled route should not match");
    }

    // ── resolve_connect_target: empty routes ────────────────────────────
    #[test]
    fn test_resolve_connect_target_empty_routes() {
        let result = resolve_connect_target("api.example.com", &[]);
        assert!(
            result.is_none(),
            "empty routes should return None for CONNECT"
        );
    }

    // ── resolve_connect_target: matching route ──────────────────────────
    #[test]
    fn test_resolve_connect_target_matching_route() {
        let route = LocalRoute {
            id: 1,
            domain: "api.example.com".to_string(),
            target_host: "127.0.0.1".to_string(),
            target_port: 3000,
            enabled: true,
        };
        let result = resolve_connect_target("api.example.com", &[route]);
        assert!(result.is_some());
        let (host, port) = result.unwrap();
        assert_eq!(host, "127.0.0.1");
        assert_eq!(port, 3000);
    }

    // ── local routing flag integration with resolve_target ──────────────
    #[test]
    fn test_routing_flag_integration() {
        let route = LocalRoute {
            id: 1,
            domain: "dev.local".to_string(),
            target_host: "127.0.0.1".to_string(),
            target_port: 8080,
            enabled: true,
        };
        let uri: Uri = "http://dev.local/api".parse().unwrap();

        // Enabled: route should match
        set_local_routing_enabled(true);
        let routes_enabled = if is_local_routing_enabled() {
            vec![route.clone()]
        } else {
            vec![]
        };
        let (_, _, _, local_origin) =
            resolve_target(&uri, Some("dev.local"), &routes_enabled, "http");
        assert!(local_origin.is_some(), "routing enabled → should match");

        // Disabled: same route, but we pass empty vec (mimicking proxy_handler logic)
        set_local_routing_enabled(false);
        let routes_disabled = if is_local_routing_enabled() {
            vec![route]
        } else {
            vec![]
        };
        let (_, _, _, local_origin) =
            resolve_target(&uri, Some("dev.local"), &routes_disabled, "http");
        assert!(
            local_origin.is_none(),
            "routing disabled → should pass through"
        );

        // Cleanup
        set_local_routing_enabled(true);
    }

    #[tokio::test]
    async fn test_proxy_handler_logging_for_local_route() {
        use crate::service::api_log_service::ApiLogService;
        use crate::service::local_proxy::{proxy_handler, ProxyState};
        use crate::service::local_route_service::LocalRouteService;
        use axum::body::Body;
        use axum::extract::State;
        use axum::http::{Request, StatusCode};
        use std::collections::HashMap;
        use std::sync::{Arc, RwLock};
        use tempfile::tempdir;

        // 1. Setup mock backend
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let backend_port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            loop {
                if let Ok((mut stream, _)) = listener.accept().await {
                    use tokio::io::{AsyncReadExt, AsyncWriteExt};
                    let mut buf = [0u8; 1024];
                    let _ = stream.read(&mut buf).await;
                    let response = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK";
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
        });

        // 2. Setup ProxyState
        let temp_dir = tempdir().unwrap();
        let api_log_service = Arc::new(ApiLogService::new(temp_dir.path().to_path_buf()));

        let route_service = Arc::new(LocalRouteService::new(temp_dir.path().to_path_buf()));
        route_service.add(
            "api.test.local".to_string(),
            "127.0.0.1".to_string(),
            backend_port,
        );

        let mut logging_map = HashMap::new();
        logging_map.insert("api.test.local".to_string(), (true, true));
        let api_logging_map = Arc::new(RwLock::new(logging_map));

        let ca_service = Arc::new(CaService::new(temp_dir.path()).unwrap());

        let mocking_service = Arc::new(crate::service::mocking_service::MockingService::new(
            temp_dir.path().to_path_buf(),
            temp_dir.path().to_path_buf(),
            temp_dir.path().to_path_buf(),
        ));

        let inspector_service = Arc::new(crate::service::inspector_service::InspectorService::new(
            temp_dir.path().to_path_buf(),
            temp_dir.path().to_path_buf(),
            temp_dir.path().to_path_buf(),
        ));

        // In tests, we don't have a real AppHandle, so we might need a different way to construct ProxyState
        // For now, let's assume we can pass a dummy handle if possible, or we need to change how ProxyState is constructed in tests.
        // Looking at the error, it's a signature mismatch.

        // Note: This test might still fail to compile if tauri::test::mock_builder is needed for AppHandle.
        // But let's fix the argument count first.
        let state = Arc::new(ProxyState {
            app_handle: tauri::test::mock_app_handle(),
            route_service,
            resolver: None,
            forward_proxy_port: None,
            cert_cache: Arc::new(HostCertCache::new(ca_service.clone())),
            api_logging_map,
            api_log_service: api_log_service.clone(),
            ca_service,
            reqwest_client: reqwest::Client::new(),
            mocking_service,
            inspector_service,
        });

        // 3. Perform request
        let req = Request::builder()
            .method("GET")
            .uri("http://api.test.local/foo")
            .header("host", "api.test.local")
            .body(Body::empty())
            .unwrap();

        let response = proxy_handler(State(state), axum::Extension("http"), req).await;
        assert_eq!(response.status(), StatusCode::OK);

        // 4. Verify log
        let dates = api_log_service.list_dates();
        assert!(!dates.is_empty(), "Log date should be created");
        let logs = api_log_service.get_logs(&dates[0], None, None, None, false);
        assert!(!logs.is_empty(), "Log entry should be saved");
        let entry = &logs[0];
        assert_eq!(entry.method, "GET");
        assert!(entry.url.contains("127.0.0.1"));
        assert!(entry.url.contains(&backend_port.to_string()));
        assert_eq!(entry.host, "api.test.local");
        assert_eq!(entry.path, "/foo");
        assert_eq!(entry.status_code, Some(200));
    }
}
