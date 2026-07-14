mod paths;

pub(crate) use paths::{
    serve_horizon_gateway_reserved_path, HORIZON_GATEWAY_PATH_PREFIX,
};

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
