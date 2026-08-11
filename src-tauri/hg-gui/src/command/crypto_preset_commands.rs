use crate::model::api_response::ApiResponse;
use crate::model::saved_crypto_preset::SavedCryptoPreset;
use crate::service::crypto_preset_service::CryptoPresetService;
use std::sync::Arc;
use tauri::State;

pub const GET_CRYPTO_PRESETS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_crypto_presets",
    description: "Crypto 프리셋 목록을 조회합니다.",
    payload_example: "{}",
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_crypto_presets(
    service: State<'_, Arc<CryptoPresetService>>,
) -> Result<ApiResponse<Vec<SavedCryptoPreset>>, String> {
    get_crypto_presets_svc(&service)
}

pub fn get_crypto_presets_svc(service: &Arc<CryptoPresetService>) -> Result<ApiResponse<Vec<SavedCryptoPreset>>, String> {
    let list = service.get_all();
    Ok(ApiResponse {
        message: format!("{} presets", list.len()),
        success: true,
        data: list,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetCryptoPresetPayload {
    pub id: String,
}

pub const GET_CRYPTO_PRESET_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_crypto_preset",
    description: "ID로 Crypto 프리셋을 조회합니다.",
    payload_example: r#"{"id": "preset-uuid"}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_crypto_preset(
    payload: GetCryptoPresetPayload,
    service: State<'_, Arc<CryptoPresetService>>,
) -> Result<ApiResponse<Option<SavedCryptoPreset>>, String> {
    get_crypto_preset_svc(payload, &service)
}

pub fn get_crypto_preset_svc(payload: GetCryptoPresetPayload, service: &Arc<CryptoPresetService>) -> Result<ApiResponse<Option<SavedCryptoPreset>>, String> {
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
pub struct CreateCryptoPresetPayload {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub action: String,
    #[serde(default)]
    pub payload: String,
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub iv: String,
    pub code: Option<String>,
}

pub const CREATE_CRYPTO_PRESET_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "create_crypto_preset",
    description: "Crypto 프리셋을 추가합니다.",
    payload_example: r#"{"name": "Base64 Encode", "description": "", "action": "base64Encode", "payload": "hello", "key": "", "iv": "", "code": null}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn create_crypto_preset(
    payload: CreateCryptoPresetPayload,
    service: State<'_, Arc<CryptoPresetService>>,
) -> Result<ApiResponse<SavedCryptoPreset>, String> {
    create_crypto_preset_svc(payload, &service)
}

pub fn create_crypto_preset_svc(payload: CreateCryptoPresetPayload, service: &Arc<CryptoPresetService>) -> Result<ApiResponse<SavedCryptoPreset>, String> {
    let item = service.create(
        payload.name,
        payload.description,
        payload.action,
        payload.payload,
        payload.key,
        payload.iv,
        payload.code,
    );
    Ok(ApiResponse {
        message: "Created".to_string(),
        success: true,
        data: item,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCryptoPresetPayload {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub action: Option<String>,
    pub payload: Option<String>,
    pub key: Option<String>,
    pub iv: Option<String>,
    /// Nested Option: omit = no change; null = clear code; string = set
    #[serde(default)]
    pub code: Option<Option<String>>,
}

pub const UPDATE_CRYPTO_PRESET_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "update_crypto_preset",
    description: "Crypto 프리셋을 수정합니다.",
    payload_example: r#"{"id": "preset-uuid", "name": "Renamed", "description": null, "action": null, "payload": null, "key": null, "iv": null, "code": null}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn update_crypto_preset(
    payload: UpdateCryptoPresetPayload,
    service: State<'_, Arc<CryptoPresetService>>,
) -> Result<ApiResponse<Option<SavedCryptoPreset>>, String> {
    update_crypto_preset_svc(payload, &service)
}

pub fn update_crypto_preset_svc(payload: UpdateCryptoPresetPayload, service: &Arc<CryptoPresetService>) -> Result<ApiResponse<Option<SavedCryptoPreset>>, String> {
    let item = service.update(
        payload.id,
        payload.name,
        payload.description,
        payload.action,
        payload.payload,
        payload.key,
        payload.iv,
        payload.code,
    );
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
pub struct DeleteCryptoPresetPayload {
    pub id: String,
}

pub const DELETE_CRYPTO_PRESET_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "delete_crypto_preset",
    description: "Crypto 프리셋을 삭제합니다.",
    payload_example: r#"{"id": "preset-uuid"}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn delete_crypto_preset(
    payload: DeleteCryptoPresetPayload,
    service: State<'_, Arc<CryptoPresetService>>,
) -> Result<ApiResponse<bool>, String> {
    delete_crypto_preset_svc(payload, &service)
}

pub fn delete_crypto_preset_svc(payload: DeleteCryptoPresetPayload, service: &Arc<CryptoPresetService>) -> Result<ApiResponse<bool>, String> {
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
pub struct ImportCryptoPresetsPayload {
    pub presets: Vec<SavedCryptoPreset>,
}

pub const IMPORT_CRYPTO_PRESETS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "import_crypto_presets",
    description: "Crypto 프리셋 목록을 일괄 교체 임포트합니다 (마이그레이션용).",
    payload_example: r#"{"presets": []}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn import_crypto_presets(
    payload: ImportCryptoPresetsPayload,
    service: State<'_, Arc<CryptoPresetService>>,
) -> Result<ApiResponse<Vec<SavedCryptoPreset>>, String> {
    import_crypto_presets_svc(payload, &service)
}

pub fn import_crypto_presets_svc(payload: ImportCryptoPresetsPayload, service: &Arc<CryptoPresetService>) -> Result<ApiResponse<Vec<SavedCryptoPreset>>, String> {
    service.replace_all(payload.presets);
    let list = service.get_all();
    Ok(ApiResponse {
        message: format!("Imported {} presets", list.len()),
        success: true,
        data: list,
    })
}
