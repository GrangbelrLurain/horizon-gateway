use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Annotation {
    pub id: String,
    pub selector: String,
    pub content: String,
    #[serde(rename = "tagName")]
    pub tag_name: String,
    pub thumbnail: String,
    pub role: String,
    pub description: String,
    pub timestamp: u64,
    #[serde(default)]
    pub domain: String,
    #[serde(default)]
    pub url: String,
}
