use axum::http::{
    header::{HeaderValue, CONTENT_TYPE},
    StatusCode,
};
use axum::response::{IntoResponse, Response};
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::server::{ClientHello, ResolvesServerCert};
use rustls::sign::CertifiedKey;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::service::ca_service::CaService;

use super::super::state::ProxyState;

pub(crate) struct HostCertCache {
    inner: Mutex<HashMap<String, (Arc<CertifiedKey>, String)>>,
    ca_service: Arc<CaService>,
}

impl HostCertCache {
    pub(crate) fn new(ca_service: Arc<CaService>) -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            ca_service,
        }
    }

    pub(crate) fn get_or_create(&self, host: &str) -> Option<(Arc<CertifiedKey>, String)> {
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
