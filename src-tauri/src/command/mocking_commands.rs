use crate::model::api_response::ApiResponse;
use crate::model::mock_rule::MockRule;
use crate::model::mocking_settings::MockingSettings;
use crate::model::scenario::Scenario;
use crate::service::api_log_service::ApiLogService;
use crate::service::mocking_service::MockingService;
use std::collections::HashMap;
use tauri::State;

pub const MOCKING_STATUS_CHANGED: &str = "mocking-status-changed";

#[tauri::command]
pub fn get_mocking_status(
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<MockingSettings>, String> {
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

#[tauri::command]
pub fn get_scenarios(
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<Vec<Scenario>>, String> {
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: service.get_scenarios(),
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateScenarioPayload {
    pub name: String,
    pub description: Option<String>,
}

#[tauri::command]
pub fn create_scenario(
    payload: CreateScenarioPayload,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<Scenario>, String> {
    let scenario = service.create_scenario(payload.name, payload.description);
    Ok(ApiResponse {
        message: "시나리오가 생성되었습니다.".to_string(),
        success: true,
        data: scenario,
    })
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
pub fn delete_scenario(
    id: String,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<bool, String> {
    Ok(service.delete_scenario(id))
}

#[tauri::command]
pub fn get_mock_rules(
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<Vec<MockRule>>, String> {
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: service.get_mock_rules(),
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetMockRulesByScenarioPayload {
    pub scenario_id: String,
}

#[tauri::command]
pub fn get_mock_rules_by_scenario(
    payload: GetMockRulesByScenarioPayload,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<Vec<MockRule>>, String> {
    Ok(ApiResponse {
        message: "OK".to_string(),
        success: true,
        data: service.get_mock_rules_by_scenario(&payload.scenario_id),
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMockRulePayload {
    pub name: String,
    pub scenario_id: String,
    pub host: Option<String>,
    pub method: String,
    pub url_pattern: String,
    pub response_status: u16,
    pub response_headers: HashMap<String, String>,
    pub response_body: Option<String>,
    pub enabled: bool,
}

#[tauri::command]
pub fn create_mock_rule(
    payload: CreateMockRulePayload,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<MockRule>, String> {
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

#[derive(serde::Deserialize)]
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

#[tauri::command]
pub fn update_mock_rule(
    payload: UpdateMockRulePayload,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<MockRule>, String> {
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

#[tauri::command]
pub fn delete_mock_rule(
    id: String,
    service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<bool, String> {
    Ok(service.delete_mock_rule(id))
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMockFromLogPayload {
    pub log_id: String,
    pub scenario_id: String,
    pub name: String,
    pub log_date: String,
}

#[tauri::command]
pub fn create_mock_rule_from_log(
    payload: CreateMockFromLogPayload,
    log_service: State<'_, ApiLogService>,
    mock_service: State<'_, std::sync::Arc<MockingService>>,
) -> Result<ApiResponse<MockRule>, String> {
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
