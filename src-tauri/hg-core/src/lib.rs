//! Shared types for GUI ↔ serve IPC (CLI uses the same wire format).

pub mod protocol;

pub use protocol::{
    ServeErrorResponse, ServeEvent, ServeRequest, ServeResponse, SERVE_EVENT_ADDR, SERVE_TCP_ADDR,
};
