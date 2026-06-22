mod api;
mod capture;
mod cors;
mod forward;
mod inject;
mod mocking;
mod pipeline;
mod websocket;

pub(crate) use cors::proxy_handler;

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
