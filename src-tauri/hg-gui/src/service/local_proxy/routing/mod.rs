mod host;
mod resolver;

pub use host::route_domain_to_host;
pub(crate) use host::{
    get_logging_config_for_host, host_key_for_logging_map,
};
pub(crate) use resolver::{resolve_connect_target, resolve_target};

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
