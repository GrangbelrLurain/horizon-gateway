
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Scenario {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
}
