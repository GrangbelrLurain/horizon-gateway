#![allow(clippy::module_inception)]

mod flags;

pub use flags::{
    is_inspector_enabled, is_local_routing_enabled, is_mocking_enabled, set_inspector_enabled,
    set_local_routing_enabled, set_mocking_enabled,
};

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
