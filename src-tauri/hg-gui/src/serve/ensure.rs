use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use super::client;
use super::spawn;

static SERVE_ENSURED: AtomicBool = AtomicBool::new(false);

/// Returns true once we've confirmed serve is running this session.
pub fn is_backend_active() -> bool {
    SERVE_ENSURED.load(Ordering::Relaxed)
}

pub fn mark_inactive() {
    SERVE_ENSURED.store(false, Ordering::Relaxed);
}

/// Ensure the serve backend is reachable, spawning and waiting if needed.
/// Called once at GUI startup. On success, events_client will keep connectivity.
pub fn ensure_running() -> Result<(), String> {
    if client::ping().is_ok() {
        SERVE_ENSURED.store(true, Ordering::Relaxed);
        return Ok(());
    }

    SERVE_ENSURED.store(false, Ordering::Relaxed);
    spawn::spawn_detached()?;

    // Wait up to 5 seconds (25 x 100~200 ms)
    for attempt in 0..25 {
        thread::sleep(Duration::from_millis(if attempt < 5 { 100 } else { 200 }));
        if client::ping().is_ok() {
            SERVE_ENSURED.store(true, Ordering::Relaxed);
            tracing::info!("[gui] serve backend ready after spawn");
            return Ok(());
        }
    }

    SERVE_ENSURED.store(false, Ordering::Relaxed);
    Err("horizon-gateway-serve did not become ready in time".to_string())
}
