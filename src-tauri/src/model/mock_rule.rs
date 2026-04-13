use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MockRule {
    pub id: String,
    pub name: String,
    pub scenario_id: String,
    pub host: Option<String>, // domain to match
    pub method: String,
    pub url_pattern: String,
    pub response_status: u16,
    pub response_headers: HashMap<String, String>,
    pub response_body: Option<String>,
    pub enabled: bool,
}
