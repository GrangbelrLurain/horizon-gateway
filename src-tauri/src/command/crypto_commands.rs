use crate::model::api_response::ApiResponse;
use crate::service::crypto_service::{CryptoService, CryptoAction};

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProcessCryptoPayload {
    pub action: CryptoAction,
    pub payload: String,
    pub key: Option<String>,
    pub iv: Option<String>,
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ValidateSchemaPayload {
    pub payload: String,
    pub schema: String,
}

#[derive(serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SchemaValidationResult {
    pub valid: bool,
    pub errors: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn process_crypto(
    payload: ProcessCryptoPayload,
) -> Result<ApiResponse<String>, String> {
    let service = CryptoService::new();
    match service.process_crypto(
        payload.action,
        &payload.payload,
        payload.key.as_deref(),
        payload.iv.as_deref(),
    ) {
        Ok(res) => Ok(ApiResponse {
            message: "Crypto process successful".to_string(),
            success: true,
            data: res,
        }),
        Err(e) => Ok(ApiResponse {
            message: e,
            success: false,
            data: String::new(),
        }),
    }
}

#[tauri::command]
#[specta::specta]
pub fn validate_json_schema(
    payload: ValidateSchemaPayload,
) -> Result<ApiResponse<SchemaValidationResult>, String> {
    let service = CryptoService::new();
    match service.validate_json_schema(&payload.payload, &payload.schema) {
        Ok(()) => Ok(ApiResponse {
            message: "Schema validation passed".to_string(),
            success: true,
            data: SchemaValidationResult {
                valid: true,
                errors: None,
            },
        }),
        Err(e) => Ok(ApiResponse {
            message: "Schema validation failed".to_string(),
            success: false,
            data: SchemaValidationResult {
                valid: false,
                errors: Some(e),
            },
        }),
    }
}
