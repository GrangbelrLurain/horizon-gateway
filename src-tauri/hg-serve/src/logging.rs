use tracing_subscriber::{fmt, EnvFilter};

pub fn init_logging() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,horizon_gateway_serve=debug"));
    let _ = fmt::Subscriber::builder()
        .with_env_filter(filter)
        .try_init();
}
