#![allow(unsafe_code)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod console_window;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let is_cli = args.len() > 1 && args[1] == "cli";

    if is_cli {
        console_window::attach_for_cli();
    }

    // If it's a standalone command (init, list, help), execute directly and exit to prevent Tauri/WebView2 hangs
    if is_cli {
        if args.len() > 2 && (args[2] == "init" || args[2] == "list" || args[2] == "help") {
            horizon_gateway_lib::execute_cli_standalone(&args[2..]);
            std::process::exit(0);
        }
        if args.len() > 2 && args[2] == "run" {
            let code = horizon_gateway_lib::execute_cli_headless(&args[2..]);
            std::process::exit(code);
        }
    }

    horizon_gateway_lib::run();
}
