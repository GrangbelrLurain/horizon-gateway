use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct DomainGroupLink {
    pub domain_id: u32,
    pub group_id: u32,
}
