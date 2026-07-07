// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(unsafe_code)]

#[cfg(windows)]
extern "system" {
    fn AttachConsole(dw_process_id: u32) -> i32;
}

fn main() {
    #[cfg(windows)]
    {
        let args: Vec<String> = std::env::args().collect();
        if args.len() > 1 && args[1] == "cli" {
            unsafe {
                AttachConsole(0xffff_ffff); // ATTACH_PARENT_PROCESS
            }
        }
    }

    watchtower_lib::run();
}
