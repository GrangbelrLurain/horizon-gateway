use crate::model::api_response::ApiResponse;
use crate::model::inspector::Annotation;
use crate::service::inspector_service::InspectorService;
use crate::service::local_proxy;
use tauri::State;

pub const GET_ANNOTATIONS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_annotations",
    description: "UX 인스펙터 정책(주석) 전체 목록을 조회합니다.",
    payload_example: "{}",
    category: "inspector",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
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

#[derive(serde::Deserialize, specta::Type)]
pub struct DeleteAnnotationPayload {
    pub id: String,
}

pub const ADD_ANNOTATION_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "add_annotation",
    description: "UX 인스펙터 정책(주석)을 추가합니다.",
    payload_example: r#"{"id": "uuid", "selector": ".btn", "content": "", "tagName": "button", "thumbnail": "", "role": "button", "description": "Submit button", "timestamp": 0, "domain": "", "url": ""}"#,
    category: "inspector",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
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

#[derive(serde::Deserialize, specta::Type)]
pub struct UpdateAnnotationPayload {
    pub id: String,
    pub role: String,
    pub description: String,
}

pub const UPDATE_ANNOTATION_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "update_annotation",
    description: "UX 인스펙터 정책(주석)을 수정합니다.",
    payload_example: r#"{"id": "uuid", "role": "button", "description": "Updated description"}"#,
    category: "inspector",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
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

pub const DELETE_ANNOTATION_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "delete_annotation",
    description: "UX 인스펙터 정책(주석)을 삭제합니다.",
    payload_example: r#"{"id": "uuid"}"#,
    category: "inspector",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
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

#[derive(serde::Deserialize, specta::Type)]
pub struct ImportAnnotationsPayload {
    pub annotations: Vec<Annotation>,
}

pub const IMPORT_ANNOTATIONS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "import_annotations",
    description: "UX 인스펙터 정책 목록을 일괄 임포트합니다.",
    payload_example: r#"{"annotations": [{"id": "uuid", "selector": ".btn", "content": "", "tagName": "button", "thumbnail": "", "role": "button", "description": "desc", "timestamp": 0, "domain": "", "url": ""}]}"#,
    category: "inspector",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn import_annotations(
    service: State<'_, InspectorService>,
    payload: ImportAnnotationsPayload,
) -> Result<ApiResponse<Vec<Annotation>>, String> {
    service.import_annotations(payload.annotations);
    let list = service.get_all();
    Ok(ApiResponse {
        message: "정책들을 성공적으로 가져왔습니다.".to_string(),
        success: true,
        data: list,
    })
}

pub const SET_GLOBAL_INSPECTOR_ENABLED_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "set_global_inspector_enabled",
    description: "UI 인스펙터 전역 활성화 여부를 설정합니다.",
    payload_example: "true",
    category: "inspector",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn set_global_inspector_enabled(
    service: State<'_, InspectorService>,
    payload: bool,
) -> Result<(), String> {
    service.set_enabled(payload);
    local_proxy::set_inspector_enabled(payload);
    Ok(())
}

pub const GET_GLOBAL_INSPECTOR_ENABLED_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_global_inspector_enabled",
    description: "UI 인스펙터 전역 활성화 상태를 조회합니다.",
    payload_example: "{}",
    category: "inspector",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_global_inspector_enabled() -> Result<ApiResponse<bool>, String> {
    Ok(ApiResponse {
        message: "인스펙터 상태 조회 완료".to_string(),
        success: true,
        data: local_proxy::is_inspector_enabled(),
    })
}

// ── Injection Domains ──────────────────────────────────────────────────

pub const GET_INJECTION_DOMAINS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_injection_domains",
    description: "UI 인스펙터 스크립트를 주입할 도메인 목록을 조회합니다.",
    payload_example: "{}",
    category: "inspector",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_injection_domains(
    service: State<'_, InspectorService>,
) -> Result<ApiResponse<Vec<String>>, String> {
    let list = service.get_injection_domains();
    Ok(ApiResponse {
        message: "인젝션 도메인 목록 조회 완료".to_string(),
        success: true,
        data: list,
    })
}

#[derive(serde::Deserialize, specta::Type)]
pub struct SetInjectionDomainsPayload {
    pub domains: Vec<String>,
}

pub const SET_INJECTION_DOMAINS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "set_injection_domains",
    description: "UI 인스펙터 스크립트를 주입할 도메인 목록을 설정합니다.",
    payload_example: r#"{"domains": ["example.com", "test.com"]}"#,
    category: "inspector",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn set_injection_domains(
    service: State<'_, InspectorService>,
    payload: SetInjectionDomainsPayload,
) -> Result<ApiResponse<Vec<String>>, String> {
    service.set_injection_domains(payload.domains);
    let list = service.get_injection_domains();
    Ok(ApiResponse {
        message: "인젝션 도메인 목록이 저장되었습니다.".to_string(),
        success: true,
        data: list,
    })
}
