//! Shared types for GUI ↔ serve IPC (CLI uses the same wire format).

pub mod protocol;

pub use protocol::{ServeErrorResponse, ServeRequest, ServeResponse, SERVE_TCP_ADDR};
