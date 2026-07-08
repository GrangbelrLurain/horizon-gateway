use crate::model::domain::Domain;
use crate::model::local_route::LocalRoute;
use crate::service::domain_hostname::domain_url_to_hostname;
use crate::service::local_proxy::route_domain_to_host;
use crate::storage::versioned::{load_versioned, save_versioned};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct LocalRouteService {
    routes: Mutex<Vec<LocalRoute>>,
    storage_path: PathBuf,
}

impl LocalRouteService {
    pub fn new(storage_path: PathBuf) -> Self {
        let routes = load_versioned(&storage_path);
        Self {
            routes: Mutex::new(routes),
            storage_path,
        }
    }

    fn save(&self, list: &[LocalRoute]) {
        save_versioned(&self.storage_path, list);
    }

    pub fn get_all(&self) -> Vec<LocalRoute> {
        self.routes.lock().unwrap().clone()
    }

    /// Returns enabled routes only (for proxy lookup).
    pub fn get_enabled(&self) -> Vec<LocalRoute> {
        self.routes
            .lock()
            .unwrap()
            .iter()
            .filter(|r| r.enabled)
            .cloned()
            .collect()
    }

    /// Align routes with the domain list: backfill `domain_id`, drop orphans, refresh hostnames, dedupe.
    pub fn sync_with_domains(&self, domains: &[Domain]) {
        let domain_by_id: HashMap<u32, &Domain> = domains.iter().map(|d| (d.id, d)).collect();
        let host_to_id: HashMap<String, u32> = domains
            .iter()
            .map(|d| (domain_url_to_hostname(&d.url), d.id))
            .collect();

        let mut list = self.routes.lock().unwrap();
        let mut changed = false;

        for route in list.iter_mut() {
            if route.domain_id == 0 {
                let host = route_domain_to_host(&route.domain).to_lowercase();
                if let Some(&id) = host_to_id.get(&host) {
                    route.domain_id = id;
                    changed = true;
                }
            }
        }

        let before_len = list.len();
        list.retain(|route| domain_by_id.contains_key(&route.domain_id));
        if list.len() != before_len {
            changed = true;
        }

        for route in list.iter_mut() {
            if let Some(domain) = domain_by_id.get(&route.domain_id) {
                let expected = domain_url_to_hostname(&domain.url);
                if route.domain != expected {
                    route.domain = expected;
                    changed = true;
                }
            }
        }

        if dedupe_by_domain_id(&mut list) {
            changed = true;
        }

        if changed {
            self.save(&list);
        }
    }

    pub fn add(
        &self,
        domain_id: u32,
        domains: &[Domain],
        target_host: String,
        target_port: u16,
    ) -> Result<LocalRoute, String> {
        let domain = domains
            .iter()
            .find(|d| d.id == domain_id)
            .ok_or_else(|| format!("Domain {domain_id} not found"))?;

        let mut list = self.routes.lock().unwrap();
        if list.iter().any(|r| r.domain_id == domain_id) {
            return Err(format!("A proxy route already exists for domain {domain_id}"));
        }

        let next_id = list.iter().map(|r| r.id).max().unwrap_or(0) + 1;
        let route = LocalRoute {
            id: next_id,
            domain_id,
            domain: domain_url_to_hostname(&domain.url),
            target_host,
            target_port,
            enabled: true,
        };
        list.push(route.clone());
        self.save(&list);
        Ok(route)
    }

    pub fn update(
        &self,
        id: u32,
        domains: &[Domain],
        target_host: Option<String>,
        target_port: Option<u16>,
        enabled: Option<bool>,
    ) -> Result<Option<LocalRoute>, String> {
        let domain_ids: HashSet<u32> = domains.iter().map(|d| d.id).collect();
        let mut list = self.routes.lock().unwrap();
        let pos = match list.iter().position(|r| r.id == id) {
            Some(p) => p,
            None => return Ok(None),
        };

        if !domain_ids.contains(&list[pos].domain_id) {
            return Err(format!(
                "Route {id} is linked to a domain that no longer exists"
            ));
        }

        let r = &mut list[pos];
        if let Some(h) = target_host {
            r.target_host = h;
        }
        if let Some(p) = target_port {
            r.target_port = p;
        }
        if let Some(e) = enabled {
            r.enabled = e;
        }

        if let Some(domain) = domains.iter().find(|d| d.id == r.domain_id) {
            r.domain = domain_url_to_hostname(&domain.url);
        }

        let out = r.clone();
        self.save(&list);
        Ok(Some(out))
    }

    pub fn remove(&self, id: u32) -> Option<LocalRoute> {
        let mut list = self.routes.lock().unwrap();
        let pos = list.iter().position(|r| r.id == id)?;
        let removed = list.remove(pos);
        self.save(&list);
        Some(removed)
    }

    pub fn remove_for_domain(&self, domain_id: u32) {
        let mut list = self.routes.lock().unwrap();
        let before = list.len();
        list.retain(|r| r.domain_id != domain_id);
        if list.len() != before {
            self.save(&list);
        }
    }

    pub fn set_enabled(
        &self,
        id: u32,
        enabled: bool,
        domains: &[Domain],
    ) -> Result<Option<LocalRoute>, String> {
        self.update(id, domains, None, None, Some(enabled))
    }

    /// Replace all routes (for import). Invalid/orphan routes are dropped.
    pub fn replace_all(&self, routes: Vec<LocalRoute>, domains: &[Domain]) -> Vec<LocalRoute> {
        {
            let mut guard = self.routes.lock().unwrap();
            *guard = routes;
        }
        self.sync_with_domains(domains);
        self.get_all()
    }
}

/// Keep the newest route per `domain_id`.
fn dedupe_by_domain_id(list: &mut Vec<LocalRoute>) -> bool {
    let mut keep_ids = HashSet::new();
    let mut best_per_domain: HashMap<u32, u32> = HashMap::new();
    for route in list.iter() {
        best_per_domain
            .entry(route.domain_id)
            .and_modify(|best_id| {
                if route.id > *best_id {
                    *best_id = route.id;
                }
            })
            .or_insert(route.id);
    }
    keep_ids.extend(best_per_domain.values().copied());
    let before = list.len();
    list.retain(|route| keep_ids.contains(&route.id));
    list.len() != before
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::domain::Domain;

    fn temp_service() -> LocalRouteService {
        let dir = std::env::temp_dir().join(format!(
            "watchtower-route-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        LocalRouteService::new(dir.join("routes.json"))
    }

    fn sample_domains() -> Vec<Domain> {
        vec![
            Domain {
                id: 1,
                url: "https://api.example.com".to_string(),
            },
            Domain {
                id: 2,
                url: "https://dev.local".to_string(),
            },
        ]
    }

    #[test]
    fn sync_drops_orphan_routes_and_backfills_domain_id() {
        let service = temp_service();
        let domains = sample_domains();
        service.replace_all(
            vec![
                LocalRoute {
                    id: 1,
                    domain_id: 0,
                    domain: "api.example.com".to_string(),
                    target_host: "127.0.0.1".to_string(),
                    target_port: 3000,
                    enabled: true,
                },
                LocalRoute {
                    id: 2,
                    domain_id: 99,
                    domain: "ghost.local".to_string(),
                    target_host: "127.0.0.1".to_string(),
                    target_port: 4000,
                    enabled: true,
                },
            ],
            &domains,
        );
        let routes = service.get_all();

        assert_eq!(routes.len(), 1);
        assert_eq!(routes[0].domain_id, 1);
        assert_eq!(routes[0].domain, "api.example.com");
    }

    #[test]
    fn remove_for_domain_deletes_linked_route() {
        let service = temp_service();
        let domains = sample_domains();
        service
            .add(1, &domains, "127.0.0.1".to_string(), 3000)
            .unwrap();
        service.remove_for_domain(1);
        assert!(service.get_all().is_empty());
    }

    #[test]
    fn add_rejects_unknown_domain_and_duplicate() {
        let service = temp_service();
        let domains = sample_domains();
        assert!(service
            .add(99, &domains, "127.0.0.1".to_string(), 3000)
            .is_err());
        service
            .add(1, &domains, "127.0.0.1".to_string(), 3000)
            .unwrap();
        assert!(service
            .add(1, &domains, "127.0.0.1".to_string(), 3001)
            .is_err());
    }
}
