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
