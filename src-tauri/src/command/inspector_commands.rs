use crate::model::api_response::ApiResponse;
use crate::model::inspector::Annotation;
use crate::service::inspector_service::InspectorService;
use crate::service::local_proxy;
use tauri::State;

#[tauri::command]
pub fn get_annotations(
    service: State<'_, InspectorService>,
) -> Result<ApiResponse<Vec<Annotation>>, String> {
    let list = service.get_all();
    Ok(ApiResponse {
        message: format!("{}개의 정책 조회 완료", list.len()),
        success: true,
        data: list,
    })
}

#[derive(serde::Deserialize)]
pub struct DeleteAnnotationPayload {
    pub id: String,
}

#[tauri::command]
pub fn add_annotation(
    service: State<'_, InspectorService>,
    payload: Annotation,
) -> Result<ApiResponse<Vec<Annotation>>, String> {
    service.add_annotation(payload);
    let list = service.get_all();
    Ok(ApiResponse {
        message: "새로운 UX 정책이 저장되었습니다.".to_string(),
        success: true,
        data: list,
    })
}

#[derive(serde::Deserialize)]
pub struct UpdateAnnotationPayload {
    pub id: String,
    pub role: String,
    pub description: String,
}

#[tauri::command]
pub fn update_annotation(
    service: State<'_, InspectorService>,
    payload: UpdateAnnotationPayload,
) -> Result<ApiResponse<Vec<Annotation>>, String> {
    service.update_annotation(payload.id, payload.role, payload.description);
    let list = service.get_all();
    Ok(ApiResponse {
        message: "정책이 수정되었습니다.".to_string(),
        success: true,
        data: list,
    })
}

#[tauri::command]
pub fn delete_annotation(
    service: State<'_, InspectorService>,
    payload: DeleteAnnotationPayload,
) -> Result<ApiResponse<Vec<Annotation>>, String> {
    service.delete_annotation(payload.id);
    let list = service.get_all();
    Ok(ApiResponse {
        message: "정책이 삭제되었습니다.".to_string(),
        success: true,
        data: list,
    })
}

#[derive(serde::Deserialize)]
pub struct SetEnabledPayload {
    pub enabled: bool,
}

#[tauri::command]
pub fn set_global_inspector_enabled(payload: SetEnabledPayload) -> Result<(), String> {
    local_proxy::set_inspector_enabled(payload.enabled);
    Ok(())
}

#[tauri::command]
pub fn get_global_inspector_enabled() -> bool {
    local_proxy::is_inspector_enabled()
}
