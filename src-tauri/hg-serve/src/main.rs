//! Headless backend entry — no Tauri/WebView. GUI and CLI clients connect via serve IPC.

#![cfg_attr(windows, windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && (args[1] == "cli" || args[1] == "init" || args[1] == "list" || args[1] == "help" || args[1] == "run") {
        let cli_args: &[String] = if args[1] == "cli" { &args[2..] } else { &args[1..] };
        std::process::exit(horizon_gateway_serve_lib::cli::execute_cli_entry(cli_args));
    }

    std::process::exit(horizon_gateway_serve_lib::serve::run_serve());
}
