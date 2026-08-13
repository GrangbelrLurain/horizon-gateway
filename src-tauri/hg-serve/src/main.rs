//! Headless backend entry — no Tauri/WebView. GUI and CLI clients connect via serve IPC.

#![cfg_attr(windows, windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).is_some_and(|a| {
        matches!(
            a.as_str(),
            "cli" | "init" | "list" | "help" | "run" | "-h" | "--help"
        )
    }) {
        eprintln!("CLI moved to `hgc`. Example: hgc init");
        std::process::exit(2);
    }

    std::process::exit(horizon_gateway_serve_lib::serve::run_serve());
}
