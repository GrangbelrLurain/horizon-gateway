use std::path::PathBuf;
use std::sync::Mutex;
use std::process::{Command, Stdio};

#[derive(serde::Serialize, specta::Type, Clone)]
pub struct AdbStatus {
    pub found: bool,
    pub path: Option<String>,
    pub devices: Vec<String>,
}

pub struct UsbService {
    adb_path: Mutex<Option<PathBuf>>,
}

impl UsbService {
    pub fn new() -> Self {
        let path = find_adb_binary();
        Self {
            adb_path: Mutex::new(path),
        }
    }

    pub fn get_adb_path(&self) -> Option<PathBuf> {
        self.adb_path.lock().unwrap().clone()
    }

    pub fn refresh_adb_path(&self) -> Option<PathBuf> {
        let path = find_adb_binary();
        self.adb_path.lock().unwrap().clone_from(&path);
        path
    }

    pub fn check_status(&self) -> AdbStatus {
        // Refresh the path on check just to be safe (e.g. if SDK was installed recently)
        let path_opt = self.refresh_adb_path();
        
        let Some(path) = path_opt else {
            return AdbStatus {
                found: false,
                path: None,
                devices: vec![],
            };
        };

        ensure_adb_server(&path);

        let devices = match list_devices(&path) {
            Ok(devs) => devs,
            Err(e) => {
                tracing::error!("Failed to list ADB devices: {}", e);
                vec![]
            }
        };

        AdbStatus {
            found: true,
            path: Some(path.to_string_lossy().to_string()),
            devices,
        }
    }

    pub fn start_reverse(&self, port: u16) -> Result<(), String> {
        let Some(path) = self.get_adb_path() else {
            return Err("ADB binary not found".to_string());
        };

        ensure_adb_server(&path);

        let devices = list_devices(&path)?;
        if devices.is_empty() {
            return Err("No connected Android devices found".to_string());
        }

        let port_str = format!("tcp:{port}");
        let proxy_target = format!("127.0.0.1:{port}");

        for serial in &devices {
            // 1. reverse port mapping: adb -s <serial> reverse tcp:PORT tcp:PORT
            let output = Command::new(&path)
                .args(["-s", serial, "reverse", &port_str, &port_str])
                .output()
                .map_err(|e| format!("Failed to execute adb reverse for {serial}: {e}"))?;

            if !output.status.success() {
                let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
                return Err(format!("adb reverse failed for {}: {}", serial, err_msg.trim()));
            }

            // 2. inject global proxy: adb -s <serial> shell settings put global http_proxy 127.0.0.1:PORT
            let output_proxy = Command::new(&path)
                .args(["-s", serial, "shell", "settings", "put", "global", "http_proxy", &proxy_target])
                .output()
                .map_err(|e| format!("Failed to set proxy for {serial}: {e}"))?;

            if !output_proxy.status.success() {
                let err_msg = String::from_utf8_lossy(&output_proxy.stderr).to_string();
                return Err(format!("Failed to set global http_proxy via adb for {}: {}", serial, err_msg.trim()));
            }
        }

        Ok(())
    }

    pub fn stop_reverse(&self, port: u16) -> Result<(), String> {
        let Some(path) = self.get_adb_path() else {
            return Err("ADB binary not found".to_string());
        };

        ensure_adb_server(&path);

        let devices = list_devices(&path).unwrap_or_default();
        let port_str = format!("tcp:{port}");

        for serial in &devices {
            // 1. remove reverse port mapping: adb -s <serial> reverse --remove tcp:PORT
            let output = Command::new(&path)
                .args(["-s", serial, "reverse", "--remove", &port_str])
                .output()
                .map_err(|e| format!("Failed to execute adb reverse remove for {serial}: {e}"))?;

            if !output.status.success() {
                let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
                tracing::warn!("adb reverse remove failed for {} (might be already removed): {}", serial, err_msg.trim());
            }

            // 2. clear global proxy: adb -s <serial> shell settings put global http_proxy :0
            let _ = Command::new(&path)
                .args(["-s", serial, "shell", "settings", "put", "global", "http_proxy", ":0"])
                .status();

            // 3. delete proxy keys completely
            let _ = Command::new(&path)
                .args(["-s", serial, "shell", "settings", "delete", "global", "http_proxy"])
                .status();
            let _ = Command::new(&path)
                .args(["-s", serial, "shell", "settings", "delete", "global", "global_http_proxy_host"])
                .status();
            let _ = Command::new(&path)
                .args(["-s", serial, "shell", "settings", "delete", "global", "global_http_proxy_port"])
                .status();
        }

        Ok(())
    }
}

fn ensure_adb_server(adb_path: &PathBuf) {
    // Run "adb start-server" with null stdout/stderr to prevent blocking due to background daemon spawning
    let _ = Command::new(adb_path)
        .arg("start-server")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

fn is_command_available(cmd: &str) -> bool {
    Command::new(cmd)
        .arg("version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn find_adb_binary() -> Option<PathBuf> {
    // 1. Check if 'adb' is globally available in PATH
    if is_command_available("adb") {
        return Some(PathBuf::from("adb"));
    }

    // 2. Check common platform-tools locations
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            let path = PathBuf::from(local_appdata)
                .join("Android")
                .join("Sdk")
                .join("platform-tools")
                .join("adb.exe");
            if path.exists() {
                return Some(path);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let path = PathBuf::from(home)
                .join("Library")
                .join("Android")
                .join("sdk")
                .join("platform-tools")
                .join("adb");
            if path.exists() {
                return Some(path);
            }
        }
        
        // Check Homebrew paths on macOS
        let opt_homebrew = PathBuf::from("/opt/homebrew/bin/adb");
        if opt_homebrew.exists() {
            return Some(opt_homebrew);
        }
        
        let usr_local = PathBuf::from("/usr/local/bin/adb");
        if usr_local.exists() {
            return Some(usr_local);
        }
    }

    None
}

fn list_devices(adb_path: &PathBuf) -> Result<Vec<String>, String> {
    let output = Command::new(adb_path)
        .arg("devices")
        .output()
        .map_err(|e| format!("Failed to run adb devices: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();
    
    // Parse lines. Format:
    // List of devices attached
    // <device_serial>	device
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("List of devices") {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 && parts[1] == "device" {
            devices.push(parts[0].to_string());
        }
    }
    
    Ok(devices)
}
