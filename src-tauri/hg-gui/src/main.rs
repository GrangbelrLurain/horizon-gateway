#![allow(unsafe_code)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod console_window;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).is_some_and(|a| a == "cli") {
        console_window::attach_for_cli();
        std::process::exit(horizon_gateway_lib::execute_cli(&args[2..]));
    }

    horizon_gateway_lib::run();
}
