use crate::model::saved_json_schema::{SavedJsonSchema, SchemaProperty};
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

pub struct JsonSchemaRegistryService {
    items: Mutex<Vec<SavedJsonSchema>>,
    path: PathBuf,
}

impl JsonSchemaRegistryService {
    pub fn new(path: PathBuf) -> Self {
        let items: Vec<SavedJsonSchema> = load_versioned(&path);
        Self {
            items: Mutex::new(items),
            path,
        }
    }

    fn save(&self, list: &[SavedJsonSchema]) {
        save_versioned(&self.path, list);
    }

    pub fn get_all(&self) -> Vec<SavedJsonSchema> {
        self.items.lock().unwrap().clone()
    }

    pub fn get_by_id(&self, id: &str) -> Option<SavedJsonSchema> {
        self.items.lock().unwrap().iter().find(|s| s.id == id).cloned()
    }

    pub fn create(
        &self,
        name: String,
        description: String,
        properties: Vec<SchemaProperty>,
        schema_text: String,
    ) -> SavedJsonSchema {
        let mut list = self.items.lock().unwrap();
        let ts = now_ms();
        let item = SavedJsonSchema {
            id: Uuid::new_v4().to_string(),
            name,
            description,
            properties,
            schema_text,
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
        properties: Option<Vec<SchemaProperty>>,
        schema_text: Option<String>,
    ) -> Option<SavedJsonSchema> {
        let mut list = self.items.lock().unwrap();
        let item = list.iter_mut().find(|s| s.id == id)?;
        if let Some(n) = name {
            item.name = n;
        }
        if let Some(d) = description {
            item.description = d;
        }
        if let Some(p) = properties {
            item.properties = p;
        }
        if let Some(t) = schema_text {
            item.schema_text = t;
        }
        item.updated_at = now_ms();
        let out = item.clone();
        self.save(&list);
        Some(out)
    }

    pub fn delete(&self, id: &str) -> bool {
        let mut list = self.items.lock().unwrap();
        let before = list.len();
        list.retain(|s| s.id != id);
        if list.len() == before {
            return false;
        }
        self.save(&list);
        true
    }

    pub fn replace_all(&self, items: Vec<SavedJsonSchema>) {
        let mut list = self.items.lock().unwrap();
        *list = items;
        self.save(&list);
    }
}
