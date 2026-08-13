//! Console CLI for Horizon Gateway. Separate from `horizon-gateway-serve` so
//! Windows admin manifests on the backend never apply here (`asInvoker`).

fn main() {
    horizon_gateway_serve_lib::install_rustls_provider();
    let args: Vec<String> = std::env::args().skip(1).collect();
    std::process::exit(horizon_gateway_serve_lib::cli::execute_cli_entry(&args));
}
