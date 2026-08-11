use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tracing_core::Subscriber;
use tracing_subscriber::layer::{Context, Layer};

#[derive(Serialize, Clone)]
pub struct LogPayload {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
}

pub struct TauriEmitterLayer {
    pub app_handle: AppHandle,
}

impl<S: Subscriber> Layer<S> for TauriEmitterLayer {
    fn on_event(&self, event: &tracing_core::Event<'_>, _ctx: Context<'_, S>) {
        let mut visitor = StringVisitor::new();
        event.record(&mut visitor);

        let metadata = event.metadata();
        let payload = LogPayload {
            timestamp: chrono::Local::now().to_rfc3339(),
            level: metadata.level().to_string(),
            target: metadata.target().to_string(),
            message: visitor.message,
        };

        let _ = self.app_handle.emit("server-log", payload);
    }
}

struct StringVisitor {
    message: String,
}

impl StringVisitor {
    fn new() -> Self {
        Self {
            message: String::new(),
        }
    }
}

impl tracing_core::field::Visit for StringVisitor {
    fn record_debug(&mut self, field: &tracing_core::Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            let s = format!("{value:?}");
            self.message = s.trim_start_matches('"').trim_end_matches('"').to_string();
        }
    }
}
