use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
pub struct Annotation {
    pub id: String,
    pub selector: String,
    pub content: String,
    #[serde(rename = "tagName")]
    pub tag_name: String,
    pub thumbnail: String,
    pub role: String,
    pub description: String,
    #[specta(type = f64)]
    pub timestamp: u64,
    #[serde(default)]
    pub domain: String,
    #[serde(default)]
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, specta::Type)]
#[derive(Default)]
pub struct InspectorSettings {
    pub enabled: bool,
}

