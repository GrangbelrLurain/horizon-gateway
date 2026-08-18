use crate::model::api_log::ApiLogEntry;
use crate::model::api_response::ApiResponse;
use crate::model::domain_api_logging_link::DomainApiLoggingLink;
use crate::service::api_log_service::ApiLogService;
use crate::service::api_logging_settings_service::ApiLoggingSettingsService;
use crate::service::domain_service::DomainService;
use std::collections::HashMap;
use std::path::PathBuf;

pub const GET_DOMAIN_API_LOGGING_LINKS_CLI_INFO: crate::cli::CliCommandInfo =
    crate::cli::CliCommandInfo {
        name: "get_domain_api_logging_links",
        description: "도메인별 API 로깅 설정 링크 목록을 조회합니다.",
        payload_example: "{}",
        category: "api",
        gui_only: false,
    };

/// 모든 도메인 API 로깅 링크 조회.

pub fn get_domain_api_logging_links_svc(
    api_logging_service: &ApiLoggingSettingsService,
) -> Result<ApiResponse<Vec<DomainApiLoggingLink>>, String> {
    let links = api_logging_service.get_links();
    Ok(ApiResponse {
        message: format!("{}개 로깅 링크 조회", links.len()),
        success: true,
        data: links,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SetDomainApiLoggingPayload {
    #[serde(default)]
    pub domain_id: Option<u32>,
    #[serde(default)]
    pub domain_ids: Option<Vec<u32>>,
    pub logging_enabled: bool,
    pub body_enabled: bool,
    pub schema_url: Option<String>,
}

pub const SET_DOMAIN_API_LOGGING_CLI_INFO: crate::cli::CliCommandInfo =
    crate::cli::CliCommandInfo {
        name: "set_domain_api_logging",
        description:
            "도메인 API 로깅 설정을 추가하거나 변경합니다 (단일 domainId 또는 domainIds 배열).",
        payload_example: r#"{"domainId": 1, "loggingEnabled": true, "bodyEnabled": false, "schemaUrl": null}"#,
        category: "api",
        gui_only: false,
    };

/// 도메인 API 로깅 설정 추가/변경.

pub fn set_domain_api_logging_svc(
    payload: SetDomainApiLoggingPayload,
    api_logging_service: &ApiLoggingSettingsService,
    domain_service: &DomainService,
) -> Result<ApiResponse<Vec<DomainApiLoggingLink>>, String> {
    let all_domains = domain_service.get_all();
    let domain_ids: Vec<u32> = if let Some(ids) = payload.domain_ids {
        ids
    } else if let Some(id) = payload.domain_id {
        vec![id]
    } else {
        Vec::new()
    };
    let links = api_logging_service.set_links_bulk(
        &domain_ids,
        payload.logging_enabled,
        payload.body_enabled,
        payload.schema_url,
        &all_domains,
    );
    Ok(ApiResponse {
        message: "로깅 설정 업데이트 완료".to_string(),
        success: true,
        data: links,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoveDomainApiLoggingPayload {
    #[serde(default)]
    pub domain_id: Option<u32>,
    #[serde(default)]
    pub domain_ids: Option<Vec<u32>>,
}

pub const REMOVE_DOMAIN_API_LOGGING_CLI_INFO: crate::cli::CliCommandInfo =
    crate::cli::CliCommandInfo {
        name: "remove_domain_api_logging",
        description: "도메인 API 로깅 설정을 제거합니다 (단일 domainId 또는 domainIds 배열).",
        payload_example: r#"{"domainId": 1}"#,
        category: "api",
        gui_only: false,
    };

/// 도메인 API 로깅 설정 제거.

pub fn remove_domain_api_logging_svc(
    payload: RemoveDomainApiLoggingPayload,
    api_logging_service: &ApiLoggingSettingsService,
    domain_service: &DomainService,
) -> Result<ApiResponse<Vec<DomainApiLoggingLink>>, String> {
    let all_domains = domain_service.get_all();
    let domain_ids: Vec<u32> = if let Some(ids) = payload.domain_ids {
        ids
    } else if let Some(id) = payload.domain_id {
        vec![id]
    } else {
        Vec::new()
    };
    let id_set: std::collections::HashSet<u32> = domain_ids.into_iter().collect();
    api_logging_service.remove_links_for_domains(&id_set, &all_domains);
    let links = api_logging_service.get_links();
    Ok(ApiResponse {
        message: "로깅 설정 제거 완료".to_string(),
        success: true,
        data: links,
    })
}

// ─── Schema download ────────────────────────────────────────────────────────

/// Schema 파일 저장 경로: `{app_data_dir}/schemas/{domain_id}.json`
fn schemas_dir_from_app(app: ()) -> PathBuf {
    let base = crate::runtime::paths::resolve_app_data_dir();
    schemas_dir(&crate::runtime::paths::resolve_app_data_dir().unwrap_or_default())
}

fn schemas_dir(base: &std::path::Path) -> PathBuf {
    base.join("schemas")
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DownloadApiSchemaPayload {
    pub domain_id: u32,
    /// URL to fetch OpenAPI/Swagger schema from.
    pub url: String,
}

/// Schema 다운로드 응답: 저장된 파일 내용(텍스트) 반환.
#[derive(serde::Serialize, Clone, Debug, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SchemaDownloadResult {
    pub domain_id: u32,
    pub path: String,
    #[specta(type = f64)]
    pub size_bytes: usize,
    /// 처음 N 글자 미리보기 (최대 500자).
    pub preview: String,
}

pub const DOWNLOAD_API_SCHEMA_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "download_api_schema",
    description: "Schema URL에서 OpenAPI/Swagger 스키마를 다운로드하여 로컬에 저장합니다.",
    payload_example: r#"{"domainId": 1, "url": "https://api.example.com/openapi.json"}"#,
    category: "api",
    gui_only: false,
};

/// Schema URL에서 JSON/YAML을 다운로드하여 로컬 저장.

pub async fn download_api_schema_svc(
    payload: DownloadApiSchemaPayload,
    schemas_base: &std::path::Path,
) -> Result<ApiResponse<SchemaDownloadResult>, String> {
    let url = payload.url.trim().to_string();
    if url.is_empty() {
        return Ok(ApiResponse {
            message: "URL이 비어 있습니다.".to_string(),
            success: false,
            data: SchemaDownloadResult {
                domain_id: payload.domain_id,
                path: String::new(),
                size_bytes: 0,
                preview: String::new(),
            },
        });
    }

    // Fetch
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Fetch 실패: {e}"))?;
    if !resp.status().is_success() {
        return Ok(ApiResponse {
            message: format!("HTTP {} — {}", resp.status().as_u16(), url),
            success: false,
            data: SchemaDownloadResult {
                domain_id: payload.domain_id,
                path: String::new(),
                size_bytes: 0,
                preview: String::new(),
            },
        });
    }
    let body = resp
        .text()
        .await
        .map_err(|e| format!("응답 읽기 실패: {e}"))?;

    // Save
    let dir = schemas_dir(schemas_base);
    std::fs::create_dir_all(&dir).map_err(|e| format!("디렉토리 생성 실패: {e}"))?;
    let file_path = dir.join(format!("{}.json", payload.domain_id));
    std::fs::write(&file_path, &body).map_err(|e| format!("파일 저장 실패: {e}"))?;

    let preview = body.chars().take(500).collect::<String>();
    Ok(ApiResponse {
        message: format!("Schema 다운로드 완료 ({} bytes)", body.len()),
        success: true,
        data: SchemaDownloadResult {
            domain_id: payload.domain_id,
            path: file_path.to_string_lossy().to_string(),
            size_bytes: body.len(),
            preview,
        },
    })
}

pub const GET_API_SCHEMA_CONTENT_CLI_INFO: crate::cli::CliCommandInfo =
    crate::cli::CliCommandInfo {
        name: "get_api_schema_content",
        description: "로컬에 저장된 API Schema 파일의 내용을 조회합니다.",
        payload_example: r#"{"domainId": 1}"#,
        category: "api",
        gui_only: false,
    };

/// 로컬에 저장된 Schema 내용 조회.

pub fn get_api_schema_content_svc(
    payload: GetApiSchemaPayload,
    schemas_base: &std::path::Path,
) -> Result<ApiResponse<Option<String>>, String> {
    let file_path = schemas_dir(schemas_base).join(format!("{}.json", payload.domain_id));
    if file_path.exists() {
        let content =
            std::fs::read_to_string(&file_path).map_err(|e| format!("파일 읽기 실패: {e}"))?;
        Ok(ApiResponse {
            message: "Schema 조회 완료".to_string(),
            success: true,
            data: Some(content),
        })
    } else {
        Ok(ApiResponse {
            message: "저장된 Schema가 없습니다.".to_string(),
            success: true,
            data: None,
        })
    }
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetApiSchemaPayload {
    pub domain_id: u32,
}

// ─── Send API request (Try-it-out) ──────────────────────────────────────────

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SendApiRequestPayload {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(serde::Serialize, Clone, Debug, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequestResult {
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    #[specta(type = f64)]
    pub elapsed_ms: u64,
}

/// 에러 시 빈 결과를 반환하는 헬퍼.
fn empty_request_result() -> ApiRequestResult {
    ApiRequestResult {
        status_code: 0,
        headers: HashMap::new(),
        body: String::new(),
        elapsed_ms: 0,
    }
}

pub const SEND_API_REQUEST_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "send_api_request",
    description: "임의의 HTTP 요청을 전송하고 응답을 반환합니다 (Schema Try-it-out).",
    payload_example: r#"{"method": "GET", "url": "https://api.example.com/users", "headers": {}, "body": null}"#,
    category: "api",
    gui_only: false,
};

/// 임의의 HTTP 요청을 전송하고 응답을 반환 (Schema Try-it-out).
/// 네트워크 에러도 `ApiResponse로` 감싸서 반환 (Tauri invoke 예외 대신 FE에서 처리 가능).

pub async fn send_api_request_svc(
    payload: SendApiRequestPayload,
) -> Result<ApiResponse<ApiRequestResult>, String> {
    use std::time::Instant;

    let method: reqwest::Method = match payload.method.to_uppercase().parse() {
        Ok(m) => m,
        Err(_) => {
            return Ok(ApiResponse {
                message: format!("잘못된 HTTP 메서드: {}", payload.method),
                success: false,
                data: empty_request_result(),
            });
        }
    };

    let proxy_port = crate::command::local_route_commands::get_proxy_port();
    let mut client_builder = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(10));

    if proxy_port > 0 {
        if let Ok(proxy) = reqwest::Proxy::all(format!("http://127.0.0.1:{proxy_port}")) {
            client_builder = client_builder.proxy(proxy);
        }
    }

    let client = match client_builder.build() {
        Ok(c) => c,
        Err(e) => {
            return Ok(ApiResponse {
                message: format!("HTTP 클라이언트 생성 실패: {e}"),
                success: false,
                data: empty_request_result(),
            });
        }
    };

    let mut builder = client.request(method, &payload.url);

    for (key, value) in &payload.headers {
        builder = builder.header(key.as_str(), value.as_str());
    }

    if let Some(body) = &payload.body {
        builder = builder.body(body.clone());
        // Content-Type이 없으면 JSON 기본 설정
        if !payload
            .headers
            .keys()
            .any(|k| k.eq_ignore_ascii_case("content-type"))
        {
            builder = builder.header("content-type", "application/json");
        }
    }

    let start = Instant::now();
    let resp = match builder.send().await {
        Ok(r) => r,
        Err(e) => {
            let elapsed = start.elapsed().as_millis() as u64;
            let detail = if e.is_timeout() {
                format!("요청 타임아웃 ({elapsed}ms): {e}")
            } else if e.is_connect() {
                format!("연결 실패: {e}")
            } else if e.is_redirect() {
                format!("리다이렉트 오류: {e}")
            } else {
                format!("요청 전송 실패: {e}")
            };
            return Ok(ApiResponse {
                message: detail,
                success: false,
                data: ApiRequestResult {
                    status_code: 0,
                    headers: HashMap::new(),
                    body: String::new(),
                    elapsed_ms: elapsed,
                },
            });
        }
    };
    let elapsed = start.elapsed().as_millis() as u64;

    let status_code = resp.status().as_u16();
    let resp_headers: HashMap<String, String> = resp
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let resp_body = match resp.text().await {
        Ok(b) => b,
        Err(e) => {
            return Ok(ApiResponse {
                message: format!("응답 읽기 실패: {e}"),
                success: false,
                data: ApiRequestResult {
                    status_code,
                    headers: resp_headers,
                    body: String::new(),
                    elapsed_ms: elapsed,
                },
            });
        }
    };

    Ok(ApiResponse {
        message: format!("HTTP {status_code} ({elapsed}ms)"),
        success: (200..300).contains(&(status_code as usize)),
        data: ApiRequestResult {
            status_code,
            headers: resp_headers,
            body: resp_body,
            elapsed_ms: elapsed,
        },
    })
}

// ─── API Log Commands ───────────────────────────────────────────────────────

pub const LIST_API_LOG_DATES_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "list_api_log_dates",
    description: "API 로그가 존재하는 날짜 목록을 조회합니다 (YYYY-MM-DD 형식).",
    payload_example: "{}",
    category: "api",
    gui_only: false,
};

/// API 로그 날짜 목록 조회. (YYYY-MM-DD)

pub fn list_api_log_dates_svc(
    api_log_service: &ApiLogService,
) -> Result<ApiResponse<Vec<String>>, String> {
    let dates = api_log_service.list_dates();
    Ok(ApiResponse {
        message: format!("{}개 날짜 조회", dates.len()),
        success: true,
        data: dates,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetApiLogsPayload {
    pub date: String,
    pub domain_filter: Option<String>,
    pub method_filter: Option<String>,
    pub host_filter: Option<String>,
    pub exact_match: Option<bool>,
}

pub const GET_API_LOGS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_api_logs",
    description: "API 로그 목록을 조회합니다.",
    payload_example: r#"{"date": "2026-07-06", "domainFilter": null, "methodFilter": null, "hostFilter": null, "exactMatch": null}"#,
    category: "api",
    gui_only: false,
};

/// 특정 날짜의 API 로그 조회.

pub fn get_api_logs_svc(
    payload: GetApiLogsPayload,
    api_log_service: &ApiLogService,
) -> Result<ApiResponse<Vec<ApiLogEntry>>, String> {
    let logs = api_log_service.get_logs(
        &payload.date,
        payload.domain_filter,
        payload.method_filter,
        payload.host_filter,
        payload.exact_match.unwrap_or(false),
    );
    Ok(ApiResponse {
        message: format!("{}개 로그 조회", logs.len()),
        success: true,
        data: logs,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GetApiLogDetailPayload {
    pub id: String,
    pub date: Option<String>,
}

pub const GET_API_LOG_DETAIL_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "get_api_log_detail",
    description: "API 로그 단건 상세(본문 포함)를 조회합니다.",
    payload_example: r#"{"id": "log-uuid", "date": "2026-07-06"}"#,
    category: "api",
    gui_only: false,
};

pub fn get_api_log_detail_svc(
    payload: GetApiLogDetailPayload,
    api_log_service: &ApiLogService,
) -> Result<ApiResponse<Option<ApiLogEntry>>, String> {
    let log = api_log_service.get_log_by_id(&payload.id, payload.date.as_deref());
    Ok(ApiResponse {
        message: if log.is_some() {
            "로그 상세 조회".to_string()
        } else {
            "로그를 찾을 수 없습니다.".to_string()
        },
        success: true,
        data: log,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SearchApiLogsPayload {
    pub date: String,
    pub query: Option<String>,
    pub host_filter: Option<String>,
    pub method_filter: Option<String>,
    pub status_filter: Option<u16>,
    /// Structured JSON leaf key (adaptive index). When set and unlearned, triggers body scan.
    pub param_key: Option<String>,
    pub param_value: Option<String>,
    pub limit: Option<u32>,
}

pub const SEARCH_API_LOGS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "search_api_logs",
    description:
        "API 로그 body를 FTS/파라미터 인덱스로 검색합니다. 미학습 파라미터는 스캔 후 학습합니다.",
    payload_example: r#"{"date":"2026-07-06","query":"E001","hostFilter":null,"methodFilter":null,"statusFilter":null,"paramKey":null,"paramValue":null,"limit":50}"#,
    category: "api",
    gui_only: false,
};

pub fn search_api_logs_svc(
    payload: SearchApiLogsPayload,
    app: Option<()>,
    api_log_service: &ApiLogService,
) -> Result<ApiResponse<Vec<crate::model::api_log::ApiLogSearchHit>>, String> {
    let limit = payload.limit.unwrap_or(50) as usize;
    let query = payload.query.unwrap_or_default();
    let param_key = payload.param_key.filter(|s| !s.trim().is_empty());
    let param_value = payload.param_value.unwrap_or_default();

    let emit_hit = |hit: &crate::model::api_log::ApiLogSearchHit| {
        if let Some(app) = app {
            crate::serve::events::publish_event("api-log-search-hit", hit.clone());
        }
    };

    let hits = if let Some(key) = param_key.as_deref() {
        if api_log_service.is_param_indexed(key) {
            let hits = api_log_service.search_logs(
                &payload.date,
                "",
                payload.host_filter.as_deref(),
                payload.method_filter.as_deref(),
                payload.status_filter,
                Some(key),
                Some(&param_value),
                limit,
            )?;
            for hit in &hits {
                emit_hit(hit);
            }
            hits
        } else {
            api_log_service.scan_bodies_for_param(
                &payload.date,
                key,
                &param_value,
                payload.host_filter.as_deref(),
                payload.method_filter.as_deref(),
                payload.status_filter,
                limit,
                |hit| emit_hit(&hit),
            )
        }
    } else {
        let hits = api_log_service.search_logs(
            &payload.date,
            &query,
            payload.host_filter.as_deref(),
            payload.method_filter.as_deref(),
            payload.status_filter,
            None,
            None,
            limit,
        )?;
        for hit in &hits {
            emit_hit(hit);
        }
        hits
    };

    if let Some(app) = app {
        crate::serve::events::publish_event(
            "api-log-search-done",
            serde_json::json!({
                "date": payload.date,
                "count": hits.len(),
            }),
        );
    }

    Ok(ApiResponse {
        message: format!("{}개 검색 결과", hits.len()),
        success: true,
        data: hits,
    })
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ClearApiLogsPayload {
    pub date: Option<String>,
}

pub const CLEAR_API_LOGS_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "clear_api_logs",
    description: "API 로그를 삭제합니다.",
    payload_example: r#"{"date": "2026-07-06"}"#,
    category: "api",
    gui_only: false,
};

/// API 로그 삭제 (특정 날짜 또는 전체).

pub fn clear_api_logs_svc(
    payload: ClearApiLogsPayload,
    api_log_service: &ApiLogService,
) -> Result<ApiResponse<()>, String> {
    if let Err(e) = api_log_service.clear_logs(payload.date) {
        return Ok(ApiResponse {
            message: format!("삭제 실패: {e}"),
            success: false,
            data: (),
        });
    }
    Ok(ApiResponse {
        message: "로그 삭제 완료".to_string(),
        success: true,
        data: (),
    })
}
