use crate::model::domain::Domain;
use crate::model::domain_monitor_link::{DomainMonitorLink, DomainMonitorWithUrl};
use crate::model::domain_status_log::DomainStatusLog;
use crate::model::settings_export::DomainMonitorExport;
use crate::storage::versioned::{load_versioned, save_versioned};
use crate::service::domain_group_link_service::DomainGroupLinkService;
use crate::service::domain_service::DomainService;
use crate::service::domain_group_service::DomainGroupService;
use crate::service::proxy_settings_service::ProxySettingsService;
use chrono::{Local, Utc};
use hickory_resolver::config::{NameServerConfigGroup, ResolverConfig};
use hickory_resolver::name_server::TokioConnectionProvider;
use hickory_resolver::Resolver;
use std::collections::{HashMap, HashSet};
use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DomainMonitorService {
    pub last_checks: Mutex<Vec<DomainStatusLog>>,
    pub base_dir: PathBuf,
    monitor_links_path: PathBuf,
    monitor_links: Mutex<Vec<DomainMonitorLink>>,
}

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

/// Extract hostname from URL (no port). e.g. "<https://example.com:8080/path>" -> "example.com".
fn host_from_url(url: &str) -> Option<String> {
    let url = url.trim();
    let authority = if let Some(rest) = url.strip_prefix("https://") {
        rest.split('/').next().unwrap_or(rest)
    } else if let Some(rest) = url.strip_prefix("http://") {
        rest.split('/').next().unwrap_or(rest)
    } else if !url.is_empty() && !url.starts_with('/') {
        url.split('/').next().unwrap_or(url)
    } else {
        return None;
    };
    let host = if let Some((h, p)) = authority.split_once(':') {
        if p.chars().all(|c| c.is_ascii_digit()) {
            h
        } else {
            authority
        }
    } else {
        authority
    };
    Some(host.to_string())
}

impl DomainMonitorService {
    pub fn new(base_dir: PathBuf, monitor_links_path: PathBuf) -> Self {
        if !base_dir.exists() {
            create_dir_all(&base_dir).expect("failed to create logs directory");
        }
        let monitor_links = load_versioned(&monitor_links_path);
        Self {
            last_checks: Mutex::new(Vec::new()),
            base_dir,
            monitor_links_path,
            monitor_links: Mutex::new(monitor_links),
        }
    }

    fn load_monitor_links(&self) -> Vec<DomainMonitorLink> {
        self.monitor_links.lock().unwrap().clone()
    }

    fn save_monitor_links(&self, list: &[DomainMonitorLink]) {
        save_versioned(&self.monitor_links_path, list);
        *self.monitor_links.lock().unwrap() = list.to_vec();
    }

    pub fn get_domain_monitor_list(
        &self,
        domain_service: &DomainService,
    ) -> Vec<DomainMonitorWithUrl> {
        let list = self.load_monitor_links();
        let domains = domain_service.get_all();
        list.into_iter()
            .filter_map(|ds| {
                domains
                    .iter()
                    .find(|d| d.id == ds.domain_id)
                    .map(|d| DomainMonitorWithUrl {
                        domain_id: d.id,
                        url: d.url.clone(),
                        check_enabled: ds.check_enabled,
                        interval_secs: ds.interval_secs,
                    })
            })
            .collect()
    }

    pub fn set_domain_monitor_check_enabled(&self, domain_ids: &[u32], enabled: bool) {
        let mut list = self.load_monitor_links();
        let ids: std::collections::HashSet<u32> = domain_ids.iter().copied().collect();
        for ds in &mut list {
            if ids.contains(&ds.domain_id) {
                ds.check_enabled = enabled;
            }
        }
        self.save_monitor_links(&list);
    }

    /// Export용: `monitor_links를` url 키로 변환 (status log는 제외)
    pub fn get_domain_monitor_for_export(&self, domain_service: &DomainService) -> Vec<DomainMonitorExport> {
        let list = self.load_monitor_links();
        let domains = domain_service.get_all();
        list.into_iter()
            .filter_map(|ds| {
                domains
                    .iter()
                    .find(|d| d.id == ds.domain_id)
                    .map(|d| DomainMonitorExport {
                        url: d.url.clone(),
                        check_enabled: ds.check_enabled,
                        interval_secs: ds.interval_secs,
                    })
            })
            .collect()
    }

    /// Import: monitor 설정 복원 (URL로 매칭). status log는 제외되어 있음.
    pub fn import_domain_monitor(&self, list: &[DomainMonitorExport], domain_service: &DomainService) {
        let url_to_export: HashMap<&str, &DomainMonitorExport> = list
            .iter()
            .map(|e| (e.url.as_str(), e))
            .collect();
        let mut monitor_list = self.load_monitor_links();
        let domains = domain_service.get_all();
        for ds in &mut monitor_list {
            if let Some(d) = domains.iter().find(|x| x.id == ds.domain_id) {
                if let Some(exp) = url_to_export.get(d.url.as_str()) {
                    ds.check_enabled = exp.check_enabled;
                    ds.interval_secs = exp.interval_secs;
                }
            }
        }
        self.save_monitor_links(&monitor_list);
    }

    /// domains 목록과 동기화. 새 도메인 추가, 삭제된 도메인 제거
    pub fn sync_with_domains(&self, domains: &[Domain]) {
        let mut list = self.load_monitor_links();
        let domain_ids: HashSet<u32> = domains.iter().map(|d| d.id).collect();
        list.retain(|ds| domain_ids.contains(&ds.domain_id));
        for d in domains {
            if !list.iter().any(|ds| ds.domain_id == d.id) {
                list.push(DomainMonitorLink {
                    domain_id: d.id,
                    check_enabled: true,
                    interval_secs: 120,
                });
            }
        }
        self.save_monitor_links(&list);
    }

    fn get_domain_ids_to_check(&self, domain_service: &DomainService) -> Vec<u32> {
        let list = self.load_monitor_links();
        if list.is_empty() {
            return domain_service.get_all().iter().map(|d| d.id).collect();
        }
        list.iter()
            .filter(|ds| ds.check_enabled)
            .map(|ds| ds.domain_id)
            .collect()
    }

    pub async fn check_domains(
        &self,
        domain_service: &DomainService,
        group_service: &DomainGroupService,
        link_service: &DomainGroupLinkService,
        proxy_settings_service: &ProxySettingsService,
    ) -> Vec<DomainStatusLog> {
        let domain_ids = self.get_domain_ids_to_check(domain_service);
        let domains: Vec<Domain> = domain_service
            .get_all()
            .into_iter()
            .filter(|d| domain_ids.contains(&d.id))
            .collect();
        let groups = group_service.get_all();
        let dns_server = proxy_settings_service.get().dns_server;

        let mut client_builder = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent("horizon-gateway/0.1.0");

        if let Some(ref dns) = dns_server {
            if let Some((ip, port)) = parse_dns_server(dns) {
                let config = ResolverConfig::from_parts(
                    None,
                    vec![],
                    NameServerConfigGroup::from_ips_clear(&[ip], port, true),
                );
                let resolver = Resolver::builder_with_config(
                    config,
                    TokioConnectionProvider::default(),
                )
                .build();
                {
                    let full_urls: Vec<String> = domains
                        .iter()
                        .map(|d| {
                            if d.url.starts_with("http") {
                                d.url.clone()
                            } else {
                                format!("https://{}", d.url)
                            }
                        })
                        .collect();
                    let unique_hosts: HashSet<String> = full_urls
                        .iter()
                        .filter_map(|u| host_from_url(u))
                        .collect();
                    let mut host_to_ip: HashMap<String, IpAddr> = HashMap::new();
                    for host in &unique_hosts {
                        if let Ok(lookup) = resolver.lookup_ip(host.as_str()).await {
                            if let Some(addr) = lookup.iter().next(){
                                host_to_ip.insert(host.clone(), addr);
                            }
                        }
                    }
                    for (host, addr) in &host_to_ip {
                        client_builder = client_builder.resolve(
                            host.as_str(),
                            SocketAddr::new(*addr, 443),
                        );
                    }
                }
            }
        }

        let client = client_builder
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        let tasks: Vec<_> = domains
            .into_iter()
            .map(|domain| {
                let client = client.clone();
                let group_ids = link_service.get_group_ids_for_domain(domain.id);
                let group_name = if group_ids.is_empty() {
                    "Default".to_string()
                } else {
                    group_ids
                        .iter()
                        .filter_map(|gid| groups.iter().find(|g| g.id == *gid))
                        .map(|g| g.name.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                };

                async move {
                    let start = std::time::Instant::now();
                    let url = if domain.url.starts_with("http") {
                        domain.url.clone()
                    } else {
                        format!("https://{}", domain.url)
                    };

                    let response = client.head(&url).send().await;
                    let latency = start.elapsed().as_millis() as u32;

                    match response {
                        Ok(resp) => {
                            let sc = resp.status();
                            let ok = sc.is_success() || sc.is_redirection();
                            DomainStatusLog {
                                url: domain.url.clone(),
                                status: format!("{sc}"),
                                level: if ok {
                                    "info".to_string()
                                } else if sc.is_client_error() {
                                    "warning".to_string()
                                } else {
                                    "error".to_string()
                                },
                                latency,
                                ok,
                                group: group_name.clone(),
                                timestamp: Utc::now(),
                                error_message: if ok {
                                    Some("Operation successful".to_string())
                                } else {
                                    Some(format!("HTTP Error: {sc}"))
                                },
                            }
                        }
                        Err(e) => DomainStatusLog {
                            url: domain.url.clone(),
                            status: "Request Error".to_string(),
                            level: "error".to_string(),
                            latency,
                            ok: false,
                            group: group_name,
                            timestamp: Utc::now(),
                            error_message: Some(e.to_string()),
                        },
                    }
                }
            })
            .collect();

        let results = futures::future::join_all(tasks).await;

        // Save logs to file
        let today = Local::now().format("%Y-%m-%d").to_string();
        let log_file_path = self.base_dir.join(format!("{today}.json"));

        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file_path)
        {
            for result in &results {
                if let Ok(json) = serde_json::to_string(result) {
                    let _ = writeln!(file, "{json}");
                }
            }
        }

        let mut last_checks = self.last_checks.lock().unwrap();
        (*last_checks).clone_from(&results);

        results
    }

    pub fn get_last_status(&self) -> Vec<DomainStatusLog> {
        self.last_checks.lock().unwrap().clone()
    }

    pub fn get_logs_by_date(&self, date: String) -> Vec<DomainStatusLog> {
        let log_file_path = self.base_dir.join(format!("{date}.json"));
        if !log_file_path.exists() {
            return Vec::new();
        }

        let content = std::fs::read_to_string(log_file_path).unwrap_or_default();
        content
            .lines()
            .filter_map(|line| serde_json::from_str::<DomainStatusLog>(line).ok())
            .collect()
    }
}
