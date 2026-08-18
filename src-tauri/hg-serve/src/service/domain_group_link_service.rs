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
            list.push(DomainGroupLink {
                domain_id,
                group_id,
            });
        }
        self.save(&list);
    }

    /// Replace all groups for this domain with the given `group_ids`.
    pub fn set_groups_for_domain(&self, domain_id: u32, group_ids: Vec<u32>) {
        self.set_groups_for_domains(&[domain_id], &group_ids);
    }

    /// Replace all groups for multiple domains with the given `group_ids`.
    pub fn set_groups_for_domains(&self, domain_ids: &[u32], group_ids: &[u32]) {
        let mut list = self.links.lock().unwrap();
        let domain_set: std::collections::HashSet<u32> = domain_ids.iter().copied().collect();
        list.retain(|l| !domain_set.contains(&l.domain_id));
        for &domain_id in domain_ids {
            for &group_id in group_ids {
                list.push(DomainGroupLink {
                    domain_id,
                    group_id,
                });
            }
        }
        self.save(&list);
    }

    pub fn remove_links_for_domain(&self, domain_id: u32) {
        let mut set = std::collections::HashSet::new();
        set.insert(domain_id);
        self.remove_links_for_domains(&set);
    }

    pub fn remove_links_for_domains(&self, domain_ids: &std::collections::HashSet<u32>) {
        let mut list = self.links.lock().unwrap();
        let before = list.len();
        list.retain(|l| !domain_ids.contains(&l.domain_id));
        if list.len() != before {
            self.save(&list);
        }
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
            list.push(DomainGroupLink {
                domain_id,
                group_id,
            });
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
