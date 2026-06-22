mod cors;
mod inject;
mod pipeline;

pub(crate) use cors::proxy_handler;

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
