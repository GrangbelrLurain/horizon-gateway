mod cert;

pub(crate) use cert::{serve_cert_pem, DynamicCertResolver, HostCertCache};

#[cfg(test)]
#[path = "tests/mod.rs"]
mod tests;
