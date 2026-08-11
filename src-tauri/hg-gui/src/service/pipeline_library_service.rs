use crate::model::saved_pipeline::{SavedPipeline, SavedPipelineFlow};
use crate::storage::versioned::{load_versioned, save_versioned};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub struct PipelineLibraryService {
    items: Mutex<Vec<SavedPipeline>>,
    path: PathBuf,
}

impl PipelineLibraryService {
    pub fn new(path: PathBuf) -> Self {
        let items: Vec<SavedPipeline> = load_versioned(&path);
        Self {
            items: Mutex::new(items),
            path,
        }
    }

    fn save(&self, list: &[SavedPipeline]) {
        save_versioned(&self.path, list);
    }

    pub fn get_all(&self) -> Vec<SavedPipeline> {
        self.items.lock().unwrap().clone()
    }

    pub fn get_by_id(&self, id: &str) -> Option<SavedPipeline> {
        self.items.lock().unwrap().iter().find(|p| p.id == id).cloned()
    }

    pub fn create(&self, name: String, description: String, flow: SavedPipelineFlow) -> SavedPipeline {
        let mut list = self.items.lock().unwrap();
        let ts = now_ms();
        let item = SavedPipeline {
            id: format!("pipeline_{}", Uuid::new_v4()),
            name,
            description,
            flow,
            created_at: ts,
            updated_at: ts,
        };
        list.push(item.clone());
        self.save(&list);
        item
    }

    pub fn update(
        &self,
        id: String,
        name: Option<String>,
        description: Option<String>,
        flow: Option<SavedPipelineFlow>,
    ) -> Option<SavedPipeline> {
        let mut list = self.items.lock().unwrap();
        let item = list.iter_mut().find(|p| p.id == id)?;
        if let Some(n) = name {
            item.name = n;
        }
        if let Some(d) = description {
            item.description = d;
        }
        if let Some(f) = flow {
            item.flow = f;
        }
        item.updated_at = now_ms();
        let out = item.clone();
        self.save(&list);
        Some(out)
    }

    pub fn delete(&self, id: &str) -> bool {
        let mut list = self.items.lock().unwrap();
        let before = list.len();
        list.retain(|p| p.id != id);
        if list.len() == before {
            return false;
        }
        self.save(&list);
        true
    }

    pub fn replace_all(&self, items: Vec<SavedPipeline>) {
        let mut list = self.items.lock().unwrap();
        *list = items;
        self.save(&list);
    }
}
