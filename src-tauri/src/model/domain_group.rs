use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct DomainGroup {
    pub id: u32,
    pub name: String,
}
