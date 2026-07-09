use crate::model::api_response::ApiResponse;
use crate::model::saved_json_schema::{SavedJsonSchema, SchemaProperty};
use crate::service::json_schema_registry_service::JsonSchemaRegistryService;
use std::sync::Arc;
use tauri::State;

pub const GET_JSON_SCHEMAS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_json_schemas",
    description: "JSON Schema 레지스트리 목록을 조회합니다.",
    payload_example: "{}",
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_json_schemas(
    service: State<'_, Arc<JsonSchemaRegistryService>>,
) -> Result<ApiResponse<Vec<SavedJsonSchema>>, String> {
    let list = service.get_all();
    Ok(ApiResponse {
        message: format!("{} schemas", list.len()),
        success: true,
        data: list,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetJsonSchemaPayload {
    pub id: String,
}

pub const GET_JSON_SCHEMA_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_json_schema",
    description: "ID로 JSON Schema를 조회합니다.",
    payload_example: r#"{"id": "schema-uuid"}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn get_json_schema(
    payload: GetJsonSchemaPayload,
    service: State<'_, Arc<JsonSchemaRegistryService>>,
) -> Result<ApiResponse<Option<SavedJsonSchema>>, String> {
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
pub struct CreateJsonSchemaPayload {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub properties: Vec<SchemaProperty>,
    #[serde(default)]
    pub schema_text: String,
}

pub const CREATE_JSON_SCHEMA_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "create_json_schema",
    description: "JSON Schema 레지스트리에 새 스키마를 추가합니다.",
    payload_example: r#"{"name": "UserPayload", "description": "", "properties": [], "schemaText": "{\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"type\":\"object\"}"}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn create_json_schema(
    payload: CreateJsonSchemaPayload,
    service: State<'_, Arc<JsonSchemaRegistryService>>,
) -> Result<ApiResponse<SavedJsonSchema>, String> {
    let item = service.create(
        payload.name,
        payload.description,
        payload.properties,
        payload.schema_text,
    );
    Ok(ApiResponse {
        message: "Created".to_string(),
        success: true,
        data: item,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJsonSchemaPayload {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub properties: Option<Vec<SchemaProperty>>,
    pub schema_text: Option<String>,
}

pub const UPDATE_JSON_SCHEMA_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "update_json_schema",
    description: "JSON Schema 레지스트리 항목을 수정합니다.",
    payload_example: r#"{"id": "schema-uuid", "name": "Renamed", "description": null, "properties": null, "schemaText": null}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn update_json_schema(
    payload: UpdateJsonSchemaPayload,
    service: State<'_, Arc<JsonSchemaRegistryService>>,
) -> Result<ApiResponse<Option<SavedJsonSchema>>, String> {
    let item = service.update(
        payload.id,
        payload.name,
        payload.description,
        payload.properties,
        payload.schema_text,
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
pub struct DeleteJsonSchemaPayload {
    pub id: String,
}

pub const DELETE_JSON_SCHEMA_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "delete_json_schema",
    description: "JSON Schema 레지스트리 항목을 삭제합니다.",
    payload_example: r#"{"id": "schema-uuid"}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn delete_json_schema(
    payload: DeleteJsonSchemaPayload,
    service: State<'_, Arc<JsonSchemaRegistryService>>,
) -> Result<ApiResponse<bool>, String> {
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
pub struct ImportJsonSchemasPayload {
    pub schemas: Vec<SavedJsonSchema>,
}

pub const IMPORT_JSON_SCHEMAS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "import_json_schemas",
    description: "JSON Schema 레지스트리를 일괄 교체 임포트합니다 (마이그레이션용).",
    payload_example: r#"{"schemas": []}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub fn import_json_schemas(
    payload: ImportJsonSchemasPayload,
    service: State<'_, Arc<JsonSchemaRegistryService>>,
) -> Result<ApiResponse<Vec<SavedJsonSchema>>, String> {
    service.replace_all(payload.schemas);
    let list = service.get_all();
    Ok(ApiResponse {
        message: format!("Imported {} schemas", list.len()),
        success: true,
        data: list,
    })
}
