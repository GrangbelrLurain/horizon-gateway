use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PipelineNodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedPipelineNode {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub config: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<PipelineNodePosition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedPipelineEdge {
    pub id: String,
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, Default)]
#[serde(rename_all = "camelCase")]
pub struct SavedPipelineFlow {
    pub nodes: Vec<SavedPipelineNode>,
    pub edges: Vec<SavedPipelineEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedPipeline {
    pub id: String,
    pub name: String,
    pub description: String,
    pub flow: SavedPipelineFlow,
    #[specta(type = f64)]
    pub created_at: u64,
    #[specta(type = f64)]
    pub updated_at: u64,
}
