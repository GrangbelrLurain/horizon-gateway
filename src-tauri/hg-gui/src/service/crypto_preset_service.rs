use crate::model::saved_crypto_preset::SavedCryptoPreset;
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

pub struct CryptoPresetService {
    items: Mutex<Vec<SavedCryptoPreset>>,
    path: PathBuf,
}

impl CryptoPresetService {
    pub fn new(path: PathBuf) -> Self {
        let items: Vec<SavedCryptoPreset> = load_versioned(&path);
        Self {
            items: Mutex::new(items),
            path,
        }
    }

    fn save(&self, list: &[SavedCryptoPreset]) {
        save_versioned(&self.path, list);
    }

    pub fn get_all(&self) -> Vec<SavedCryptoPreset> {
        self.items.lock().unwrap().clone()
    }

    pub fn get_by_id(&self, id: &str) -> Option<SavedCryptoPreset> {
        self.items.lock().unwrap().iter().find(|p| p.id == id).cloned()
    }

    pub fn create(
        &self,
        name: String,
        description: String,
        action: String,
        payload: String,
        key: String,
        iv: String,
        code: Option<String>,
    ) -> SavedCryptoPreset {
        let mut list = self.items.lock().unwrap();
        let ts = now_ms();
        let item = SavedCryptoPreset {
            id: Uuid::new_v4().to_string(),
            name,
            description,
            action,
            payload,
            key,
            iv,
            code,
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
        action: Option<String>,
        payload: Option<String>,
        key: Option<String>,
        iv: Option<String>,
        code: Option<Option<String>>,
    ) -> Option<SavedCryptoPreset> {
        let mut list = self.items.lock().unwrap();
        let item = list.iter_mut().find(|p| p.id == id)?;
        if let Some(n) = name {
            item.name = n;
        }
        if let Some(d) = description {
            item.description = d;
        }
        if let Some(a) = action {
            item.action = a;
        }
        if let Some(p) = payload {
            item.payload = p;
        }
        if let Some(k) = key {
            item.key = k;
        }
        if let Some(v) = iv {
            item.iv = v;
        }
        if let Some(c) = code {
            item.code = c;
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

    pub fn replace_all(&self, items: Vec<SavedCryptoPreset>) {
        let mut list = self.items.lock().unwrap();
        *list = items;
        self.save(&list);
    }
}
