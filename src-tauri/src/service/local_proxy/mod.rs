//! Local HTTP proxy: Host-based routing to local backends.
//! Paired command: `command/local_route_commands.rs`
//!
//! Unit convention (every depth):
//! ```text
//! {unit}/mod.rs + {role}.rs + tests/{role}.rs
//! ```

#[macro_export]
macro_rules! proxy_log {
    ($($t:tt)*) => {
        tracing::info!("[proxy] {}", format!($($t)*))
    };
}

mod connect;
mod dns;
mod flags;
mod handler;
mod io;
mod reserved;
mod routing;
mod server;
mod state;
mod tls;

#[allow(unused_imports)]
pub use flags::{
    is_inspector_enabled, is_local_routing_enabled, is_mocking_enabled, set_inspector_enabled,
    set_local_routing_enabled, set_mocking_enabled,
};
pub use server::{run_proxy, run_reverse_proxy_http, run_reverse_proxy_https};
#[allow(unused_imports)]
pub use state::ProxyState;

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
