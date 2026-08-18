use std::fs::OpenOptions;

use tracing_subscriber::{filter::LevelFilter, fmt, prelude::*};

/// File-only logging for the headless serve process (`logs/serve.log` under app data).
pub fn init_serve_logging() {
    let log_path = match crate::runtime::paths::resolve_app_data_dir() {
        Ok(dir) => {
            let logs = dir.join("logs");
            if std::fs::create_dir_all(&logs).is_err() {
                let _ = fmt().with_max_level(LevelFilter::INFO).try_init();
                return;
            }
            logs.join("serve.log")
        }
        Err(_) => {
            let _ = fmt().with_max_level(LevelFilter::INFO).try_init();
            return;
        }
    };

    let file = match OpenOptions::new().create(true).append(true).open(&log_path) {
        Ok(f) => f,
        Err(_) => {
            let _ = fmt().with_max_level(LevelFilter::INFO).try_init();
            return;
        }
    };

    let file_layer = fmt::layer()
        .with_writer(file)
        .with_ansi(false)
        .with_filter(LevelFilter::INFO);

    let _ = tracing_subscriber::registry().with(file_layer).try_init();
    tracing::info!("[serve] logging to {}", log_path.display());
}
