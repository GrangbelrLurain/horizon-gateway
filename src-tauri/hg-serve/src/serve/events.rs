use std::io::Write;
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex, OnceLock};

use hg_core::{ServeEvent, SERVE_EVENT_ADDR};
use serde::Serialize;
use serde_json::Value;

static GLOBAL_BUS: OnceLock<Arc<ServeEventBus>> = OnceLock::new();

pub struct ServeEventBus {
    subscribers: Mutex<Vec<TcpStream>>,
}

impl ServeEventBus {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            subscribers: Mutex::new(Vec::new()),
        })
    }

    pub fn init_global(bus: Arc<Self>) {
        let _ = GLOBAL_BUS.set(Arc::clone(&bus));
    }

    pub fn add_subscriber(&self, stream: TcpStream) {
        let mut subs = self.subscribers.lock().unwrap_or_else(|e| e.into_inner());
        subs.push(stream);
    }

    pub fn publish(&self, event: &str, payload: Value) {
        let msg = match serde_json::to_string(&ServeEvent {
            event: event.to_string(),
            payload,
        }) {
            Ok(s) => format!("{s}\n"),
            Err(_) => return,
        };
        let bytes = msg.as_bytes();
        let mut subs = self.subscribers.lock().unwrap_or_else(|e| e.into_inner());
        subs.retain_mut(|s| s.write_all(bytes).is_ok() && s.flush().is_ok());
    }
}

pub fn publish_event<S: Serialize>(event: &str, payload: S) {
    let Some(bus) = GLOBAL_BUS.get() else {
        return;
    };
    let payload = serde_json::to_value(payload).unwrap_or(Value::Null);
    bus.publish(event, payload);
}

/// Emit to GUI webview: serve event bus.
pub fn emit_to_gui<S: Serialize + Clone>(_app: Option<&()>, event: &str, payload: S) {
    publish_event(event, payload);
}

pub fn start_event_listener(bus: Arc<ServeEventBus>) -> Result<(), String> {
    let listener = TcpListener::bind(SERVE_EVENT_ADDR)
        .map_err(|e| format!("failed to bind event socket {SERVE_EVENT_ADDR}: {e}"))?;
    tracing::info!("[serve] event stream on {SERVE_EVENT_ADDR}");

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    tracing::debug!("[serve] event subscriber connected");
                    bus.add_subscriber(stream);
                }
                Err(e) => tracing::warn!("[serve] event accept error: {e}"),
            }
        }
    });

    Ok(())
}
