use crate::model::domain::Domain;
use crate::model::domain_api_logging_link::DomainApiLoggingLink;
use crate::storage::versioned::{load_versioned, save_versioned};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};

/// 도메인별 API 로깅 설정 서비스.
///
/// - `links`: JSON 파일에 저장되는 `DomainApiLoggingLink` 목록 (`domain_id` 기준)
/// - `settings_map`: 프록시가 실시간으로 조회하는 호스트 → (`logging_enabled`, `body_enabled`) 맵
///
/// `refresh_map`을 호출하면 `links`와 도메인 목록으로부터 `settings_map`을 재구성합니다.
pub struct ApiLoggingSettingsService {
    storage_path: PathBuf,
    links: Mutex<Vec<DomainApiLoggingLink>>,
    /// 호스트명(소문자) → (`logging_enabled`, `body_enabled`)
    settings_map: Arc<RwLock<HashMap<String, (bool, bool)>>>,
}

/// URL → host 추출 (소문자). "<https://example.com:8080/path>" → "example.com"
fn url_to_host(url: &str) -> Option<String> {
    let url = url.trim();
    if url.is_empty() {
        return None;
    }
    // Remove scheme
    let after_scheme = if let Some(rest) = url.strip_prefix("https://") {
        rest
    } else if let Some(rest) = url.strip_prefix("http://") {
        rest
    } else {
        url
    };
    // Remove path
    let authority = after_scheme.split('/').next().unwrap_or(after_scheme);
    // Remove port
    let host = authority.split(':').next().unwrap_or(authority);
    if host.is_empty() {
        None
    } else {
        Some(host.to_lowercase())
    }
}

impl ApiLoggingSettingsService {
    pub fn new(storage_path: PathBuf) -> Self {
        let links: Vec<DomainApiLoggingLink> = load_versioned(&storage_path);
        Self {
            storage_path,
            links: Mutex::new(links),
            settings_map: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn save(&self, list: &[DomainApiLoggingLink]) {
        save_versioned(&self.storage_path, &list.to_vec());
    }

    /// `settings_map` 의 `Arc` 클론 반환 (프록시에서 사용).
    pub fn settings_map_arc(&self) -> Arc<RwLock<HashMap<String, (bool, bool)>>> {
        Arc::clone(&self.settings_map)
    }

    /// links + domains 정보를 기반으로 `settings_map` 재구성.
    /// 도메인 URL 호스트, `schema_url` 호스트(API 서버), 3단계 이상 호스트의 부모 도메인도 등록.
    pub fn refresh_map(&self, domains: &[Domain]) {
        let links = self.links.lock().unwrap();
        let domain_map: HashMap<u32, &Domain> = domains.iter().map(|d| (d.id, d)).collect();
        let mut map = HashMap::new();
        for link in links.iter() {
            if let Some(domain) = domain_map.get(&link.domain_id) {
                let cfg = (link.logging_enabled, link.body_enabled);
                if let Some(host) = url_to_host(&domain.url) {
                    map.insert(host.clone(), cfg);
                }
                if let Some(ref schema_url) = link.schema_url {
                    if let Some(api_host) = url_to_host(schema_url) {
                        map.insert(api_host.clone(), cfg);
                    }
                }
            }
        }
        let mut w = self.settings_map.write().unwrap();
        *w = map;
    }

    /// 프록시에서 특정 호스트의 로깅 설정 조회.
    #[allow(dead_code)]
    pub fn get_for_host(&self, host: &str) -> Option<(bool, bool)> {
        let r = self.settings_map.read().unwrap();
        r.get(&host.to_lowercase()).copied()
    }

    /// 모든 링크 조회.
    pub fn get_links(&self) -> Vec<DomainApiLoggingLink> {
        self.links.lock().unwrap().clone()
    }

    /// 도메인 로깅 설정 추가/변경 후 `settings_map` 갱신.
    pub fn set_link(
        &self,
        domain_id: u32,
        logging_enabled: bool,
        body_enabled: bool,
        schema_url: Option<String>,
        domains: &[Domain],
    ) -> Vec<DomainApiLoggingLink> {
        let mut links = self.links.lock().unwrap();
        if let Some(existing) = links.iter_mut().find(|l| l.domain_id == domain_id) {
            existing.logging_enabled = logging_enabled;
            existing.body_enabled = body_enabled;
            existing.schema_url = schema_url;
        } else {
            links.push(DomainApiLoggingLink {
                domain_id,
                logging_enabled,
                body_enabled,
                schema_url,
            });
        }
        self.save(&links);
        drop(links);
        self.refresh_map(domains);
        self.links.lock().unwrap().clone()
    }

    /// 도메인 로깅 설정 제거 후 `settings_map` 갱신.
    pub fn remove_link(&self, domain_id: u32, domains: &[Domain]) {
        let mut links = self.links.lock().unwrap();
        links.retain(|l| l.domain_id != domain_id);
        self.save(&links);
        drop(links);
        self.refresh_map(domains);
    }
}
