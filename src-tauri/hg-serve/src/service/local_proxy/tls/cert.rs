use axum::http::{
    header::{HeaderValue, CONTENT_TYPE},
    StatusCode,
};
use axum::response::{IntoResponse, Response};
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::server::{ClientHello, ResolvesServerCert};
use rustls::sign::CertifiedKey;
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};

use crate::service::ca_service::CaService;

use super::super::state::ProxyState;

const HOST_CERT_CACHE_CAPACITY: usize = 500;

struct LruCertStore {
    map: HashMap<String, (Arc<CertifiedKey>, String)>,
    order: VecDeque<String>,
}

impl LruCertStore {
    fn new() -> Self {
        Self {
            map: HashMap::new(),
            order: VecDeque::new(),
        }
    }

    fn get(&mut self, host: &str) -> Option<(Arc<CertifiedKey>, String)> {
        let (ck, pem) = self.map.get(host)?;
        // Move host to back of order (most recently used)
        if let Some(pos) = self.order.iter().position(|h| h == host) {
            self.order.remove(pos);
            self.order.push_back(host.to_string());
        }
        Some((Arc::clone(ck), pem.clone()))
    }

    fn insert(&mut self, host: String, entry: (Arc<CertifiedKey>, String)) {
        if self.map.contains_key(&host) {
            if let Some(pos) = self.order.iter().position(|h| h == &host) {
                self.order.remove(pos);
            }
        } else if self.map.len() >= HOST_CERT_CACHE_CAPACITY {
            // Evict oldest item
            if let Some(oldest) = self.order.pop_front() {
                self.map.remove(&oldest);
            }
        }
        self.order.push_back(host.clone());
        self.map.insert(host, entry);
    }
}

pub(crate) struct HostCertCache {
    inner: Mutex<LruCertStore>,
    ca_service: Arc<CaService>,
}

impl HostCertCache {
    pub(crate) fn new(ca_service: Arc<CaService>) -> Self {
        Self {
            inner: Mutex::new(LruCertStore::new()),
            ca_service,
        }
    }

    pub(crate) fn get_or_create(&self, host: &str) -> Option<(Arc<CertifiedKey>, String)> {
        {
            let mut g = self.inner.lock().ok()?;
            if let Some(res) = g.get(host) {
                return Some(res);
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
            g.insert(host.to_string(), (Arc::clone(&ck), pem.clone()));
            Some((ck, pem))
        }
    }
}

pub(crate) struct DynamicCertResolver {
    pub(crate) cache: Arc<HostCertCache>,
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

/// Return PEM for download. Uses the same cert as TLS for this host (from shared cache) so installing it trusts the server.
pub(crate) fn serve_cert_pem(state: Arc<ProxyState>, host: &str) -> Response {
    let Some((_, pem)) = state.cert_cache.get_or_create(host) else {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to generate certificate",
        )
            .into_response();
    };
    // .crt 확장자로 내려주면 Windows에서 더블클릭 시 인증서 설치 마법사가 뜸 (.pem은 연결 프로그램 없음)
    let filename = format!("horizon-gateway-{}.crt", host.replace(['.', ':'], "-"));
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
