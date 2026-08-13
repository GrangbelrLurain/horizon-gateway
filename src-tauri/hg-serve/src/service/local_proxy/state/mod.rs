#![allow(clippy::module_inception)]

mod state;

pub use state::ProxyState;

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
