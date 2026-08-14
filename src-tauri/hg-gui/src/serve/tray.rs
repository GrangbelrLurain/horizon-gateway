fn clear_system_pac() {
    #[cfg(windows)]
    {
        use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
        use winreg::RegKey;
        if let Ok(hkcu) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(
            "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
            KEY_SET_VALUE,
        ) {
            let _ = hkcu.delete_value("AutoConfigURL");
            let _ = hkcu.set_value("ProxyEnable", &0u32);
        }
    }
}

pub fn kill_serve_process() {
    let _ = super::client::call_command("stop_local_proxy", serde_json::Value::Null);
    clear_system_pac();

    #[cfg(windows)]
    {
        use std::process::Command;
        let _ = Command::new("taskkill")
            .args(["/IM", "horizon-gateway-serve.exe", "/F"])
            .output();
    }
    #[cfg(not(windows))]
    {
        use std::process::Command;
        let _ = Command::new("pkill")
            .args(["-f", "horizon-gateway-serve"])
            .output();
    }
}
