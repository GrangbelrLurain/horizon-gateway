use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SchemaProperty {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub prop_type: String,
    pub description: String,
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedJsonSchema {
    pub id: String,
    pub name: String,
    pub description: String,
    pub properties: Vec<SchemaProperty>,
    pub schema_text: String,
    #[specta(type = f64)]
    pub created_at: u64,
    #[specta(type = f64)]
    pub updated_at: u64,
}
