use crate::model::api_response::ApiResponse;
use crate::model::saved_pipeline::{SavedPipeline, SavedPipelineFlow};
use crate::service::pipeline_library_service::PipelineLibraryService;
use std::sync::Arc;
use tauri::State;

pub const GET_SAVED_PIPELINES_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_saved_pipelines",
    description: "저장된 파이프라인 라이브러리 목록을 조회합니다.",
    payload_example: "{}",
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_saved_pipelines(
    service: State<'_, Arc<PipelineLibraryService>>,
) -> Result<ApiResponse<Vec<SavedPipeline>>, String> {
    get_saved_pipelines_svc(&service)
}

pub fn get_saved_pipelines_svc(service: &Arc<PipelineLibraryService>) -> Result<ApiResponse<Vec<SavedPipeline>>, String> {
    let list = service.get_all();
    Ok(ApiResponse {
        message: format!("{} pipelines", list.len()),
        success: true,
        data: list,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetSavedPipelinePayload {
    pub id: String,
}

pub const GET_SAVED_PIPELINE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_saved_pipeline",
    description: "ID로 저장된 파이프라인을 조회합니다.",
    payload_example: r#"{"id": "pipeline_uuid"}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_saved_pipeline(
    payload: GetSavedPipelinePayload,
    service: State<'_, Arc<PipelineLibraryService>>,
) -> Result<ApiResponse<Option<SavedPipeline>>, String> {
    get_saved_pipeline_svc(payload, &service)
}

pub fn get_saved_pipeline_svc(payload: GetSavedPipelinePayload, service: &Arc<PipelineLibraryService>) -> Result<ApiResponse<Option<SavedPipeline>>, String> {
    let item = service.get_by_id(&payload.id);
    Ok(ApiResponse {
        message: if item.is_some() {
            "OK".to_string()
        } else {
            "Not found".to_string()
        },
        success: true,
        data: item,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateSavedPipelinePayload {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub flow: SavedPipelineFlow,
}

pub const CREATE_SAVED_PIPELINE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "create_saved_pipeline",
    description: "파이프라인 라이브러리에 새 항목을 저장합니다.",
    payload_example: r#"{"name": "My Pipeline", "description": "", "flow": {"nodes": [], "edges": []}}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn create_saved_pipeline(
    payload: CreateSavedPipelinePayload,
    service: State<'_, Arc<PipelineLibraryService>>,
) -> Result<ApiResponse<SavedPipeline>, String> {
    create_saved_pipeline_svc(payload, &service)
}

pub fn create_saved_pipeline_svc(payload: CreateSavedPipelinePayload, service: &Arc<PipelineLibraryService>) -> Result<ApiResponse<SavedPipeline>, String> {
    let item = service.create(payload.name, payload.description, payload.flow);
    Ok(ApiResponse {
        message: "Created".to_string(),
        success: true,
        data: item,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSavedPipelinePayload {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub flow: Option<SavedPipelineFlow>,
}

pub const UPDATE_SAVED_PIPELINE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "update_saved_pipeline",
    description: "저장된 파이프라인을 수정합니다.",
    payload_example: r#"{"id": "pipeline_uuid", "name": "Renamed", "description": null, "flow": null}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn update_saved_pipeline(
    payload: UpdateSavedPipelinePayload,
    service: State<'_, Arc<PipelineLibraryService>>,
) -> Result<ApiResponse<Option<SavedPipeline>>, String> {
    update_saved_pipeline_svc(payload, &service)
}

pub fn update_saved_pipeline_svc(payload: UpdateSavedPipelinePayload, service: &Arc<PipelineLibraryService>) -> Result<ApiResponse<Option<SavedPipeline>>, String> {
    let item = service.update(payload.id, payload.name, payload.description, payload.flow);
    Ok(ApiResponse {
        message: if item.is_some() {
            "Updated".to_string()
        } else {
            "Not found".to_string()
        },
        success: item.is_some(),
        data: item,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSavedPipelinePayload {
    pub id: String,
}

pub const DELETE_SAVED_PIPELINE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "delete_saved_pipeline",
    description: "저장된 파이프라인을 삭제합니다.",
    payload_example: r#"{"id": "pipeline_uuid"}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn delete_saved_pipeline(
    payload: DeleteSavedPipelinePayload,
    service: State<'_, Arc<PipelineLibraryService>>,
) -> Result<ApiResponse<bool>, String> {
    delete_saved_pipeline_svc(payload, &service)
}

pub fn delete_saved_pipeline_svc(payload: DeleteSavedPipelinePayload, service: &Arc<PipelineLibraryService>) -> Result<ApiResponse<bool>, String> {
    let ok = service.delete(&payload.id);
    Ok(ApiResponse {
        message: if ok {
            "Deleted".to_string()
        } else {
            "Not found".to_string()
        },
        success: ok,
        data: ok,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportSavedPipelinesPayload {
    pub pipelines: Vec<SavedPipeline>,
}

pub const IMPORT_SAVED_PIPELINES_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "import_saved_pipelines",
    description: "파이프라인 라이브러리를 일괄 교체 임포트합니다 (마이그레이션용).",
    payload_example: r#"{"pipelines": []}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn import_saved_pipelines(
    payload: ImportSavedPipelinesPayload,
    service: State<'_, Arc<PipelineLibraryService>>,
) -> Result<ApiResponse<Vec<SavedPipeline>>, String> {
    import_saved_pipelines_svc(payload, &service)
}

pub fn import_saved_pipelines_svc(payload: ImportSavedPipelinesPayload, service: &Arc<PipelineLibraryService>) -> Result<ApiResponse<Vec<SavedPipeline>>, String> {
    service.replace_all(payload.pipelines);
    let list = service.get_all();
    Ok(ApiResponse {
        message: format!("Imported {} pipelines", list.len()),
        success: true,
        data: list,
    })
}
