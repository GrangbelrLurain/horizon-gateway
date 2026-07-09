use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedCryptoPreset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub action: String,
    pub payload: String,
    pub key: String,
    pub iv: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[specta(type = f64)]
    pub created_at: u64,
    #[specta(type = f64)]
    pub updated_at: u64,
}
