use crate::model::domain::Domain;
use crate::storage::versioned::{load_versioned, save_versioned};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
#[derive(Clone)]
pub struct DomainService {
    pub domains: Arc<Mutex<Vec<Domain>>>,
    pub storage_path: PathBuf,
}

impl DomainService {
    pub fn new(storage_path: PathBuf) -> Self {
        let initial_domains = load_versioned(&storage_path);
        Self {
            domains: Arc::new(Mutex::new(initial_domains)),
            storage_path,
        }
    }

    fn save(&self, list: &Vec<Domain>) {
        save_versioned(&self.storage_path, list);
    }

    /// 기존에 없는 URL만 등록. 중복 URL(DB·요청 내)은 건너뜀. 실제로 추가된 도메인만 반환.
    pub fn add_domains(&self, urls: Vec<String>) -> Vec<Domain> {
        let mut list = self.domains.lock().unwrap();
        let mut seen: HashSet<String> = list.iter().map(|d| d.url.clone()).collect();
        let mut next_id = list.iter().map(|d| d.id).max().unwrap_or(0) + 1;
        let mut added = Vec::new();

        for url in urls {
            if seen.contains(&url) {
                continue;
            }
            seen.insert(url.clone());
            let domain = Domain {
                id: next_id,
                url: url.clone(),
            };
            list.push(domain.clone());
            added.push(domain);
            next_id += 1;
        }
        if !added.is_empty() {
            self.save(&list);
        }
        added
    }

    pub fn get_all(&self) -> Vec<Domain> {
        self.domains.lock().unwrap().clone()
    }

    pub fn get_domain_by_id(&self, id: u32) -> Option<Domain> {
        self.domains
            .lock()
            .unwrap()
            .iter()
            .find(|domain| domain.id == id)
            .cloned()
    }

    pub fn delete_domain(&self, id: u32) -> Vec<Domain> {
        let mut list = self.domains.lock().unwrap();
        list.retain(|domain| domain.id != id);
        self.save(&list);
        list.clone()
    }

    /// URL 수정. 다른 도메인이 이미 사용 중인 URL이면 변경하지 않음. 성공 시 해당 도메인만 담은 Vec 반환.
    /// `url: None`이면 URL은 변경하지 않음.
    pub fn update_domain(&self, id: u32, url: Option<String>) -> Vec<Domain> {
        let mut list = self.domains.lock().unwrap();
        if let Some(ref new_url) = url {
            let duplicate = list
                .iter()
                .any(|d| d.id != id && d.url == *new_url);
            if duplicate {
                return Vec::new();
            }
            if let Some(domain) = list.iter_mut().find(|d| d.id == id) {
                domain.url.clone_from(new_url);
            }
        }
        self.save(&list);
        list.iter()
            .filter(|d| d.id == id)
            .cloned()
            .collect()
    }

    pub fn import_from_json(&self, domains: Vec<Domain>) -> Vec<Domain> {
        let mut list = self.domains.lock().unwrap();
        *list = domains;
        self.save(&list);
        list.clone()
    }
}
