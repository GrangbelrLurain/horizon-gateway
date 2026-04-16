use crate::model::inspector::{Annotation, InspectorSettings};
use crate::storage::versioned::{load_versioned, save_versioned};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct InspectorService {
    pub annotations: Arc<Mutex<Vec<Annotation>>>,
    pub storage_path: PathBuf,
    pub injection_domains: Arc<Mutex<Vec<String>>>,
    pub domains_storage_path: PathBuf,
    pub settings: Arc<Mutex<InspectorSettings>>,
    pub settings_storage_path: PathBuf,
}

impl InspectorService {
    pub fn new(storage_path: PathBuf, domains_storage_path: PathBuf, settings_storage_path: PathBuf) -> Self {
        let initial_annotations = load_versioned(&storage_path);
        let initial_domains = load_versioned(&domains_storage_path);
        let initial_settings = load_versioned(&settings_storage_path);
        Self {
            annotations: Arc::new(Mutex::new(initial_annotations)),
            storage_path,
            injection_domains: Arc::new(Mutex::new(initial_domains)),
            domains_storage_path,
            settings: Arc::new(Mutex::new(initial_settings)),
            settings_storage_path,
        }
    }

    fn persist(&self, list: &Vec<Annotation>) {
        save_versioned(&self.storage_path, list);
    }

    fn persist_domains(&self, list: &Vec<String>) {
        save_versioned(&self.domains_storage_path, list);
    }

    pub fn get_settings(&self) -> InspectorSettings {
        self.settings.lock().unwrap().clone()
    }

    pub fn set_enabled(&self, enabled: bool) {
        let mut s = self.settings.lock().unwrap();
        s.enabled = enabled;
        save_versioned(&self.settings_storage_path, &*s);
    }

    pub fn get_all(&self) -> Vec<Annotation> {
        self.annotations.lock().unwrap().clone()
    }

    pub fn add_annotation(&self, annotation: Annotation) {
        let mut list = self.annotations.lock().unwrap();
        list.push(annotation);
        self.persist(&list);
    }

    pub fn import_annotations(&self, annotations: Vec<Annotation>) {
        let mut list = self.annotations.lock().unwrap();
        for ann in annotations {
            // 기존에 같은 ID가 있으면 제거 (덮어쓰기 효과)
            list.retain(|a| a.id != ann.id);
            list.push(ann);
        }
        self.persist(&list);
    }

    pub fn update_annotation(&self, id: String, role: String, description: String) {
        let mut list = self.annotations.lock().unwrap();
        if let Some(ann) = list.iter_mut().find(|a| a.id == id) {
            ann.role = role;
            ann.description = description;
        }
        self.persist(&list);
    }

    pub fn delete_annotation(&self, id: String) {
        let mut list = self.annotations.lock().unwrap();
        list.retain(|a| a.id != id);
        self.persist(&list);
    }

    // ── Injection Domains ──────────────────────────────────────────────────

    pub fn get_injection_domains(&self) -> Vec<String> {
        self.injection_domains.lock().unwrap().clone()
    }

    pub fn set_injection_domains(&self, domains: Vec<String>) {
        let mut list = self.injection_domains.lock().unwrap();
        *list = domains;
        self.persist_domains(&list);
    }
}
