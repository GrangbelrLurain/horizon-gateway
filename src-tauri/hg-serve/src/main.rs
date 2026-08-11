//! Headless backend entry — no Tauri/WebView. GUI and CLI clients connect via serve IPC.

#![cfg_attr(windows, windows_subsystem = "windows")]

fn main() {
    std::process::exit(horizon_gateway_lib::serve::run_serve());
}
