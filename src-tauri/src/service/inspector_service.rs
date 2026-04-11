use crate::model::inspector::Annotation;
use crate::storage::versioned::{load_versioned, save_versioned};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct InspectorService {
    pub annotations: Mutex<Vec<Annotation>>,
    pub storage_path: PathBuf,
}

impl InspectorService {
    pub fn new(storage_path: PathBuf) -> Self {
        let initial_annotations = load_versioned(&storage_path);
        Self {
            annotations: Mutex::new(initial_annotations),
            storage_path,
        }
    }

    fn persist(&self, list: &Vec<Annotation>) {
        save_versioned(&self.storage_path, list);
    }

    pub fn get_all(&self) -> Vec<Annotation> {
        self.annotations.lock().unwrap().clone()
    }

    pub fn add_annotation(&self, annotation: Annotation) {
        let mut list = self.annotations.lock().unwrap();
        list.push(annotation);
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
}
