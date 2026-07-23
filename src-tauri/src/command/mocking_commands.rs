use crate::model::api_response::ApiResponse;
use crate::model::mock_rule::MockRule;
use crate::model::mocking_settings::MockingSettings;
use crate::model::scenario::Scenario;
use crate::service::api_log_service::ApiLogService;
use crate::service::mocking_service::MockingService;
use std::collections::HashMap;
use tauri::State;

pub const MOCKING_STATUS_CHANGED: &str = "mocking-status-changed";

pub const GET_MOCKING_STATUS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_mocking_status",
    description: "모킹 활성화 상태 및 설정을 조회합니다.",
    payload_example: "{}",
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_mocking_status(
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<MockingSettings>, String> {
    get_mocking_status_svc(&service)
}

pub fn get_mocking_status_svc(service: &std::sync::Arc<MockingService>) -> Result<ApiResponse<MockingSettings>, String> {
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: service.get_settings(),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SetMockingEnabledPayload {
    pub enabled: bool,
}

pub const SET_MOCKING_ENABLED_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "set_mocking_enabled",
    description: "모킹 활성화 여부를 변경합니다.",
    payload_example: r#"{"enabled": true}"#,
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn set_mocking_enabled(
    app: tauri::AppHandle,
    payload: SetMockingEnabledPayload,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<MockingSettings>, String> {
    set_mocking_enabled_svc(Some(app.clone()), payload, &service)
}

pub fn set_mocking_enabled_svc(app: Option<tauri::AppHandle>, payload: SetMockingEnabledPayload, service: &std::sync::Arc<MockingService>) -> Result<ApiResponse<MockingSettings>, String> {
    use tauri::Emitter;
    let settings = service.set_enabled(payload.enabled);
    crate::service::local_proxy::set_mocking_enabled(payload.enabled);

    if let Some(app) = app { let _ = app.emit(MOCKING_STATUS_CHANGED, &settings); }
    Ok(ApiResponse {
        message: format!(
            "Mocking {}",
            if payload.enabled {
                "enabled"
            } else {
                "disabled"
            }
        ),
        success: true,
        data: settings,
    })
}

pub const GET_SCENARIOS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_scenarios",
    description: "모킹 시나리오 목록을 조회합니다.",
    payload_example: "{}",
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_scenarios(
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<Vec<Scenario>>, String> {
    get_scenarios_svc(&service)
}

pub fn get_scenarios_svc(service: &std::sync::Arc<MockingService>) -> Result<ApiResponse<Vec<Scenario>>, String> {
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: service.get_scenarios(),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateScenarioPayload {
    pub name: String,
    pub description: Option<String>,
}

pub const CREATE_SCENARIO_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "create_scenario",
    description: "새로운 모킹 시나리오를 생성합니다.",
    payload_example: r#"{"name": "Scenario Name", "description": "Description"}"#,
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn create_scenario(
    payload: CreateScenarioPayload,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<Scenario>, String> {
    create_scenario_svc(payload, &service)
}

pub fn create_scenario_svc(payload: CreateScenarioPayload, service: &std::sync::Arc<MockingService>) -> Result<ApiResponse<Scenario>, String> {
    let scenario = service.create_scenario(payload.name, payload.description);
    Ok(ApiResponse {
        message: "시나리오가 생성되었습니다.".to_string(),
        success: true,
        data: scenario,
    })
}

pub const UPDATE_SCENARIO_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "update_scenario",
    description: "모킹 시나리오를 수정합니다.",
    payload_example: r#"{"id": "scenario-uuid", "name": "New Name", "description": null, "enabled": null}"#,
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn update_scenario(
    id: String,
    name: Option<String>,
    description: Option<String>,
    enabled: Option<bool>,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<Scenario, String> {
    update_scenario_svc(id, name, description, enabled, &service)
}

pub fn update_scenario_svc(id: String, name: Option<String>, description: Option<String>, enabled: Option<bool>, service: &std::sync::Arc<MockingService>) -> Result<Scenario, String> {
    service
        .update_scenario(id, name, description, enabled)
        .ok_or_else(|| "Scenario not found".to_string())
}

pub const SET_SCENARIO_ENABLED_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "set_scenario_enabled",
    description: "모킹 시나리오의 활성화 여부를 설정합니다.",
    payload_example: r#"{"id": "scenario-uuid", "enabled": true}"#,
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn set_scenario_enabled(
    id: String,
    enabled: bool,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<Vec<Scenario>, String> {
    set_scenario_enabled_svc(id, enabled, &service)
}

pub fn set_scenario_enabled_svc(id: String, enabled: bool, service: &std::sync::Arc<MockingService>) -> Result<Vec<Scenario>, String> {
    Ok(service.set_scenario_enabled(id, enabled))
}

pub const DELETE_SCENARIO_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "delete_scenario",
    description: "모킹 시나리오를 삭제합니다.",
    payload_example: r#""scenario-uuid""#,
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn delete_scenario(
    id: String,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<bool, String> {
    delete_scenario_svc(id, &service)
}

pub fn delete_scenario_svc(id: String, service: &std::sync::Arc<MockingService>) -> Result<bool, String> {
    Ok(service.delete_scenario(id))
}

pub const GET_MOCK_RULES_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_mock_rules",
    description: "모킹 룰 목록을 조회합니다.",
    payload_example: "{}",
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_mock_rules(
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<Vec<MockRule>>, String> {
    get_mock_rules_svc(&service)
}

pub fn get_mock_rules_svc(service: &std::sync::Arc<MockingService>) -> Result<ApiResponse<Vec<MockRule>>, String> {
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: service.get_mock_rules(),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetMockRulesByScenarioPayload {
    pub scenario_id: String,
}

pub const GET_MOCK_RULES_BY_SCENARIO_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_mock_rules_by_scenario",
    description: "특정 시나리오에 속한 모킹 룰 목록을 조회합니다.",
    payload_example: r#"{"scenarioId": "scenario-uuid"}"#,
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_mock_rules_by_scenario(
    payload: GetMockRulesByScenarioPayload,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<Vec<MockRule>>, String> {
    get_mock_rules_by_scenario_svc(payload, &service)
}

pub fn get_mock_rules_by_scenario_svc(payload: GetMockRulesByScenarioPayload, service: &std::sync::Arc<MockingService>) -> Result<ApiResponse<Vec<MockRule>>, String> {
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: service.get_mock_rules_by_scenario(&payload.scenario_id),
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateMockRulePayload {
    pub name: String,
    /// Optional; when omitted, rules attach to the internal Default scenario.
    pub scenario_id: Option<String>,
    pub host: Option<String>,
    pub method: String,
    pub url_pattern: String,
    pub response_status: u16,
    pub response_headers: HashMap<String, String>,
    pub response_body: Option<String>,
    pub enabled: bool,
}

pub const CREATE_MOCK_RULE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "create_mock_rule",
    description: "새로운 모킹 룰을 생성합니다.",
    payload_example: r#"{"name": "test rule", "scenarioId": null, "host": null, "method": "GET", "urlPattern": "/api/*", "responseStatus": 200, "responseHeaders": {}, "responseBody": "{}", "enabled": true}"#,
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn create_mock_rule(
    payload: CreateMockRulePayload,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<MockRule>, String> {
    create_mock_rule_svc(payload, &service)
}

pub fn create_mock_rule_svc(payload: CreateMockRulePayload, service: &std::sync::Arc<MockingService>) -> Result<ApiResponse<MockRule>, String> {
    let rule = service.create_mock_rule(
        payload.name,
        payload.scenario_id,
        payload.host,
        payload.method,
        payload.url_pattern,
        payload.response_status,
        payload.response_headers,
        payload.response_body,
        payload.enabled,
    );
    Ok(ApiResponse {
        message: "모킹 규칙이 생성되었습니다.".to_string(),
        success: true,
        data: rule,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMockRulePayload {
    pub id: String,
    pub name: Option<String>,
    pub host: Option<String>,
    pub method: Option<String>,
    pub url_pattern: Option<String>,
    pub response_status: Option<u16>,
    pub response_headers: Option<HashMap<String, String>>,
    pub response_body: Option<String>,
    pub enabled: Option<bool>,
}

pub const UPDATE_MOCK_RULE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "update_mock_rule",
    description: "모킹 룰을 수정합니다.",
    payload_example: r#"{"id": "rule-uuid", "name": null, "host": null, "method": null, "urlPattern": null, "responseStatus": null, "responseHeaders": null, "responseBody": null, "enabled": null}"#,
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn update_mock_rule(
    payload: UpdateMockRulePayload,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<MockRule>, String> {
    update_mock_rule_svc(payload, &service)
}

pub fn update_mock_rule_svc(payload: UpdateMockRulePayload, service: &std::sync::Arc<MockingService>) -> Result<ApiResponse<MockRule>, String> {
    let rule = service
        .update_mock_rule(
            payload.id,
            payload.name,
            payload.host,
            payload.method,
            payload.url_pattern,
            payload.response_status,
            payload.response_headers,
            payload.response_body,
            payload.enabled,
        )
        .ok_or_else(|| "MockRule not found".to_string())?;

    Ok(ApiResponse {
        message: "모킹 규칙이 수정되었습니다.".to_string(),
        success: true,
        data: rule,
    })
}

pub const DELETE_MOCK_RULE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "delete_mock_rule",
    description: "모킹 룰을 삭제합니다.",
    payload_example: r#""rule-uuid""#,
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn delete_mock_rule(
    id: String,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<bool, String> {
    delete_mock_rule_svc(id, &service)
}

pub fn delete_mock_rule_svc(id: String, service: &std::sync::Arc<MockingService>) -> Result<bool, String> {
    Ok(service.delete_mock_rule(id))
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateMockFromLogPayload {
    pub log_id: String,
    /// Optional; when omitted, rules attach to the internal Default scenario.
    pub scenario_id: Option<String>,
    pub name: String,
    pub log_date: String,
}

pub const CREATE_MOCK_RULE_FROM_LOG_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "create_mock_rule_from_log",
    description: "API 로그 항목을 기반으로 모킹 룰을 생성합니다.",
    payload_example: r#"{"logId": "log-uuid", "scenarioId": null, "name": "Mock from log", "logDate": "2026-07-09"}"#,
    category: "mocking",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn create_mock_rule_from_log(
    payload: CreateMockFromLogPayload,
    log_service: State<'_, ApiLogService>,
    mock_service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<MockRule>, String> {
    create_mock_rule_from_log_svc(payload, &log_service, &mock_service)
}

pub fn create_mock_rule_from_log_svc(payload: CreateMockFromLogPayload, log_service: &ApiLogService, mock_service: &std::sync::Arc<MockingService>) -> Result<ApiResponse<MockRule>, String> {
    let logs = log_service.get_logs(&payload.log_date, None, None, None, false);

    let log = logs
        .into_iter()
        .find(|l| l.id == payload.log_id)
        .ok_or_else(|| {
            "오늘 발생한 로그 중 해당 ID를 찾을 수 없습니다. (로그 날짜 불일치 가능성)".to_string()
        })?;

    let method = log.method.clone();
    let host = Some(log.host.clone());
    let url_pattern = log.path.clone();
    let response_status = log.status_code.unwrap_or(200);
    let response_headers = log.response_headers.unwrap_or_default();
    let response_body = log.response_body.clone();

    let rule = mock_service.create_mock_rule(
        payload.name,
        payload.scenario_id,
        host,
        method,
        url_pattern,
        response_status,
        response_headers,
        response_body,
        true,
    );

    Ok(ApiResponse {
        message: "스냅샷으로부터 모킹 규칙이 생성되었습니다.".to_string(),
        success: true,
        data: rule,
    })
}
