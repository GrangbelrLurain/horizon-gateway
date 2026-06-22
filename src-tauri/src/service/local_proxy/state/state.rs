use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::service::api_log_service::ApiLogService;
use crate::service::ca_service::CaService;
use crate::service::local_route_service::LocalRouteService;

use crate::service::local_proxy::dns::{build_resolver, TokioResolver};
use crate::service::local_proxy::tls::HostCertCache;

pub struct ProxyState {
    pub app_handle: tauri::AppHandle,
    pub(crate) route_service: Arc<LocalRouteService>,
    pub(crate) resolver: Option<Arc<TokioResolver>>,
    pub forward_proxy_port: Option<u16>,
    pub(crate) cert_cache: Arc<HostCertCache>,
    /// 호스트(소문자) → (`logging_enabled`, `body_enabled`). API 로깅 대상이면 CONNECT 시 TLS 종료 후 `proxy_app으로`.
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
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn new(
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
        let resolver = dns_server.as_deref().and_then(build_resolver);
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
                .no_proxy()
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
