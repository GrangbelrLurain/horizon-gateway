#[derive(serde::Serialize, serde::Deserialize, Clone, specta::Type)]
pub struct Domain {
    pub id: u32,
    pub url: String,
}
