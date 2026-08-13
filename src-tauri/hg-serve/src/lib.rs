pub use hg_core::model;
pub mod cli;
pub mod command;
pub mod logging;
pub mod runtime;
pub mod serve;
pub mod service;
pub mod storage;

pub fn install_rustls_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}
