use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use super::client;
use super::spawn;

static SERVE_ENSURED: AtomicBool = AtomicBool::new(false);

/// Returns true once we've confirmed (or started) a running serve process this session.
pub fn is_backend_active() -> bool {
    SERVE_ENSURED.load(Ordering::Relaxed)
}

/// Hot-path check for invoke routing — no blocking spawn, no full IPC ping.
pub fn should_route_to_backend() -> bool {
    if !SERVE_ENSURED.load(Ordering::Relaxed) {
        return false;
    }
    if client::is_port_open(client::quick_probe_timeout()) {
        return true;
    }
    SERVE_ENSURED.store(false, Ordering::Relaxed);
    false
}

pub fn mark_inactive() {
    SERVE_ENSURED.store(false, Ordering::Relaxed);
}

/// Ensure the serve backend is reachable, spawning it if needed.
pub fn ensure_running() -> Result<(), String> {
    if client::ping().is_ok() {
        SERVE_ENSURED.store(true, Ordering::Relaxed);
        return Ok(());
    }

    SERVE_ENSURED.store(false, Ordering::Relaxed);
    spawn::spawn_detached()?;

    for attempt in 0..25 {
        thread::sleep(Duration::from_millis(if attempt < 5 { 100 } else { 200 }));
        if client::ping().is_ok() {
            SERVE_ENSURED.store(true, Ordering::Relaxed);
            tracing::info!("[serve] backend ready after spawn");
            return Ok(());
        }
    }

    SERVE_ENSURED.store(false, Ordering::Relaxed);
    Err("horizon-gateway-serve did not become ready in time".to_string())
}
