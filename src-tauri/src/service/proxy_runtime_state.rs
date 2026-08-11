use std::fs;
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyRuntimeState {
    pub port: u16,
    pub reverse_http_port: Option<u16>,
    pub reverse_https_port: Option<u16>,
    pub pid: u32,
    pub updated_at: String,
}

pub struct ProxyRuntimeStateService;

impl ProxyRuntimeStateService {
    fn state_file_path() -> Option<PathBuf> {
        dirs::data_dir().map(|d| d.join("horizon-gateway").join("proxy_runtime.json"))
    }

    pub fn save_state(port: u16, reverse_http_port: Option<u16>, reverse_https_port: Option<u16>) {
        let Some(path) = Self::state_file_path() else { return };
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let state = ProxyRuntimeState {
            port,
            reverse_http_port,
            reverse_https_port,
            pid: std::process::id(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        if let Ok(json) = serde_json::to_string_pretty(&state) {
            let _ = fs::write(path, json);
        }
    }

    pub fn clear_state() {
        if let Some(path) = Self::state_file_path() {
            let _ = fs::remove_file(path);
        }
    }

    pub fn load_active_state() -> Option<ProxyRuntimeState> {
        let path = Self::state_file_path()?;
        if !path.is_file() {
            return None;
        }

        let content = fs::read_to_string(path).ok()?;
        let state: ProxyRuntimeState = serde_json::from_str(&content).ok()?;

        // Verify port is actually listening on 127.0.0.1
        let addr = SocketAddr::from(([127, 0, 0, 1], state.port));
        if TcpStream::connect_timeout(&addr, Duration::from_millis(100)).is_ok() {
            Some(state)
        } else {
            None
        }
    }
}
