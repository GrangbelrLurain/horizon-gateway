use std::io::{BufRead, BufReader};
use std::net::TcpStream;
use std::thread;
use std::time::Duration;

use hg_core::{ServeEvent, SERVE_EVENT_ADDR};
use tauri::{AppHandle, Emitter};

use super::ensure;

/// Background thread: subscribe to serve event stream and re-emit to the webview.
pub fn start_event_forwarder(app: AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};

    static STARTED: AtomicBool = AtomicBool::new(false);
    if STARTED.swap(true, Ordering::Relaxed) {
        return;
    }

    thread::spawn(move || {
        loop {
            if !ensure::should_route_to_backend() {
                thread::sleep(Duration::from_secs(2));
                continue;
            }

            match forward_events(&app) {
                Ok(()) => tracing::info!("[gui] serve event stream disconnected"),
                Err(e) => tracing::debug!("[gui] serve event stream: {e}"),
            }

            thread::sleep(Duration::from_secs(2));
        }
    });
}

fn forward_events(app: &AppHandle) -> Result<(), String> {
    let stream = TcpStream::connect(SERVE_EVENT_ADDR)
        .map_err(|e| format!("connect {SERVE_EVENT_ADDR}: {e}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(3600)))
        .ok();

    let reader = BufReader::new(stream);
    for line in reader.lines() {
        let line = line.map_err(|e| format!("read: {e}"))?;
        if line.trim().is_empty() {
            continue;
        }
        let evt: ServeEvent =
            serde_json::from_str(&line).map_err(|e| format!("parse event: {e}"))?;
        let _ = app.emit(&evt.event, evt.payload);
    }
    Ok(())
}
