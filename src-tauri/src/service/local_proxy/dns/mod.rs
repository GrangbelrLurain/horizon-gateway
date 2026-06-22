mod resolver;

pub(crate) use resolver::{
    build_resolver, connect_for_connect, TokioResolver,
};

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
