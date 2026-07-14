mod storage {
    pub mod migration;
    pub mod versioned;
}
mod model {
    pub mod api_log;
    pub mod api_response;
    pub mod domain;
    pub mod domain_api_logging_link;
    pub mod domain_group;
    pub mod domain_group_link;
    pub mod domain_monitor_link;
    pub mod domain_status_log;
    pub mod inspector;
    pub mod local_route;
    pub mod mock_rule;
    pub mod mocking_settings;
    pub mod proxy_settings;
    pub mod scenario;
    pub mod settings_export;
    pub mod saved_pipeline;
    pub mod saved_json_schema;
    pub mod saved_crypto_preset;
}
mod service {
    pub mod api_log_service;
    pub mod api_logging_settings_service;
    pub mod ca_service;
    pub mod domain_group_link_service;
    pub mod domain_group_service;
    pub mod domain_hostname;
    pub mod domain_monitor_service;
    pub mod domain_service;
    pub mod inspector_service;
    pub mod local_proxy;
    pub mod local_route_service;
    pub mod mocking_service;
    pub mod proxy_settings_service;
    pub mod system_proxy_service;
    pub mod tunnel_service;
    pub mod usb_service;
    pub mod crypto_service;
    pub mod pipeline_runner;
    pub mod pipeline_library_service;
    pub mod json_schema_registry_service;
    pub mod crypto_preset_service;
}

use crate::service::api_log_service::ApiLogService;
use crate::service::api_logging_settings_service::ApiLoggingSettingsService;
use crate::service::ca_service::CaService;
use crate::service::domain_group_link_service::DomainGroupLinkService;
use crate::service::domain_group_service::DomainGroupService;
use crate::service::domain_monitor_service::DomainMonitorService;
use crate::service::domain_service::DomainService;
use crate::service::inspector_service::InspectorService;
use crate::service::local_route_service::LocalRouteService;
use crate::service::proxy_settings_service::ProxySettingsService;
use std::sync::Arc;

mod logging;
mod cli;
mod runtime;
mod command {
    pub mod api_log_commands;
    pub mod domain_commands;
    pub mod domain_group_commands;
    pub mod domain_monitor_command;
    pub mod inspector_commands;
    pub mod local_route_commands;
    pub mod mocking_commands;
    pub mod settings_commands;
    pub mod window_commands;
    pub mod tunnel_commands;
    pub mod usb_commands;
    pub mod crypto_commands;
    pub mod pipeline_commands;
    pub mod pipeline_library_commands;
    pub mod json_schema_registry_commands;
    pub mod crypto_preset_commands;
}

use command::inspector_commands::{
    add_annotation, delete_annotation, get_annotations, get_global_inspector_enabled,
    get_injection_domains, import_annotations, set_global_inspector_enabled, set_injection_domains,
    update_annotation,
};

use command::mocking_commands::{
    create_mock_rule, create_mock_rule_from_log, create_scenario, delete_mock_rule,
    delete_scenario, get_mock_rules, get_mock_rules_by_scenario, get_mocking_status, get_scenarios,
    set_mocking_enabled, set_scenario_enabled, update_mock_rule, update_scenario,
};

use command::api_log_commands::{
    clear_api_logs, download_api_schema, get_api_logs, get_api_schema_content,
    get_domain_api_logging_links, list_api_log_dates, remove_domain_api_logging, send_api_request,
    set_domain_api_logging,
};
use command::domain_commands::{
    clear_all_domains, get_domain_by_id, get_domains, import_domains, regist_domains,
    remove_domains, update_domain_by_id,
};
use command::domain_group_commands::{
    create_group, delete_group, get_domain_group_links, get_domains_by_group, get_groups,
    get_groups_for_domain, set_domain_groups, set_group_domains, update_group,
};
use command::domain_monitor_command::{
    check_domain_status, get_domain_monitor_list, get_domain_status_logs, get_latest_status,
    set_domain_monitor_check_enabled,
};
use command::local_route_commands::{
    add_local_route, get_local_routes, get_proxy_auto_start_error, get_proxy_settings,
    get_proxy_setup_url, get_proxy_status, remove_local_route, set_local_route_enabled,
    set_local_routing_enabled, set_proxy_dns_server, set_proxy_port, set_proxy_reverse_ports,
    start_local_proxy, stop_local_proxy, update_local_route,
};
use command::settings_commands::{export_all_settings, import_all_settings, save_root_ca};
use command::window_commands::{open_annotation_dialog, open_inspector_window, open_window, open_external_url};
use command::tunnel_commands::{get_tailscale_ip, start_cloudflare_tunnel, stop_cloudflare_tunnel};
use command::usb_commands::{check_adb_status, start_usb_reverse, stop_usb_reverse};
use command::crypto_commands::{process_crypto, validate_json_schema};
use command::pipeline_commands::{execute_pipeline, execute_pipeline_api_node};
use command::pipeline_library_commands::{
    create_saved_pipeline, delete_saved_pipeline, get_saved_pipeline, get_saved_pipelines,
    import_saved_pipelines, update_saved_pipeline,
};
use command::json_schema_registry_commands::{
    create_json_schema, delete_json_schema, get_json_schema, get_json_schemas, import_json_schemas,
    update_json_schema,
};
use command::crypto_preset_commands::{
    create_crypto_preset, delete_crypto_preset, get_crypto_preset, get_crypto_presets,
    import_crypto_presets, update_crypto_preset,
};
use crate::service::tunnel_service::TunnelService;
use crate::service::usb_service::UsbService;

pub fn get_specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            regist_domains,
            get_domains,
            remove_domains,
            get_domain_by_id,
            update_domain_by_id,
            import_domains,
            clear_all_domains,
            get_latest_status,
            check_domain_status,
            get_domain_status_logs,
            get_domain_group_links,
            set_domain_groups,
            set_group_domains,
            get_domains_by_group,
            get_groups_for_domain,
            create_group,
            get_groups,
            delete_group,
            update_group,
            get_local_routes,
            add_local_route,
            update_local_route,
            remove_local_route,
            set_local_route_enabled,
            get_proxy_status,
            start_local_proxy,
            stop_local_proxy,
            get_proxy_settings,
            set_proxy_dns_server,
            set_proxy_port,
            set_proxy_reverse_ports,
            get_proxy_setup_url,
            export_all_settings,
            import_all_settings,
            save_root_ca,
            get_domain_monitor_list,
            set_domain_monitor_check_enabled,
            get_domain_api_logging_links,
            set_domain_api_logging,
            remove_domain_api_logging,
            download_api_schema,
            get_api_schema_content,
            send_api_request,
            set_local_routing_enabled,
            get_proxy_auto_start_error,
            list_api_log_dates,
            get_api_logs,
            clear_api_logs,
            open_window,
            open_external_url,
            open_inspector_window,
            open_annotation_dialog,
            get_annotations,
            add_annotation,
            update_annotation,
            delete_annotation,
            import_annotations,
            set_global_inspector_enabled,
            get_global_inspector_enabled,
            get_injection_domains,
            set_injection_domains,
            get_scenarios,
            create_scenario,
            update_scenario,
            delete_scenario,
            get_mock_rules,
            get_mock_rules_by_scenario,
            create_mock_rule,
            update_mock_rule,
            delete_mock_rule,
            create_mock_rule_from_log,
            get_mocking_status,
            set_mocking_enabled,
            set_scenario_enabled,
            get_tailscale_ip,
            start_cloudflare_tunnel,
            stop_cloudflare_tunnel,
            check_adb_status,
            start_usb_reverse,
            stop_usb_reverse,
            process_crypto,
            validate_json_schema,
            execute_pipeline,
            execute_pipeline_api_node,
            get_saved_pipelines,
            get_saved_pipeline,
            create_saved_pipeline,
            update_saved_pipeline,
            delete_saved_pipeline,
            import_saved_pipelines,
            get_json_schemas,
            get_json_schema,
            create_json_schema,
            update_json_schema,
            delete_json_schema,
            import_json_schemas,
            get_crypto_presets,
            get_crypto_preset,
            create_crypto_preset,
            update_crypto_preset,
            delete_crypto_preset,
            import_crypto_presets,
        ])
}

fn load_dotenv_manually() {
    if let Ok(mut exe_path) = std::env::current_exe() {
        for _ in 0..6 {
            if exe_path.pop() {
                let dotenv_path = exe_path.join(".env");
                if dotenv_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(&dotenv_path) {
                        for line in content.lines() {
                            let trimmed = line.trim();
                            if trimmed.is_empty() || trimmed.starts_with('#') {
                                continue;
                            }
                            if let Some((key, val)) = trimmed.split_once('=') {
                                let key = key.trim();
                                let val = val.trim().trim_matches('"').trim_matches('\'');
                                std::env::set_var(key, val);
                            }
                        }
                    }
                    break;
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_dotenv_manually();
    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::TRACE)
        .try_init();
    let specta_builder = get_specta_builder();

    #[cfg(debug_assertions)]
    {
        let args: Vec<String> = std::env::args().collect();
        let is_deep_link = args.iter().any(|arg| arg.starts_with("horizon-gateway://"));
        if !is_deep_link {
            specta_builder
                .export(
                    specta_typescript::Typescript::default(),
                    "../src/bindings.ts",
                )
                .expect("Failed to export typescript bindings");
        }
    }

    // Required by rustls 0.23: set process-wide crypto provider before any TLS (e.g. reverse HTTPS proxy).
    let () = rustls::crypto::ring::default_provider()
        .install_default()
        .expect("rustls default crypto provider");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            tracing::info!("RUST DEBUG - Single Instance triggered with args: {:?}", argv);
            use tauri::{Manager, Emitter};
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
            // Manually capture deep link urls from secondary process arguments and hand-off to frontend
            for arg in argv {
                if arg.starts_with("horizon-gateway://") {
                    tracing::info!("RUST DEBUG - Handed-off deep link URL from single instance: {}", arg);
                    let _ = app.emit("deep-link-received", arg);
                }
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            use tauri::{Manager, Emitter};
            use tracing_subscriber::{filter::LevelFilter, layer::SubscriberExt, util::SubscriberInitExt, Layer};

            let is_cli_mode = std::env::args().nth(1).as_deref() == Some("cli");
            let log_level = if is_cli_mode {
                LevelFilter::ERROR
            } else {
                LevelFilter::TRACE
            };

            let tauri_layer = crate::logging::TauriEmitterLayer {
                app_handle: app.handle().clone(),
            };

            // Only init once
            let _ = tracing_subscriber::registry()
                .with(tracing_subscriber::fmt::layer().with_filter(log_level))
                .with(tauri_layer.with_filter(log_level))
                .try_init();

            let ctx = crate::runtime::bootstrap_app_context()
                .expect("failed to bootstrap app context");

            let crate::runtime::AppContext {
                app_data_dir: _,
                ca_service,
                domain_service,
                group_service,
                link_service,
                monitor_service,
                local_route_service,
                proxy_settings_service,
                api_logging_service,
                api_log_service,
                mocking_service,
                inspector_service,
                tunnel_service,
                usb_service,
                pipeline_library_service,
                json_schema_registry_service,
                crypto_preset_service,
            } = ctx;

            // Clone/read values needed for auto-start before `app.manage()` moves them.
            let route_svc_for_proxy = Arc::clone(&local_route_service);
            let proxy_settings_snapshot = proxy_settings_service.get();
            let api_logging_map_for_proxy = api_logging_service.settings_map_arc();
            let ca_service_for_proxy = Arc::clone(&ca_service);
            let mocking_service_for_proxy = Arc::clone(&mocking_service);
            let inspector_svc_for_proxy = inspector_service.clone();

            app.manage(ca_service);
            app.manage(domain_service);
            app.manage(group_service);
            app.manage(link_service);
            app.manage(monitor_service);
            app.manage(local_route_service);
            app.manage(proxy_settings_service);
            app.manage(api_logging_service);
            app.manage(api_log_service.clone());
            app.manage(mocking_service);
            app.manage(inspector_service);
            app.manage(tunnel_service.clone());
            app.manage(usb_service);
            app.manage(pipeline_library_service);
            app.manage(json_schema_registry_service);
            app.manage(crypto_preset_service);
            // Deep Link Listener
            use tauri_plugin_deep_link::DeepLinkExt;
            let handle = app.handle().clone();
            #[cfg(target_os = "windows")]
            match handle.deep_link().register("horizon-gateway") {
                Ok(_) => tracing::info!("RUST DEBUG - Successfully registered deep link scheme: horizon-gateway"),
                Err(e) => tracing::info!("RUST DEBUG - Failed to register deep link scheme: {:?}", e),
            }
            let handle_clone = handle.clone();
            let _ = handle.deep_link().on_open_url(move |event| {
                if let Some(url) = event.urls().first() {
                    tracing::info!("RUST DEBUG - Deep link received URL: {}", url);
                    let _ = handle_clone.emit("deep-link-received", url.as_str());
                }
            });

            // CLI 명령형 인자 인터셉트
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 && args[1] == "cli" {
                let code = cli::execute_cli(
                    &args[2..],
                    cli::CliExecutionMode::Gui {
                        app_handle: app.handle(),
                    },
                );
                std::process::exit(code);
            }

            // Start the Hand-off diagnostic Axum server
            let app_handle_clone = app.handle().clone();
            let tunnel_service_for_axum = tunnel_service.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = tunnel_service_for_axum.start_axum_server(app_handle_clone).await {
                    tracing::error!("Failed to start Hand-off Axum server: {}", e);
                }
            });

            // ── Auto-start proxy ────────────────────────────────────────────
            {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    use tauri::Emitter;
                    match command::local_route_commands::auto_start_proxy(
                        app_handle.clone(),
                        route_svc_for_proxy,
                        &proxy_settings_snapshot,
                        api_logging_map_for_proxy,
                        std::sync::Arc::new(api_log_service.clone()),
                        ca_service_for_proxy,
                        mocking_service_for_proxy,
                        inspector_svc_for_proxy,
                    )
                    .await
                    {
                        Ok(()) => {
                            command::local_route_commands::set_auto_start_error(None);
                            let _ = app_handle.emit(
                                command::local_route_commands::PROXY_STATUS_CHANGED,
                                &command::local_route_commands::get_proxy_status_payload(),
                            );
                        }
                        Err(e) => {
                            tracing::error!("[auto-start] proxy failed: {e}");
                            command::local_route_commands::set_auto_start_error(Some(e.clone()));
                            let _ = app_handle
                                .emit(command::local_route_commands::PROXY_AUTO_START_ERROR, &e);
                        }
                    }
                });
            }

            // Background status check probe (runs every 2 min for domains with check_enabled)
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    {
                        use tauri::Manager;
                        let domain_service = handle.state::<DomainService>();
                        let group_service = handle.state::<DomainGroupService>();
                        let link_service = handle.state::<DomainGroupLinkService>();
                        let monitor_service = handle.state::<DomainMonitorService>();
                        let proxy_settings_service = handle.state::<ProxySettingsService>();

                        // Perform checks (uses global DNS from Settings when set)
                        let _ = monitor_service
                            .check_domains(
                                &domain_service,
                                &group_service,
                                &link_service,
                                &proxy_settings_service,
                            )
                            .await;
                        tracing::info!("Background status check completed");
                    }
                    // Wait for 2 minutes before next check
                    tokio::time::sleep(std::time::Duration::from_secs(120)).await;
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(specta_builder.invoke_handler())
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::CloseRequested { .. },
                ..
            } => {
                if label == "main" {
                    app_handle.exit(0);
                }
            }
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                use tauri::Manager;

                // Clear system PAC URL on exit to prevent breaking user's internet
                let _ = crate::service::system_proxy_service::SystemProxyService::clear_pac_url();

                // Kill cloudflared tunnel if running
                if let Some(tunnel_svc) = app_handle.try_state::<Arc<TunnelService>>() {
                    tauri::async_runtime::block_on(async {
                        let mut child_guard = tunnel_svc.child.lock().await;
                        if let Some(mut child) = child_guard.take() {
                            let _ = child.kill().await;
                        }
                    });
                }
            }
            _ => {}
        });
}

pub fn execute_cli_standalone(args: &[String]) {
    cli::execute_cli(args, cli::CliExecutionMode::StandaloneMeta);
}

pub fn install_rustls_provider() {
    let () = rustls::crypto::ring::default_provider()
        .install_default()
        .expect("rustls default crypto provider");
}

/// Headless `cli run` — bootstraps services without Tauri/WebView.
pub fn execute_cli_headless(args: &[String]) -> i32 {
    use tracing_subscriber::{filter::LevelFilter, util::SubscriberInitExt};

    install_rustls_provider();

    let _ = tracing_subscriber::fmt()
        .with_max_level(LevelFilter::ERROR)
        .try_init();

    let ctx = match crate::runtime::bootstrap_app_context() {
        Ok(ctx) => ctx,
        Err(e) => {
            cli::print_cli_error(&e);
            return 1;
        }
    };

    let rt = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            cli::print_cli_error(&format!("failed to start async runtime: {e}"));
            return 1;
        }
    };

    let runtime = crate::runtime::CliRuntime::Tokio(&rt);
    let env = crate::runtime::CommandEnv {
        ctx: Some(&ctx),
        app_handle: None,
        runtime,
    };

    cli::execute_cli(args, cli::CliExecutionMode::Headless { env })
}
