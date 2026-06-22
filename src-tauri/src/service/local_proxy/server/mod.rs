#![allow(clippy::module_inception)]

mod server;

pub use server::{run_proxy, run_reverse_proxy_http, run_reverse_proxy_https};
pub(crate) use server::proxy_app;

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
