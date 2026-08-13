use std::io::{BufRead, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;

use hg_core::{ServeRequest, ServeResponse, SERVE_TCP_ADDR};

use crate::cli;
use crate::runtime::{bootstrap_app_context, AppContext, CliRuntime};

/// Blocking entry for the `horizon-gateway-serve` binary.
pub fn run_serve() -> i32 {
    crate::install_rustls_provider();
    super::logging::init_serve_logging();

    let rt = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            tracing::error!("failed to start async runtime: {e}");
            return 1;
        }
    };

    match serve_loop(rt) {
        Ok(()) => 0,
        Err(e) => {
            tracing::error!("serve exited with error: {e}");
            1
        }
    }
}

fn serve_loop(rt: tokio::runtime::Runtime) -> Result<(), String> {
    let rt = Arc::new(rt);
    let ctx = Arc::new(bootstrap_app_context()?);

    ctx.inspector_service
        .sync_registered_domains(&ctx.domain_service.get_all());
    crate::service::transparent_proxy_service::TransparentProxyService::ensure_runtime_sidecars();

    let route_svc = Arc::clone(&ctx.local_route_service);
    let proxy_settings_snapshot = ctx.proxy_settings_service.get();
    let api_logging_map = ctx.api_logging_service.settings_map_arc();
    let api_log_service = Arc::new(ctx.api_log_service.clone());
    let ca_service = Arc::clone(&ctx.ca_service);
    let mocking_service = Arc::clone(&ctx.mocking_service);
    let inspector_service = ctx.inspector_service.clone();
    let domain_service = Arc::new(ctx.domain_service.clone());

    let event_bus = super::events::ServeEventBus::new();
    super::events::ServeEventBus::init_global(Arc::clone(&event_bus));
    super::events::start_event_listener(event_bus)?;

    let listener = TcpListener::bind(SERVE_TCP_ADDR)
        .map_err(|e| format!("failed to bind serve socket {SERVE_TCP_ADDR}: {e}"))?;

    tracing::info!("[serve] listening on {SERVE_TCP_ADDR}");

    rt.spawn(async move {
        if let Err(e) = crate::command::local_route_commands::auto_start_proxy(
            None,
            route_svc,
            &proxy_settings_snapshot,
            api_logging_map,
            api_log_service,
            ca_service,
            mocking_service,
            inspector_service,
            domain_service,
        )
        .await
        {
            tracing::warn!("[serve] auto-start proxy failed: {e}");
        }
    });

    // Background domain monitor task
    {
        let ctx_clone = Arc::clone(&ctx);
        rt.spawn(async move {
            loop {
                let _ = ctx_clone
                    .monitor_service
                    .check_domains(
                        &ctx_clone.domain_service,
                        &ctx_clone.group_service,
                        &ctx_clone.link_service,
                        &ctx_clone.proxy_settings_service,
                    )
                    .await;
                tracing::info!("[serve] background domain status check completed");
                tokio::time::sleep(std::time::Duration::from_secs(120)).await;
            }
        });
    }

    // Annotation watcher task
    {
        let ctx_clone = Arc::clone(&ctx);
        rt.spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                if ctx_clone.inspector_service.reload_if_stale() {
                    tracing::info!("[serve] annotations file changed on disk; reloaded");
                    super::events::publish_event("annotations-updated", ());
                }
            }
        });
    }

    // Tunnel Axum server task
    {
        let ctx_clone = Arc::clone(&ctx);
        rt.spawn(async move {
            if let Err(e) = ctx_clone.tunnel_service.start_axum_server(None).await {
                tracing::error!("[serve] Axum server failed: {e}");
            }
        });
    }

    for stream in listener.incoming() {
        let stream = stream.map_err(|e| format!("accept failed: {e}"))?;
        let ctx = Arc::clone(&ctx);
        let rt = Arc::clone(&rt);
        std::thread::spawn(move || {
            if let Err(e) = handle_client(stream, &ctx, rt.as_ref()) {
                tracing::warn!("[serve] client session error: {e}");
            }
        });
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
