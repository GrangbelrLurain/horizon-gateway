use crate::model::api_response::ApiResponse;
use crate::service::pipeline_runner::{PipelineRunner, PipelineFlow, PipelineExecutionReport};

pub const EXECUTE_PIPELINE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "execute_pipeline",
    description: "API 노드 체인으로 구성된 파이프라인을 실행합니다.",
    payload_example: r#"{"nodes": [], "edges": []}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub async fn execute_pipeline(
    payload: PipelineFlow,
) -> Result<ApiResponse<PipelineExecutionReport>, String> {
    execute_pipeline_svc(payload).await
}

pub async fn execute_pipeline_svc(payload: PipelineFlow) -> Result<ApiResponse<PipelineExecutionReport>, String> {
    let runner = PipelineRunner::new();
    let report = runner.run(payload).await;
    Ok(ApiResponse {
        message: if report.success { 
            "Pipeline execution completed successfully".to_string() 
        } else { 
            report.error.clone().unwrap_or_else(|| "Pipeline execution failed".to_string()) 
        },
        success: report.success,
        data: report,
    })
}

pub const EXECUTE_PIPELINE_API_NODE_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "execute_pipeline_api_node",
    description: "파이프라인 API 노드 하나를 단독으로 실행합니다.",
    payload_example: r#"{"url": "https://api.example.com/data", "method": "GET"}"#,
    category: "sandbox",
    gui_only: false,
};

#[tauri::command]
#[specta::specta]
pub async fn execute_pipeline_api_node(
    config_json: String,
) -> Result<ApiResponse<String>, String> {
    execute_pipeline_api_node_svc(config_json).await
}

pub async fn execute_pipeline_api_node_svc(config_json: String) -> Result<ApiResponse<String>, String> {
    let runner = PipelineRunner::new();
    let config: serde_json::Value = serde_json::from_str(&config_json)
        .map_err(|e| format!("Failed to parse config JSON: {}", e))?;
    let result = runner.execute_node("api", &config).await?;
    let result_str = serde_json::to_string(&result)
        .map_err(|e| format!("Failed to serialize result: {}", e))?;
    Ok(ApiResponse {
        message: "API Node executed successfully".to_string(),
        success: true,
        data: result_str,
    })
}
