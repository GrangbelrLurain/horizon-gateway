use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct ApiResponse<T> {
    pub message: String,
    pub success: bool,
    pub data: T,
}
