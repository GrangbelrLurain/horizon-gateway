//! Headless backend entry — no Tauri/WebView. GUI and CLI clients connect via serve IPC.

fn main() {
    std::process::exit(horizon_gateway_lib::serve::run_serve());
}
