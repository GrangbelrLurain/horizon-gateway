use tauri::State;
use std::collections::HashMap;
use crate::model::scenario::Scenario;
use crate::model::mock_rule::MockRule;
use crate::model::mocking_settings::MockingSettings;
use crate::model::api_response::ApiResponse;
use crate::service::mocking_service::MockingService;
use crate::service::api_log_service::ApiLogService;

pub const MOCKING_STATUS_CHANGED: &str = "mocking-status-changed";

#[tauri::command]
pub fn get_mocking_status(service: State<'_, std::sync::Arc<MockingService>>) -> Result<ApiResponse<MockingSettings>, String> {
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: service.get_settings(),
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetMockingEnabledPayload {
    pub enabled: bool,
}

#[tauri::command]
pub fn set_mocking_enabled(
    app: tauri::AppHandle,
    payload: SetMockingEnabledPayload,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<MockingSettings>, String> {
    use tauri::Emitter;
    let settings = service.set_enabled(payload.enabled);
    crate::service::local_proxy::set_mocking_enabled(payload.enabled);

    let _ = app.emit(MOCKING_STATUS_CHANGED, &settings);
    Ok(ApiResponse {
        message: format!(
            "Mocking {}",
            if payload.enabled { "enabled" } else { "disabled" }
        ),
        success: true,
        data: settings,
    })
}

#[tauri::command]
pub fn get_scenarios(service: State<'_, std::sync::Arc<MockingService>>) -> Result<Vec<Scenario>, String> {
    Ok(service.get_scenarios())
}

#[tauri::command]
pub fn create_scenario(
    name: String,
    description: Option<String>,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<Scenario, String> {
    Ok(service.create_scenario(name, description))
}

#[tauri::command]
pub fn update_scenario(
    id: String,
    name: Option<String>,
    description: Option<String>,
    enabled: Option<bool>,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<Scenario, String> {
    service
        .update_scenario(id, name, description, enabled)
        .ok_or_else(|| "Scenario not found".to_string())
}

#[tauri::command]
pub fn set_scenario_enabled(
    id: String,
    enabled: bool,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<Vec<Scenario>, String> {
    Ok(service.set_scenario_enabled(id, enabled))
}

#[tauri::command]
pub fn delete_scenario(id: String, service: State<'_, std::sync::Arc<MockingService>>) -> Result<bool, String> {
    Ok(service.delete_scenario(id))
}

#[tauri::command]
pub fn get_mock_rules(service: State<'_, std::sync::Arc<MockingService>>) -> Result<Vec<MockRule>, String> {
    Ok(service.get_mock_rules())
}

#[tauri::command]
pub fn get_mock_rules_by_scenario(
    scenario_id: String,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<Vec<MockRule>, String> {
    Ok(service.get_mock_rules_by_scenario(&scenario_id))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn create_mock_rule(
    scenario_id: String,
    host: Option<String>,
    method: String,
    url_pattern: String,
    response_status: u16,
    response_headers: HashMap<String, String>,
    response_body: Option<String>,
    enabled: bool,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<MockRule, String> {
    Ok(service.create_mock_rule(
        scenario_id,
        host,
        method,
        url_pattern,
        response_status,
        response_headers,
        response_body,
        enabled,
    ))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_mock_rule(
    id: String,
    host: Option<String>,
    method: Option<String>,
    url_pattern: Option<String>,
    response_status: Option<u16>,
    response_headers: Option<HashMap<String, String>>,
    response_body: Option<String>,
    enabled: Option<bool>,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<MockRule, String> {
    service.update_mock_rule(
        id,
        host,
        method,
        url_pattern,
        response_status,
        response_headers,
        response_body,
        enabled,
    ).ok_or_else(|| "MockRule not found".to_string())
}

#[tauri::command]
pub fn delete_mock_rule(id: String, service: State<'_, std::sync::Arc<MockingService>>) -> Result<bool, String> {
    Ok(service.delete_mock_rule(id))
}

#[tauri::command]
pub fn create_mock_rule_from_log(
    log_date: String,
    log_id: String,
    scenario_id: String,
    log_service: State<'_, ApiLogService>,
    mock_service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<MockRule, String> {
    let logs = log_service.get_logs(&log_date, None, None, None, false);
    let log = logs.into_iter().find(|l| l.id == log_id).ok_or_else(|| "Log not found".to_string())?;

    let method = log.method.clone();
    let host = Some(log.host.clone());
    let url_pattern = log.path.clone(); // Basic matching initially based on path.
    let response_status = log.status_code.unwrap_or(200);
    let response_headers = log.response_headers.unwrap_or_default();
    let response_body = log.response_body.clone();

    Ok(mock_service.create_mock_rule(
        scenario_id,
        host,
        method,
        url_pattern,
        response_status,
        response_headers,
        response_body,
        true, // Enable by default
    ))
}
