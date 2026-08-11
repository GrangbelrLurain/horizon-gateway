#[cfg(target_os = "macos")]
use std::process::Command;

pub struct SystemProxyService;

impl SystemProxyService {
    /// Sets the system's PAC (Proxy Auto-Config) URL.
    pub fn set_pac_url(url: &str) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
            use winreg::RegKey;

            let hkcu = RegKey::predef(HKEY_CURRENT_USER);
            let path = "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
            let key = hkcu
                .open_subkey_with_flags(path, KEY_SET_VALUE)
                .map_err(|e| format!("Failed to open registry key: {e}"))?;

            // 1. Set AutoConfigURL (PAC)
            key.set_value("AutoConfigURL", &url)
                .map_err(|e| format!("Failed to set AutoConfigURL: {e}"))?;

            // 2. Disable Manual Proxy to avoid conflicts
            // ProxyEnable = 0
            if let Err(e) = key.set_value("ProxyEnable", &0u32) {
                eprintln!("Warning: Failed to disable ProxyEnable: {e}");
            }
            // Clear ProxyServer and ProxyOverride to be safe
            let _ = key.delete_value("ProxyServer");
            let _ = key.delete_value("ProxyOverride");

            // TODO: Notify system of settings change (requires winapi/windows-sys crates for InternetSetOption)
            // For now, most browsers pick up registry changes by polling.
            Ok(())
        }
        #[cfg(target_os = "macos")]
        {
            // On macOS, assuming Wi-Fi is the primary interface for now.
            // Ideally we should detect the active service.
            let output = Command::new("networksetup")
                .args(["-setautoproxyurl", "Wi-Fi", url])
                .output()
                .map_err(|e| e.to_string())?;

            if !output.status.success() {
                // Try Ethernet if Wi-Fi fails
                let _ = Command::new("networksetup")
                    .args(["-setautoproxyurl", "Ethernet", url])
                    .output();
            }
            Ok(())
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            Ok(())
        }
    }

    /// Clears the system's PAC URL setting.
    pub fn clear_pac_url() -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
            use winreg::RegKey;

            let hkcu = RegKey::predef(HKEY_CURRENT_USER);
            let path = "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
            let key = hkcu
                .open_subkey_with_flags(path, KEY_SET_VALUE)
                .map_err(|e| format!("Failed to open registry key: {e}"))?;

            // Remove AutoConfigURL to disable PAC
            let _ = key.delete_value("AutoConfigURL");

            // Ensure ProxyEnable is 0
            if let Err(e) = key.set_value("ProxyEnable", &0u32) {
                eprintln!("Warning: Failed to disable ProxyEnable on clear: {e}");
            }

            Ok(())
        }
        #[cfg(target_os = "macos")]
        {
            let output = Command::new("networksetup")
                .args(["-setautoproxyoff", "Wi-Fi"])
                .output()
                .map_err(|e| e.to_string())?;

            let _ = Command::new("networksetup")
                .args(["-setautoproxyoff", "Ethernet"])
                .output();

            if !output.status.success() {
                return Err(String::from_utf8_lossy(&output.stderr).to_string());
            }
            Ok(())
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            Ok(())
        }
    }
}
