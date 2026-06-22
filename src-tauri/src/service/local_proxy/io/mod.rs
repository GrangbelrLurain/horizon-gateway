mod stream;

pub(crate) use stream::{parse_connect_target, read_request_headers, PrependIo};

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
