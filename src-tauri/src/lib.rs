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
}
mod service {
    pub mod api_log_service;
    pub mod api_logging_settings_service;
    pub mod ca_service;
    pub mod domain_group_link_service;
    pub mod domain_group_service;
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
use command::window_commands::{open_annotation_dialog, open_inspector_window, open_window};
use command::tunnel_commands::{get_tailscale_ip, start_cloudflare_tunnel, stop_cloudflare_tunnel};
use command::usb_commands::{check_adb_status, start_usb_reverse, stop_usb_reverse};
use command::crypto_commands::{process_crypto, validate_json_schema};
use command::pipeline_commands::execute_pipeline;
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
        ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let specta_builder = get_specta_builder();

    #[cfg(debug_assertions)]
    specta_builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");

    // Required by rustls 0.23: set process-wide crypto provider before any TLS (e.g. reverse HTTPS proxy).
    let () = rustls::crypto::ring::default_provider()
        .install_default()
        .expect("rustls default crypto provider");

    tauri::Builder::default()
        .setup(|app| {
            use std::fs;
            use tauri::Manager;
            use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

            let tauri_layer = crate::logging::TauriEmitterLayer {
                app_handle: app.handle().clone(),
            };

            // Only init once
            let _ = tracing_subscriber::registry()
                .with(tracing_subscriber::fmt::layer())
                .with(tauri_layer)
                .try_init();

            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            if !app_data_dir.exists() {
                fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");
            }

            // Tauri 메인 로직 시작 전 마이그레이션 (1→2→3 순차)
            crate::storage::migration::run_all(&app_data_dir);

            let storage_path = app_data_dir.join("domains.json");
            let groups_storage_path = app_data_dir.join("groups.json");
            let links_storage_path = app_data_dir.join("domain_group_links.json");
            let logs_dir = app_data_dir.join("logs");
            let monitor_links_path = app_data_dir.join("domain_monitor_links.json");
            let local_routes_path = app_data_dir.join("domain_local_routes.json");
            let proxy_settings_path = app_data_dir.join("proxy_settings.json");
            let api_logging_path = app_data_dir.join("domain_api_logging_links.json");
            let scenarios_path = app_data_dir.join("scenarios.json");
            let mock_rules_path = app_data_dir.join("mock_rules.json");
            let mocking_settings_path = app_data_dir.join("mocking_settings.json");
            let inspector_path = app_data_dir.join("inspector_annotations.json");
            let injection_domains_path = app_data_dir.join("injection_domains.json");
            let inspector_settings_path = app_data_dir.join("inspector_settings.json");
            let ca_service =
                Arc::new(CaService::new(&app_data_dir).expect("failed to init ca service"));
            let domain_service = DomainService::new(storage_path);
            let group_service = DomainGroupService::new(groups_storage_path);
            let link_service = DomainGroupLinkService::new(links_storage_path);
            let monitor_service = DomainMonitorService::new(logs_dir, monitor_links_path);
            let local_route_service = Arc::new(LocalRouteService::new(local_routes_path));
            let proxy_settings_service = ProxySettingsService::new(proxy_settings_path);
            let api_logging_service = ApiLoggingSettingsService::new(api_logging_path);
            let api_log_service = ApiLogService::new(app_data_dir.clone());
            let mocking_service = Arc::new(crate::service::mocking_service::MockingService::new(
                scenarios_path.clone(),
                mock_rules_path.clone(),
                mocking_settings_path.clone(),
            ));
            let inspector_service = InspectorService::new(inspector_path, injection_domains_path, inspector_settings_path);
            let tunnel_service = Arc::new(TunnelService::new());
            let usb_service = Arc::new(UsbService::new());

            crate::service::local_proxy::set_mocking_enabled(
                mocking_service.get_settings().enabled,
            );
            crate::service::local_proxy::set_inspector_enabled(
                inspector_service.get_settings().enabled,
            );

            monitor_service.sync_with_domains(&domain_service.get_all());
            api_logging_service.refresh_map(&domain_service.get_all());

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
