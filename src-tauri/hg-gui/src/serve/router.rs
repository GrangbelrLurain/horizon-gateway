use tauri::ipc::{Invoke, InvokeBody, InvokeError, InvokeResponseBody};
use tauri::Wry;

use super::client::{call_command, invoke_args_to_payload};
use super::{ensure, forward};

/// Wrap the specta invoke handler and forward backend commands to serve when available.
pub fn wrap_invoke_handler(
    specta_handler: impl Fn(Invoke<Wry>) -> bool + Send + Sync + 'static,
) -> impl Fn(Invoke<Wry>) -> bool + Send + Sync + 'static {
    move |invoke| {
        let cmd = invoke.message.command();
        if forward::should_forward(cmd) && ensure::should_route_to_backend() {
            let args = match invoke.message.payload() {
                InvokeBody::Json(value) => value.clone(),
                InvokeBody::Raw(_) => serde_json::json!({}),
            };
            let payload = invoke_args_to_payload(args);
            let command = cmd.to_string();
            invoke.resolver.respond_async_serialized(async move {
                match call_command(&command, payload) {
                    Ok(value) => {
                        let json = serde_json::to_string(&value)
                            .map_err(|e| InvokeError::from(e.to_string()))?;
                        Ok(InvokeResponseBody::Json(json))
                    }
                    Err(err) => {
                        ensure::mark_inactive();
                        Err(InvokeError::from(err))
                    }
                }
            });
            return true;
        }

        specta_handler(invoke)
    }
}
