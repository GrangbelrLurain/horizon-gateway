use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct MockingSettings {
    pub enabled: bool,
}

impl Default for MockingSettings {
    fn default() -> Self {
        Self { enabled: true }
    }
}
