use crate::model::api_response::ApiResponse;
use crate::service::pipeline_runner::{PipelineRunner, PipelineFlow, PipelineExecutionReport};

#[tauri::command]
#[specta::specta]
pub async fn execute_pipeline(
    payload: PipelineFlow,
) -> Result<ApiResponse<PipelineExecutionReport>, String> {
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

#[tauri::command]
#[specta::specta]
pub async fn execute_pipeline_api_node(
    config_json: String,
) -> Result<ApiResponse<String>, String> {
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
