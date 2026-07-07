pub mod init;
pub mod query;

use crate::service::api_log_service::ApiLogService;
use crate::service::mocking_service::MockingService;
use crate::service::domain_service::DomainService;
use crate::service::domain_group_link_service::DomainGroupLinkService;
use crate::service::domain_group_service::DomainGroupService;
use crate::service::domain_monitor_service::DomainMonitorService;
use crate::service::api_logging_settings_service::ApiLoggingSettingsService;
use crate::service::local_route_service::LocalRouteService;
use crate::service::inspector_service::InspectorService;
use crate::service::proxy_settings_service::ProxySettingsService;
use crate::service::ca_service::CaService;
use crate::service::tunnel_service::TunnelService;
use crate::service::usb_service::UsbService;
use crate::command;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use tauri::Manager;

#[derive(Serialize)]
pub struct CliCommandInfo {
    pub name: &'static str,
    pub description: &'static str,
    pub payload_example: &'static str,
}

pub const CLI_COMMANDS: &[CliCommandInfo] = &[
    // --- API Logging Settings ---
    crate::command::api_log_commands::GET_DOMAIN_API_LOGGING_LINKS_CLI_INFO,
    crate::command::api_log_commands::SET_DOMAIN_API_LOGGING_CLI_INFO,
    crate::command::api_log_commands::REMOVE_DOMAIN_API_LOGGING_CLI_INFO,
    // --- API Schema ---
    crate::command::api_log_commands::DOWNLOAD_API_SCHEMA_CLI_INFO,
    crate::command::api_log_commands::GET_API_SCHEMA_CONTENT_CLI_INFO,
    crate::command::api_log_commands::SEND_API_REQUEST_CLI_INFO,
    // --- API Logs ---
    crate::command::api_log_commands::LIST_API_LOG_DATES_CLI_INFO,
    crate::command::api_log_commands::GET_API_LOGS_CLI_INFO,
    crate::command::api_log_commands::CLEAR_API_LOGS_CLI_INFO,
    // --- Domains ---
    crate::command::domain_commands::GET_DOMAINS_CLI_INFO,
    crate::command::domain_commands::GET_DOMAIN_BY_ID_CLI_INFO,
    crate::command::domain_commands::REGIST_DOMAINS_CLI_INFO,
    crate::command::domain_commands::UPDATE_DOMAIN_BY_ID_CLI_INFO,
    crate::command::domain_commands::REMOVE_DOMAINS_CLI_INFO,
    crate::command::domain_commands::IMPORT_DOMAINS_CLI_INFO,
    crate::command::domain_commands::CLEAR_ALL_DOMAINS_CLI_INFO,
    // --- Domain Groups ---
    crate::command::domain_group_commands::GET_GROUPS_CLI_INFO,
    crate::command::domain_group_commands::CREATE_GROUP_CLI_INFO,
    crate::command::domain_group_commands::UPDATE_GROUP_CLI_INFO,
    crate::command::domain_group_commands::DELETE_GROUP_CLI_INFO,
    crate::command::domain_group_commands::GET_DOMAIN_GROUP_LINKS_CLI_INFO,
    crate::command::domain_group_commands::SET_DOMAIN_GROUPS_CLI_INFO,
    crate::command::domain_group_commands::SET_GROUP_DOMAINS_CLI_INFO,
    crate::command::domain_group_commands::GET_DOMAINS_BY_GROUP_CLI_INFO,
    crate::command::domain_group_commands::GET_GROUPS_FOR_DOMAIN_CLI_INFO,
    // --- Domain Monitor ---
    crate::command::domain_monitor_command::GET_LATEST_STATUS_CLI_INFO,
    crate::command::domain_monitor_command::CHECK_DOMAIN_STATUS_CLI_INFO,
    crate::command::domain_monitor_command::GET_DOMAIN_MONITOR_LIST_CLI_INFO,
    crate::command::domain_monitor_command::SET_DOMAIN_MONITOR_CHECK_ENABLED_CLI_INFO,
    crate::command::domain_monitor_command::GET_DOMAIN_STATUS_LOGS_CLI_INFO,
    // --- Local Routing ---
    crate::command::local_route_commands::GET_LOCAL_ROUTES_CLI_INFO,
    crate::command::local_route_commands::ADD_LOCAL_ROUTE_CLI_INFO,
    crate::command::local_route_commands::UPDATE_LOCAL_ROUTE_CLI_INFO,
    crate::command::local_route_commands::REMOVE_LOCAL_ROUTE_CLI_INFO,
    crate::command::local_route_commands::SET_LOCAL_ROUTE_ENABLED_CLI_INFO,
    // --- Proxy ---
    crate::command::local_route_commands::GET_PROXY_STATUS_CLI_INFO,
    crate::command::local_route_commands::GET_PROXY_AUTO_START_ERROR_CLI_INFO,
    crate::command::local_route_commands::GET_PROXY_SETTINGS_CLI_INFO,
    crate::command::local_route_commands::SET_PROXY_DNS_SERVER_CLI_INFO,
    crate::command::local_route_commands::SET_PROXY_PORT_CLI_INFO,
    crate::command::local_route_commands::SET_PROXY_REVERSE_PORTS_CLI_INFO,
    crate::command::local_route_commands::GET_PROXY_SETUP_URL_CLI_INFO,
    crate::command::local_route_commands::START_LOCAL_PROXY_CLI_INFO,
    crate::command::local_route_commands::STOP_LOCAL_PROXY_CLI_INFO,
    crate::command::local_route_commands::SET_LOCAL_ROUTING_ENABLED_CLI_INFO,
    // --- Mocking ---
    crate::command::mocking_commands::GET_MOCKING_STATUS_CLI_INFO,
    crate::command::mocking_commands::SET_MOCKING_ENABLED_CLI_INFO,
    crate::command::mocking_commands::GET_SCENARIOS_CLI_INFO,
    crate::command::mocking_commands::CREATE_SCENARIO_CLI_INFO,
    crate::command::mocking_commands::UPDATE_SCENARIO_CLI_INFO,
    crate::command::mocking_commands::SET_SCENARIO_ENABLED_CLI_INFO,
    crate::command::mocking_commands::DELETE_SCENARIO_CLI_INFO,
    crate::command::mocking_commands::GET_MOCK_RULES_CLI_INFO,
    crate::command::mocking_commands::GET_MOCK_RULES_BY_SCENARIO_CLI_INFO,
    crate::command::mocking_commands::CREATE_MOCK_RULE_CLI_INFO,
    crate::command::mocking_commands::UPDATE_MOCK_RULE_CLI_INFO,
    crate::command::mocking_commands::DELETE_MOCK_RULE_CLI_INFO,
    crate::command::mocking_commands::CREATE_MOCK_RULE_FROM_LOG_CLI_INFO,
    // --- Cryptography & Encoding ---
    crate::command::crypto_commands::PROCESS_CRYPTO_CLI_INFO,
    crate::command::crypto_commands::VALIDATE_JSON_SCHEMA_CLI_INFO,
    // --- Inspector ---
    crate::command::inspector_commands::GET_ANNOTATIONS_CLI_INFO,
    crate::command::inspector_commands::ADD_ANNOTATION_CLI_INFO,
    crate::command::inspector_commands::UPDATE_ANNOTATION_CLI_INFO,
    crate::command::inspector_commands::DELETE_ANNOTATION_CLI_INFO,
    crate::command::inspector_commands::IMPORT_ANNOTATIONS_CLI_INFO,
    crate::command::inspector_commands::GET_GLOBAL_INSPECTOR_ENABLED_CLI_INFO,
    crate::command::inspector_commands::SET_GLOBAL_INSPECTOR_ENABLED_CLI_INFO,
    crate::command::inspector_commands::GET_INJECTION_DOMAINS_CLI_INFO,
    crate::command::inspector_commands::SET_INJECTION_DOMAINS_CLI_INFO,
    // --- Pipeline ---
    crate::command::pipeline_commands::EXECUTE_PIPELINE_CLI_INFO,
    crate::command::pipeline_commands::EXECUTE_PIPELINE_API_NODE_CLI_INFO,
    // --- Settings ---
    crate::command::settings_commands::EXPORT_ALL_SETTINGS_CLI_INFO,
    crate::command::settings_commands::IMPORT_ALL_SETTINGS_CLI_INFO,
    crate::command::settings_commands::SAVE_ROOT_CA_CLI_INFO,
    // --- Tunnel ---
    crate::command::tunnel_commands::GET_TAILSCALE_IP_CLI_INFO,
    crate::command::tunnel_commands::START_CLOUDFLARE_TUNNEL_CLI_INFO,
    crate::command::tunnel_commands::STOP_CLOUDFLARE_TUNNEL_CLI_INFO,
    // --- USB ---
    crate::command::usb_commands::CHECK_ADB_STATUS_CLI_INFO,
    crate::command::usb_commands::START_USB_REVERSE_CLI_INFO,
    crate::command::usb_commands::STOP_USB_REVERSE_CLI_INFO,
    // --- Window ---
    crate::command::window_commands::OPEN_WINDOW_CLI_INFO,
    crate::command::window_commands::OPEN_INSPECTOR_WINDOW_CLI_INFO,
    crate::command::window_commands::OPEN_ANNOTATION_DIALOG_CLI_INFO,
];

fn get_arg_val(args: &[String], flag: &str) -> Option<String> {
    let pos = args.iter().position(|x| x == flag)?;
    if pos + 1 < args.len() {
        Some(args[pos + 1].clone())
    } else {
        None
    }
}

pub fn execute_cli(args: &[String], app_handle: Option<&tauri::AppHandle>) {
    if args.is_empty() {
        print_error("명령어가 지정되지 않았습니다. (사용 가능한 명령: init, list, help, run)");
        return;
    }

    let command = &args[0];
    match command.as_str() {
        "init" => {
            init::execute_init(&args[1..]);
        }
        "list" => {
            let output = serde_json::json!({
                "success": true,
                "data": CLI_COMMANDS
            });
            cli_println(&serde_json::to_string_pretty(&output).unwrap());
        }
        "help" => {
            if args.len() < 2 {
                print_error("help 명령어 뒤에 조회할 명령어 이름을 입력해주세요. (예: cli help get_api_logs)");
                return;
            }
            let cmd_name = &args[1];
            if let Some(info) = CLI_COMMANDS.iter().find(|c| c.name == cmd_name) {
                let output = serde_json::json!({
                    "success": true,
                    "data": info
                });
                cli_println(&serde_json::to_string_pretty(&output).unwrap());
            } else {
                print_error(&format!("존재하지 않는 명령어입니다: {}", cmd_name));
            }
        }
        "run" => {
            if args.len() < 2 {
                print_error("실행할 명령어 이름을 입력해주세요. (예: cli run get_api_logs '{}')");
                return;
            }
            let cmd_name = &args[1];
            let raw_payload = args.get(2).cloned().unwrap_or_else(|| "{}".to_string());
            let query = get_arg_val(args, "--query");

            let payload: Value = match serde_json::from_str(&raw_payload) {
                Ok(v) => v,
                Err(e) => {
                    print_error(&format!("요청 페이로드가 올바른 JSON 형식이 아닙니다: {}", e));
                    return;
                }
            };

            let handle = match app_handle {
                Some(h) => h,
                None => {
                    print_error("Tauri handle is not initialized. Run commands are not supported standalone.");
                    return;
                }
            };

            // Dispatch command
            match dispatch_command(cmd_name, payload, handle) {
                Ok(response) => {
                    let final_response = if let Some(ref q) = query {
                        query::apply_query(&response, q)
                    } else {
                        response
                    };
                    cli_println(&serde_json::to_string_pretty(&final_response).unwrap());
                }
                Err(e) => {
                    print_error(&e);
                }
            }
        }
        _ => {
            print_error(&format!(
                "알 수 없는 명령어입니다: {}. (사용 가능한 명령: init, list, help, run)",
                command
            ));
        }
    }
}

pub fn cli_println(text: &str) {
    #[cfg(windows)]
    {
        print_to_handle(text, -11); // STD_OUTPUT_HANDLE
    }
    #[cfg(not(windows))]
    {
        println!("{}", text);
    }
}

pub fn cli_eprintln(text: &str) {
    #[cfg(windows)]
    {
        print_to_handle(text, -12); // STD_ERROR_HANDLE
    }
    #[cfg(not(windows))]
    {
        eprintln!("{}", text);
    }
}

#[cfg(windows)]
#[allow(unsafe_code)]
fn print_to_handle(text: &str, n_std_handle: i32) {
    use std::io::Write;
    use std::os::windows::io::FromRawHandle;
    
    extern "system" {
        fn GetStdHandle(n_std_handle: i32) -> *mut std::ffi::c_void;
        fn GetFileType(h_file: *mut std::ffi::c_void) -> u32;
    }
    
    unsafe {
        let handle = GetStdHandle(n_std_handle);
        if !handle.is_null() && handle as isize != -1 {
            let file_type = GetFileType(handle);
            // FILE_TYPE_DISK (1) or FILE_TYPE_PIPE (3) means stdio is redirected to file/pipe.
            if file_type == 1 || file_type == 3 {
                let mut file = std::mem::ManuallyDrop::new(std::fs::File::from_raw_handle(handle));
                let mut text_with_newline = text.to_string();
                text_with_newline.push_str("\r\n");
                let _ = file.write_all(text_with_newline.as_bytes());
                let _ = file.flush();
                return;
            }
        }
        
        // Otherwise, if we are attached to a console, print to CONOUT$ / CONERR$
        let con_path = if n_std_handle == -11 { "CONOUT$" } else { "CONERR$" };
        if let Ok(mut file) = std::fs::OpenOptions::new().write(true).open(con_path) {
            let mut text_with_newline = text.to_string();
            text_with_newline.push_str("\r\n");
            let _ = file.write_all(text_with_newline.as_bytes());
            let _ = file.flush();
        }
    }
}

fn print_error(msg: &str) {
    let output = serde_json::json!({
        "success": false,
        "error": msg
    });
    cli_eprintln(&serde_json::to_string_pretty(&output).unwrap());
}

fn dispatch_command(
    cmd_name: &str,
    payload: Value,
    app_handle: &tauri::AppHandle,
) -> Result<Value, String> {
    match cmd_name {
        // --- API Logging Settings ---
        "get_domain_api_logging_links" => {
            let api_logging_service = app_handle.state::<ApiLoggingSettingsService>();
            let result = command::api_log_commands::get_domain_api_logging_links(api_logging_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_domain_api_logging" => {
            let api_logging_service = app_handle.state::<ApiLoggingSettingsService>();
            let domain_service = app_handle.state::<DomainService>();
            let parsed: command::api_log_commands::SetDomainApiLoggingPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::api_log_commands::set_domain_api_logging(parsed, api_logging_service, domain_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "remove_domain_api_logging" => {
            let api_logging_service = app_handle.state::<ApiLoggingSettingsService>();
            let domain_service = app_handle.state::<DomainService>();
            let parsed: command::api_log_commands::RemoveDomainApiLoggingPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::api_log_commands::remove_domain_api_logging(parsed, api_logging_service, domain_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- API Schema ---
        "get_api_schema_content" => {
            let parsed: command::api_log_commands::GetApiSchemaPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let app = app_handle.clone();
            let result = command::api_log_commands::get_api_schema_content(parsed, app)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- API Logs ---
        "list_api_log_dates" => {
            let api_log_service = app_handle.state::<ApiLogService>();
            let result = command::api_log_commands::list_api_log_dates(api_log_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_api_logs" => {
            let api_log_service = app_handle.state::<ApiLogService>();
            let parsed_payload: command::api_log_commands::GetApiLogsPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::api_log_commands::get_api_logs(parsed_payload, api_log_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "clear_api_logs" => {
            let api_log_service = app_handle.state::<ApiLogService>();
            let parsed_payload: command::api_log_commands::ClearApiLogsPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::api_log_commands::clear_api_logs(parsed_payload, api_log_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Domains ---
        "get_domains" => {
            let domain_service = app_handle.state::<DomainService>();
            let result = command::domain_commands::get_domains(domain_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_domain_by_id" => {
            let domain_service = app_handle.state::<DomainService>();
            let parsed: command::domain_commands::GetDomainByIdPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_commands::get_domain_by_id(parsed, domain_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "regist_domains" => {
            let domain_service = app_handle.state::<DomainService>();
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let parsed_payload: command::domain_commands::RegistDomainsPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_commands::regist_domains(
                parsed_payload, domain_service, link_service, monitor_service,
            )?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "update_domain_by_id" => {
            let domain_service = app_handle.state::<DomainService>();
            let parsed: command::domain_commands::UpdateDomainByIdPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_commands::update_domain_by_id(parsed, domain_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "remove_domains" => {
            let domain_service = app_handle.state::<DomainService>();
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let api_logging_service = app_handle.state::<ApiLoggingSettingsService>();
            let parsed_payload: command::domain_commands::RemoveDomainsPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_commands::remove_domains(
                parsed_payload, domain_service, link_service, monitor_service, api_logging_service,
            )?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "import_domains" => {
            let domain_service = app_handle.state::<DomainService>();
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let parsed: command::domain_commands::ImportDomainsPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_commands::import_domains(parsed, domain_service, monitor_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "clear_all_domains" => {
            let domain_service = app_handle.state::<DomainService>();
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let result = command::domain_commands::clear_all_domains(domain_service, monitor_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Domain Groups ---
        "get_groups" => {
            let service = app_handle.state::<DomainGroupService>();
            let result = tauri::async_runtime::block_on(command::domain_group_commands::get_groups(service))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "create_group" => {
            let service = app_handle.state::<DomainGroupService>();
            let parsed: command::domain_group_commands::CreateGroupPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = tauri::async_runtime::block_on(command::domain_group_commands::create_group(parsed, service))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "update_group" => {
            let service = app_handle.state::<DomainGroupService>();
            let parsed: command::domain_group_commands::UpdateGroupPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = tauri::async_runtime::block_on(command::domain_group_commands::update_group(parsed, service))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "delete_group" => {
            let service = app_handle.state::<DomainGroupService>();
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let parsed: command::domain_group_commands::DeleteGroupPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = tauri::async_runtime::block_on(command::domain_group_commands::delete_group(parsed, service, link_service))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_domain_group_links" => {
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let result = command::domain_group_commands::get_domain_group_links(link_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_domain_groups" => {
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let parsed: command::domain_group_commands::SetDomainGroupsPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_group_commands::set_domain_groups(parsed, link_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_group_domains" => {
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let parsed: command::domain_group_commands::SetGroupDomainsPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_group_commands::set_group_domains(parsed, link_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_domains_by_group" => {
            let domain_service = app_handle.state::<DomainService>();
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let parsed: command::domain_group_commands::GetDomainsByGroupPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_group_commands::get_domains_by_group(parsed, domain_service, link_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_groups_for_domain" => {
            let group_service = app_handle.state::<DomainGroupService>();
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let parsed: command::domain_group_commands::GetGroupsForDomainPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_group_commands::get_groups_for_domain(parsed, group_service, link_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Domain Monitor ---
        "get_latest_status" => {
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let result = command::domain_monitor_command::get_latest_status(monitor_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_domain_monitor_list" => {
            let domain_service = app_handle.state::<DomainService>();
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let result = command::domain_monitor_command::get_domain_monitor_list(domain_service, monitor_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_domain_monitor_check_enabled" => {
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let parsed: command::domain_monitor_command::SetDomainMonitorCheckEnabledPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_monitor_command::set_domain_monitor_check_enabled(parsed, monitor_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_domain_status_logs" => {
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let parsed: command::domain_monitor_command::GetDomainStatusLogsPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::domain_monitor_command::get_domain_status_logs(parsed, monitor_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Local Routing ---
        "get_local_routes" => {
            let route_service = app_handle.state::<Arc<LocalRouteService>>();
            let result = command::local_route_commands::get_local_routes(route_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "add_local_route" => {
            let route_service = app_handle.state::<Arc<LocalRouteService>>();
            let parsed_payload: command::local_route_commands::AddLocalRoutePayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::local_route_commands::add_local_route(parsed_payload, route_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "remove_local_route" => {
            let route_service = app_handle.state::<Arc<LocalRouteService>>();
            let parsed_payload: command::local_route_commands::RemoveLocalRoutePayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::local_route_commands::remove_local_route(parsed_payload, route_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_local_route_enabled" => {
            let route_service = app_handle.state::<Arc<LocalRouteService>>();
            let parsed_payload: command::local_route_commands::SetLocalRouteEnabledPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::local_route_commands::set_local_route_enabled(parsed_payload, route_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Proxy ---
        "get_proxy_status" => {
            let result = tauri::async_runtime::block_on(async {
                command::local_route_commands::get_proxy_status().await
            })?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_proxy_auto_start_error" => {
            let result = command::local_route_commands::get_proxy_auto_start_error()?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_proxy_settings" => {
            let proxy_settings_service = app_handle.state::<ProxySettingsService>();
            let result = command::local_route_commands::get_proxy_settings(proxy_settings_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_proxy_dns_server" => {
            let proxy_settings_service = app_handle.state::<ProxySettingsService>();
            let parsed: command::local_route_commands::SetProxyDnsServerPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::local_route_commands::set_proxy_dns_server(parsed, proxy_settings_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_proxy_port" => {
            let proxy_settings_service = app_handle.state::<ProxySettingsService>();
            let parsed: command::local_route_commands::SetProxyPortPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::local_route_commands::set_proxy_port(parsed, proxy_settings_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_proxy_reverse_ports" => {
            let proxy_settings_service = app_handle.state::<ProxySettingsService>();
            let parsed: command::local_route_commands::SetProxyReversePortsPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::local_route_commands::set_proxy_reverse_ports(parsed, proxy_settings_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_proxy_setup_url" => {
            let result = command::local_route_commands::get_proxy_setup_url()?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "stop_local_proxy" => {
            let result = command::local_route_commands::stop_local_proxy(app_handle.clone())?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_local_routing_enabled" => {
            let proxy_settings_service = app_handle.state::<ProxySettingsService>();
            let parsed: command::local_route_commands::SetLocalRoutingEnabledPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::local_route_commands::set_local_routing_enabled(app_handle.clone(), parsed, proxy_settings_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Mocking ---
        "get_mocking_status" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let result = command::mocking_commands::get_mocking_status(mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_mocking_enabled" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let parsed_payload: command::mocking_commands::SetMockingEnabledPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::mocking_commands::set_mocking_enabled(
                app_handle.clone(), parsed_payload, mocking_service,
            )?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_scenarios" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let result = command::mocking_commands::get_scenarios(mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "create_scenario" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let parsed_payload: command::mocking_commands::CreateScenarioPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::mocking_commands::create_scenario(parsed_payload, mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "update_scenario" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            #[derive(serde::Deserialize)]
            struct UpdateScenarioArgs { id: String, name: Option<String>, description: Option<String>, enabled: Option<bool> }
            let parsed: UpdateScenarioArgs = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::mocking_commands::update_scenario(parsed.id, parsed.name, parsed.description, parsed.enabled, mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_scenario_enabled" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            #[derive(serde::Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct SetScenarioEnabledArgs { id: String, enabled: bool }
            let parsed: SetScenarioEnabledArgs = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::mocking_commands::set_scenario_enabled(parsed.id, parsed.enabled, mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "delete_scenario" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let id: String = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: (ID 문자열 필요) {}", e))?;
            let result = command::mocking_commands::delete_scenario(id, mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_mock_rules" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let result = command::mocking_commands::get_mock_rules(mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_mock_rules_by_scenario" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let parsed: command::mocking_commands::GetMockRulesByScenarioPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::mocking_commands::get_mock_rules_by_scenario(parsed, mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "create_mock_rule" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let parsed_payload: command::mocking_commands::CreateMockRulePayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::mocking_commands::create_mock_rule(parsed_payload, mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "update_mock_rule" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let parsed_payload: command::mocking_commands::UpdateMockRulePayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::mocking_commands::update_mock_rule(parsed_payload, mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "delete_mock_rule" => {
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let id: String = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: (ID/UUID 필요) {}", e))?;
            let result = command::mocking_commands::delete_mock_rule(id, mocking_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Cryptography & Encoding ---
        "process_crypto" => {
            let parsed_payload: command::crypto_commands::ProcessCryptoPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::crypto_commands::process_crypto(parsed_payload)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "validate_json_schema" => {
            let parsed_payload: command::crypto_commands::ValidateSchemaPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::crypto_commands::validate_json_schema(parsed_payload)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Inspector ---
        "get_annotations" => {
            let service = app_handle.state::<InspectorService>();
            let result = command::inspector_commands::get_annotations(service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "get_global_inspector_enabled" => {
            let result = command::inspector_commands::get_global_inspector_enabled()?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_global_inspector_enabled" => {
            let service = app_handle.state::<InspectorService>();
            let enabled: bool = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: (true/false 필요) {}", e))?;
            command::inspector_commands::set_global_inspector_enabled(service, enabled)?;
            Ok(serde_json::json!({"success": true, "data": null}))
        }
        "get_injection_domains" => {
            let service = app_handle.state::<InspectorService>();
            let result = command::inspector_commands::get_injection_domains(service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "set_injection_domains" => {
            let service = app_handle.state::<InspectorService>();
            let parsed: command::inspector_commands::SetInjectionDomainsPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::inspector_commands::set_injection_domains(service, parsed)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Settings ---
        "export_all_settings" => {
            let domain_service = app_handle.state::<DomainService>();
            let group_service = app_handle.state::<DomainGroupService>();
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let route_service = app_handle.state::<Arc<LocalRouteService>>();
            let proxy_settings_service = app_handle.state::<ProxySettingsService>();
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let result = command::settings_commands::export_all_settings(
                domain_service, group_service, link_service, route_service, proxy_settings_service, monitor_service,
            )?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "import_all_settings" => {
            let domain_service = app_handle.state::<DomainService>();
            let group_service = app_handle.state::<DomainGroupService>();
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let route_service = app_handle.state::<Arc<LocalRouteService>>();
            let proxy_settings_service = app_handle.state::<ProxySettingsService>();
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let parsed: crate::model::settings_export::SettingsExport = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::settings_commands::import_all_settings(
                parsed, domain_service, group_service, link_service, route_service, proxy_settings_service, monitor_service,
            )?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "save_root_ca" => {
            let ca_service = app_handle.state::<Arc<CaService>>();
            let result = tauri::async_runtime::block_on(command::settings_commands::save_root_ca(app_handle.clone(), ca_service))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- API Schema ---
        "download_api_schema" => {
            let parsed: command::api_log_commands::DownloadApiSchemaPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let app = app_handle.clone();
            let result = tauri::async_runtime::block_on(command::api_log_commands::download_api_schema(parsed, app))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "send_api_request" => {
            let parsed: command::api_log_commands::SendApiRequestPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = tauri::async_runtime::block_on(command::api_log_commands::send_api_request(parsed))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Domain Monitor ---
        "check_domain_status" => {
            let domain_service = app_handle.state::<DomainService>();
            let group_service = app_handle.state::<DomainGroupService>();
            let link_service = app_handle.state::<DomainGroupLinkService>();
            let monitor_service = app_handle.state::<DomainMonitorService>();
            let proxy_settings_service = app_handle.state::<ProxySettingsService>();
            let result = tauri::async_runtime::block_on(command::domain_monitor_command::check_domain_status(
                domain_service, group_service, link_service, monitor_service, proxy_settings_service
            ))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Proxy ---
        "start_local_proxy" => {
            let parsed: Option<command::local_route_commands::StartLocalProxyPayload> = if payload.is_null() || (payload.is_object() && payload.as_object().unwrap().is_empty()) {
                None
            } else {
                Some(serde_json::from_value(payload).map_err(|e| format!("인자 역직렬화 실패: {}", e))?)
            };
            let route_service = app_handle.state::<Arc<LocalRouteService>>();
            let proxy_settings_service = app_handle.state::<ProxySettingsService>();
            let api_logging_service = app_handle.state::<ApiLoggingSettingsService>();
            let api_log_service = app_handle.state::<ApiLogService>();
            let ca_service = app_handle.state::<Arc<CaService>>();
            let mocking_service = app_handle.state::<Arc<MockingService>>();
            let inspector_service = app_handle.state::<InspectorService>();
            let result = tauri::async_runtime::block_on(command::local_route_commands::start_local_proxy(
                app_handle.clone(), parsed, route_service, proxy_settings_service, api_logging_service, api_log_service, ca_service, mocking_service, inspector_service
            ))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Mocking ---
        "create_mock_rule_from_log" => {
            let log_service = app_handle.state::<ApiLogService>();
            let mock_service = app_handle.state::<Arc<MockingService>>();
            let parsed: command::mocking_commands::CreateMockFromLogPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = command::mocking_commands::create_mock_rule_from_log(parsed, log_service, mock_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Tunnel ---
        "get_tailscale_ip" => {
            let tunnel_service = app_handle.state::<Arc<TunnelService>>();
            let result = command::tunnel_commands::get_tailscale_ip(tunnel_service)?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "start_cloudflare_tunnel" => {
            let tunnel_service = app_handle.state::<Arc<TunnelService>>();
            let result = tauri::async_runtime::block_on(command::tunnel_commands::start_cloudflare_tunnel(tunnel_service))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "stop_cloudflare_tunnel" => {
            let tunnel_service = app_handle.state::<Arc<TunnelService>>();
            let result = tauri::async_runtime::block_on(command::tunnel_commands::stop_cloudflare_tunnel(tunnel_service))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- USB ---
        "check_adb_status" => {
            let usb_service = app_handle.state::<Arc<UsbService>>();
            let result = tauri::async_runtime::block_on(command::usb_commands::check_adb_status(usb_service))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "start_usb_reverse" => {
            let usb_service = app_handle.state::<Arc<UsbService>>();
            #[derive(serde::Deserialize)]
            struct PortPayload { port: u16 }
            let parsed: PortPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = tauri::async_runtime::block_on(command::usb_commands::start_usb_reverse(usb_service, parsed.port))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "stop_usb_reverse" => {
            let usb_service = app_handle.state::<Arc<UsbService>>();
            #[derive(serde::Deserialize)]
            struct PortPayload { port: u16 }
            let parsed: PortPayload = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = tauri::async_runtime::block_on(command::usb_commands::stop_usb_reverse(usb_service, parsed.port))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Window ---
        "open_window" => {
            #[derive(serde::Deserialize)]
            struct OpenWindowArgs { label: String, title: String, url: String, width: f64, height: f64 }
            let parsed: OpenWindowArgs = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = tauri::async_runtime::block_on(command::window_commands::open_window(
                app_handle.clone(), parsed.label, parsed.title, parsed.url, parsed.width, parsed.height
            ))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "open_inspector_window" => {
            #[derive(serde::Deserialize)]
            struct OpenInspectorArgs { url: String, script: Option<String> }
            let parsed: OpenInspectorArgs = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = tauri::async_runtime::block_on(command::window_commands::open_inspector_window(
                app_handle.clone(), parsed.url, parsed.script
            ))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "open_annotation_dialog" => {
            #[derive(serde::Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct OpenAnnotationArgs { selector: String, content: String, tagName: String, thumbnail: String }
            let parsed: OpenAnnotationArgs = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = tauri::async_runtime::block_on(command::window_commands::open_annotation_dialog(
                app_handle.clone(), parsed.selector, parsed.content, parsed.tagName, parsed.thumbnail
            ))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        // --- Pipeline ---
        "execute_pipeline" => {
            let parsed: crate::service::pipeline_runner::PipelineFlow = serde_json::from_value(payload)
                .map_err(|e| format!("인자 역직렬화 실패: {}", e))?;
            let result = tauri::async_runtime::block_on(command::pipeline_commands::execute_pipeline(parsed))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "execute_pipeline_api_node" => {
            let config_json: String = if payload.is_string() {
                payload.as_str().unwrap().to_string()
            } else {
                serde_json::to_string(&payload).unwrap()
            };
            let result = tauri::async_runtime::block_on(command::pipeline_commands::execute_pipeline_api_node(config_json))?;
            Ok(serde_json::to_value(result).unwrap())
        }
        _ => Err(format!("지원되지 않는 CLI 명령어입니다: {}", cmd_name)),
    }
}
