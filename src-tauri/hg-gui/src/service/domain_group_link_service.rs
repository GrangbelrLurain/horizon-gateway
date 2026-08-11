use crate::model::domain_group_link::DomainGroupLink;
use crate::storage::versioned::{load_versioned, save_versioned};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DomainGroupLinkService {
    links: Mutex<Vec<DomainGroupLink>>,
    storage_path: PathBuf,
}

impl DomainGroupLinkService {
    pub fn new(storage_path: PathBuf) -> Self {
        let initial_links = load_versioned(&storage_path);
        Self {
            links: Mutex::new(initial_links),
            storage_path,
        }
    }

    fn save(&self, list: &[DomainGroupLink]) {
        save_versioned(&self.storage_path, list);
    }

    pub fn get_domain_ids_for_group(&self, group_id: u32) -> Vec<u32> {
        self.links
            .lock()
            .unwrap()
            .iter()
            .filter(|l| l.group_id == group_id)
            .map(|l| l.domain_id)
            .collect()
    }

    pub fn get_group_ids_for_domain(&self, domain_id: u32) -> Vec<u32> {
        self.links
            .lock()
            .unwrap()
            .iter()
            .filter(|l| l.domain_id == domain_id)
            .map(|l| l.group_id)
            .collect()
    }

    pub fn get_all_links(&self) -> Vec<DomainGroupLink> {
        self.links.lock().unwrap().clone()
    }

    /// Replace all domains for this group with the given `domain_ids`.
    pub fn set_domains_for_group(&self, group_id: u32, domain_ids: Vec<u32>) {
        let mut list = self.links.lock().unwrap();
        list.retain(|l| l.group_id != group_id);
        for domain_id in domain_ids {
            list.push(DomainGroupLink { domain_id, group_id });
        }
        self.save(&list);
    }

    /// Replace all groups for this domain with the given `group_ids`.
    pub fn set_groups_for_domain(&self, domain_id: u32, group_ids: Vec<u32>) {
        let mut list = self.links.lock().unwrap();
        list.retain(|l| l.domain_id != domain_id);
        for group_id in group_ids {
            list.push(DomainGroupLink { domain_id, group_id });
        }
        self.save(&list);
    }

    pub fn remove_links_for_domain(&self, domain_id: u32) {
        let mut list = self.links.lock().unwrap();
        list.retain(|l| l.domain_id != domain_id);
        self.save(&list);
    }

    pub fn remove_links_for_group(&self, group_id: u32) {
        let mut list = self.links.lock().unwrap();
        list.retain(|l| l.group_id != group_id);
        self.save(&list);
    }

    /// Add domain to group (idempotent: no duplicate links).
    pub fn add_domain_to_group(&self, domain_id: u32, group_id: u32) {
        let mut list = self.links.lock().unwrap();
        let exists = list
            .iter()
            .any(|l| l.domain_id == domain_id && l.group_id == group_id);
        if !exists {
            list.push(DomainGroupLink { domain_id, group_id });
            self.save(&list);
        }
    }

    /// Replace all links (for import).
    pub fn replace_all(&self, links: Vec<DomainGroupLink>) {
        let mut list = self.links.lock().unwrap();
        *list = links;
        self.save(&list);
    }
}
