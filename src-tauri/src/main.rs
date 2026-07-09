// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(unsafe_code)]

mod console_attach;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.len() > 1 && args[1] == "cli" {
        console_attach::attach_for_cli();
    }

    // If it's a standalone command (init, list, help), execute directly and exit to prevent Tauri/WebView2 hangs
    if args.len() > 1 && args[1] == "cli" {
        if args.len() > 2 && (args[2] == "init" || args[2] == "list" || args[2] == "help") {
            watchtower_lib::execute_cli_standalone(&args[2..]);
            std::process::exit(0);
        }
        if args.len() > 2 && args[2] == "run" {
            let code = watchtower_lib::execute_cli_headless(&args[2..]);
            std::process::exit(code);
        }
    }

    watchtower_lib::run();
}
