mod paths;

pub(crate) use paths::{
    serve_watchtower_reserved_path, WATCHTOWER_PATH_PREFIX,
};

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
