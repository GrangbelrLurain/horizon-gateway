use crate::model::domain_group::DomainGroup;
use crate::storage::versioned::{load_versioned, save_versioned};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DomainGroupService {
    pub groups: Mutex<Vec<DomainGroup>>,
    pub storage_path: PathBuf,
}

impl DomainGroupService {
    pub fn new(storage_path: PathBuf) -> Self {
        let initial_groups = load_versioned(&storage_path);
        Self {
            groups: Mutex::new(initial_groups),
            storage_path,
        }
    }

    fn save(&self, list: &Vec<DomainGroup>) {
        save_versioned(&self.storage_path, list);
    }

    pub fn add_group(&self, name: String) -> Vec<DomainGroup> {
        let mut list = self.groups.lock().unwrap();
        let next_id = list.iter().map(|g| g.id).max().unwrap_or(0) + 1;

        list.push(DomainGroup {
            id: next_id,
            name,
        });
        
        self.save(&list);
        list.clone()
    }

    pub fn get_all(&self) -> Vec<DomainGroup> {
        self.groups.lock().unwrap().clone()
    }

    pub fn delete_group(&self, id: u32) -> Vec<DomainGroup> {
        let mut list = self.groups.lock().unwrap();
        list.retain(|group| group.id != id);
        self.save(&list);
        list.clone()
    }

    pub fn update_group(&self, id: u32, name: String) -> Vec<DomainGroup> {
        let mut list = self.groups.lock().unwrap();
        if let Some(group) = list.iter_mut().find(|group| group.id == id) {
            group.name = name;
        }
        self.save(&list);
        list.clone()
    }

    /// Replace all groups with the given list (for import).
    pub fn replace_all(&self, groups: Vec<DomainGroup>) -> Vec<DomainGroup> {
        let mut list = self.groups.lock().unwrap();
        *list = groups;
        self.save(&list);
        list.clone()
    }
}
