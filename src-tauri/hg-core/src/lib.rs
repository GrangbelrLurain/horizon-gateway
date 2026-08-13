//! Shared types for GUI ↔ serve IPC (CLI uses the same wire format).

pub mod model;
pub mod protocol;

pub use model::*;
pub use protocol::{
    ServeCommand, ServeEndpoints, ServeErrorResponse, ServeEvent, ServeRequest, ServeResponse,
    PROTOCOL_VERSION, SERVE_EVENT_ADDR, SERVE_TCP_ADDR,
};
