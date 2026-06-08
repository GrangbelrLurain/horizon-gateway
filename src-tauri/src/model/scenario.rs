
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct Scenario {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
}
