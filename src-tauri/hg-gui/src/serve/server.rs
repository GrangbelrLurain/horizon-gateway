use std::io::{BufRead, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;

use hg_core::{ServeRequest, ServeResponse, SERVE_TCP_ADDR};

use crate::cli;
use crate::runtime::{bootstrap_app_context, AppContext, CliRuntime};

/// Blocking entry for the `horizon-gateway-serve` binary.
pub fn run_serve() -> i32 {
    crate::install_rustls_provider();

    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing_subscriber::filter::LevelFilter::INFO)
        .try_init();

    let rt = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            eprintln!("failed to start async runtime: {e}");
            return 1;
        }
    };

    match serve_loop(&rt) {
        Ok(()) => 0,
        Err(e) => {
            eprintln!("serve exited with error: {e}");
            1
        }
    }
}

fn serve_loop(rt: &tokio::runtime::Runtime) -> Result<(), String> {
    let ctx = Arc::new(bootstrap_app_context()?);
    let listener = TcpListener::bind(SERVE_TCP_ADDR)
        .map_err(|e| format!("failed to bind serve socket {SERVE_TCP_ADDR}: {e}"))?;

    tracing::info!("[serve] listening on {SERVE_TCP_ADDR}");

    for stream in listener.incoming() {
        let stream = stream.map_err(|e| format!("accept failed: {e}"))?;
        if let Err(e) = handle_client(stream, &ctx, rt) {
            tracing::warn!("[serve] client session error: {e}");
        }
    }

    Ok(())
}

fn handle_client(
    stream: TcpStream,
    ctx: &Arc<AppContext>,
    rt: &tokio::runtime::Runtime,
) -> Result<(), String> {
    let mut reader = std::io::BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
    let mut writer = stream;

    let mut line = String::new();
    loop {
        line.clear();
        let n = reader
            .read_line(&mut line)
            .map_err(|e| format!("read failed: {e}"))?;
        if n == 0 {
            break;
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let request: ServeRequest = serde_json::from_str(trimmed)
            .map_err(|e| format!("invalid serve request JSON: {e}"))?;

        let response = dispatch_serve_request(&request, ctx, rt);
        let mut out =
            serde_json::to_string(&response).map_err(|e| format!("encode response: {e}"))?;
        out.push('\n');
        writer
            .write_all(out.as_bytes())
            .map_err(|e| format!("write failed: {e}"))?;
        writer
            .flush()
            .map_err(|e| format!("flush failed: {e}"))?;
    }

    Ok(())
}

fn dispatch_serve_request(
    request: &ServeRequest,
    ctx: &AppContext,
    rt: &tokio::runtime::Runtime,
) -> ServeResponse {
    if request.command == "ping" {
        return ServeResponse::success(
            request.id.clone(),
            serde_json::json!({ "mode": "serve", "ok": true }),
        );
    }

    let runtime = CliRuntime::Tokio(rt);
    match cli::dispatch_headless::dispatch_headless(
        &request.command,
        request.payload.clone(),
        ctx,
        &runtime,
    ) {
        Ok(data) => ServeResponse::success(request.id.clone(), data),
        Err(err) => ServeResponse::failure(request.id.clone(), err),
    }
}
