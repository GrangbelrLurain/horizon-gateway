//! Headless backend process: owns app services and accepts GUI/CLI IPC.

mod server;

pub use server::run_serve;
