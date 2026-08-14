mod paths;

pub(crate) use paths::{
    is_horizon_gateway_internal, normalize_horizon_gateway_path,
    serve_horizon_gateway_reserved_path,
};

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
