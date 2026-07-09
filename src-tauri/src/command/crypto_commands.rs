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

pub const PROCESS_CRYPTO_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "process_crypto",
    description: "대칭키 암복호화, Base64/Hex 인코딩 등의 보안 작업을 실행합니다. (action: base64Encode, base64Decode, urlEncode, urlDecode, hexEncode, hexDecode, jwtDecode, aesEncrypt, aesDecrypt, sha256, hmacSha256)",
    payload_example: r#"{"action": "base64Encode", "payload": "hello", "key": null, "iv": null}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn process_crypto(
    payload: ProcessCryptoPayload,
) -> Result<ApiResponse<String>, String> {
    process_crypto_svc(payload)
}

pub fn process_crypto_svc(payload: ProcessCryptoPayload) -> Result<ApiResponse<String>, String> {
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

pub const VALIDATE_JSON_SCHEMA_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "validate_json_schema",
    description: "JSON 문자열이 지정된 JSON 스키마를 만족하는지 검증합니다.",
    payload_example: r#"{"payload": "{\"a\": 1}", "schema": "{\"$schema\": \"http://json-schema.org/draft-07/schema#\", \"type\": \"object\"}"}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn validate_json_schema(
    payload: ValidateSchemaPayload,
) -> Result<ApiResponse<SchemaValidationResult>, String> {
    validate_json_schema_svc(payload)
}

pub fn validate_json_schema_svc(payload: ValidateSchemaPayload) -> Result<ApiResponse<SchemaValidationResult>, String> {
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
