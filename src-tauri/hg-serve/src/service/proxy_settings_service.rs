use crate::model::proxy_settings::ProxySettings;
use crate::storage::versioned::{load_versioned, save_versioned};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct ProxySettingsService {
    settings: Mutex<ProxySettings>,
    storage_path: PathBuf,
}

impl ProxySettingsService {
    pub fn new(storage_path: PathBuf) -> Self {
        let settings = load_versioned(&storage_path);
        Self {
            settings: Mutex::new(settings),
            storage_path,
        }
    }

    fn save(&self, s: &ProxySettings) {
        save_versioned(&self.storage_path, s);
    }

    pub fn get(&self) -> ProxySettings {
        self.settings.lock().unwrap().clone()
    }

    pub fn set_dns_server(&self, dns_server: Option<String>) -> ProxySettings {
        let mut s = self.settings.lock().unwrap();
        s.dns_server = dns_server.map(|s| s.trim().to_string()).and_then(|s| {
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        });
        let out = s.clone();
        self.save(&out);
        out
    }

    /// Set the port the proxy will listen on (1–65535). Takes effect on next proxy start.
    pub fn set_proxy_port(&self, port: u16) -> ProxySettings {
        let port = port.clamp(1, 65535);
        let mut s = self.settings.lock().unwrap();
        s.proxy_port = port;
        let out = s.clone();
        self.save(&out);
        out
    }

    /// Set reverse proxy ports. None = disabled. Takes effect on next proxy start.
    pub fn set_reverse_ports(
        &self,
        reverse_http_port: Option<u16>,
        reverse_https_port: Option<u16>,
    ) -> ProxySettings {
        let mut s = self.settings.lock().unwrap();
        s.reverse_http_port = reverse_http_port.filter(|&p| p > 0);
        s.reverse_https_port = reverse_https_port.filter(|&p| p > 0);
        let out = s.clone();
        self.save(&out);
        out
    }

    /// Toggle local routing on/off (persisted).
    pub fn set_local_routing_enabled(&self, enabled: bool) -> ProxySettings {
        let mut s = self.settings.lock().unwrap();
        s.local_routing_enabled = enabled;
        let out = s.clone();
        self.save(&out);
        out
    }

    /// Replace all settings (for import).
    pub fn replace_all(&self, settings: ProxySettings) -> ProxySettings {
        let mut s = self.settings.lock().unwrap();
        *s = settings;
        self.save(&s);
        s.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// Create a temp directory and return a path for the settings file.
    fn temp_settings_path() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("proxy_settings.json");
        (dir, path)
    }

    #[test]
    fn test_new_creates_default_when_no_file() {
        let (_dir, path) = temp_settings_path();
        let svc = ProxySettingsService::new(path);
        let s = svc.get();
        assert!(s.local_routing_enabled);
        assert_eq!(s.proxy_port, 8888);
    }

    #[test]
    fn test_set_local_routing_enabled_persists() {
        let (_dir, path) = temp_settings_path();
        let svc = ProxySettingsService::new(path.clone());

        // Default is true
        assert!(svc.get().local_routing_enabled);

        // Toggle off
        let updated = svc.set_local_routing_enabled(false);
        assert!(!updated.local_routing_enabled);

        // Re-load from disk
        let svc2 = ProxySettingsService::new(path);
        assert!(!svc2.get().local_routing_enabled, "disabled state should persist to disk");
    }

    #[test]
    fn test_set_local_routing_enabled_toggle_cycle() {
        let (_dir, path) = temp_settings_path();
        let svc = ProxySettingsService::new(path);

        svc.set_local_routing_enabled(false);
        assert!(!svc.get().local_routing_enabled);

        svc.set_local_routing_enabled(true);
        assert!(svc.get().local_routing_enabled);
    }

    #[test]
    fn test_backward_compat_old_settings_file() {
        let (_dir, path) = temp_settings_path();
        // Write an old-format JSON (no local_routing_enabled, wrapped in versioned envelope)
        let old_json = r#"{"schema_version":1,"data":{"dns_server":null,"proxy_port":9999}}"#;
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(old_json.as_bytes()).unwrap();
        drop(f);

        let svc = ProxySettingsService::new(path);
        let s = svc.get();
        assert_eq!(s.proxy_port, 9999);
        assert!(s.local_routing_enabled, "missing field should default to true");
    }
}
