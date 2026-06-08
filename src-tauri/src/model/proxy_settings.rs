use serde::{Deserialize, Serialize};

fn default_proxy_port() -> u16 {
    8888
}

fn default_local_routing_enabled() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct ProxySettings {
    /// Optional DNS server for pass-through resolution (e.g. "8.8.8.8" or "1.1.1.1:53").
    /// When set, hosts not matching any local route are resolved via this server before forwarding.
    pub dns_server: Option<String>,
    /// Port the local reverse proxy listens on (e.g. 8888). User-configurable to avoid conflicts.
    #[serde(default = "default_proxy_port")]
    pub proxy_port: u16,
    /// Optional reverse HTTP port (e.g. 8080). When set, proxy listens here for direct HTTP.
    /// No system proxy or hosts file: open <http://127.0.0.1:8080> and traffic is routed by Host (127.0.0.1 → first local route).
    #[serde(default)]
    pub reverse_http_port: Option<u16>,
    /// Optional reverse HTTPS port (e.g. 8443). When set, proxy does TLS and forwards by Host.
    #[serde(default)]
    pub reverse_https_port: Option<u16>,
    /// When true, matching local routes are applied; when false, all traffic passes through.
    #[serde(default = "default_local_routing_enabled")]
    pub local_routing_enabled: bool,
}

impl Default for ProxySettings {
    fn default() -> Self {
        Self {
            dns_server: None,
            proxy_port: default_proxy_port(),
            reverse_http_port: None,
            reverse_https_port: None,
            local_routing_enabled: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Existing JSON from v1 (before local_routing_enabled was added) should
    /// deserialize successfully with the default value (true).
    #[test]
    fn test_backward_compat_missing_local_routing_enabled() {
        let old_json = r#"{
            "dns_server": null,
            "proxy_port": 9999,
            "reverse_http_port": 8080,
            "reverse_https_port": null
        }"#;
        let settings: ProxySettings = serde_json::from_str(old_json).unwrap();
        assert_eq!(settings.proxy_port, 9999);
        assert_eq!(settings.reverse_http_port, Some(8080));
        assert!(settings.local_routing_enabled, "missing field should default to true");
    }

    /// JSON with local_routing_enabled = false should deserialize correctly.
    #[test]
    fn test_deserialize_with_local_routing_disabled() {
        let json = r#"{
            "dns_server": "8.8.8.8",
            "proxy_port": 8888,
            "local_routing_enabled": false
        }"#;
        let settings: ProxySettings = serde_json::from_str(json).unwrap();
        assert!(!settings.local_routing_enabled);
        assert_eq!(settings.dns_server, Some("8.8.8.8".to_string()));
    }

    /// Serialization round-trip preserves local_routing_enabled.
    #[test]
    fn test_roundtrip_serialization() {
        let settings = ProxySettings {
            dns_server: None,
            proxy_port: 8888,
            reverse_http_port: None,
            reverse_https_port: None,
            local_routing_enabled: false,
        };
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: ProxySettings = serde_json::from_str(&json).unwrap();
        assert!(!deserialized.local_routing_enabled);
        assert_eq!(deserialized.proxy_port, 8888);
    }

    /// Default should have local_routing_enabled = true.
    #[test]
    fn test_default_settings() {
        let settings = ProxySettings::default();
        assert!(settings.local_routing_enabled);
        assert_eq!(settings.proxy_port, 8888);
    }
}
