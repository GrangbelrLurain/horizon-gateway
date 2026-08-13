use crate::model::api_response::ApiResponse;

pub const OPEN_WINDOW_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "open_window",
    description: "[GUI] 윈도우를 엽니다.",
    payload_example: "{}",
    category: "window",
    gui_only: true,
};

pub const OPEN_INSPECTOR_WINDOW_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "open_inspector_window",
    description: "[GUI] 인스펙터 윈도우를 엽니다.",
    payload_example: "{}",
    category: "window",
    gui_only: true,
};

pub const OPEN_ANNOTATION_DIALOG_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "open_annotation_dialog",
    description: "[GUI] 주석 다이얼로그를 엽니다.",
    payload_example: "{}",
    category: "window",
    gui_only: true,
};

pub async fn open_window_svc(_app: Option<()>, _label: String, _title: String, _url: String, _width: f64, _height: f64) -> Result<ApiResponse<String>, String> {
    Err("gui_only: open_window requires GUI shell".into())
}

pub async fn open_inspector_window_svc(_app: Option<()>, _url: String, _script: Option<String>) -> Result<(), String> {
    Err("gui_only: open_inspector_window requires GUI shell".into())
}

pub async fn open_annotation_dialog_svc(_app: Option<()>, _selector: String, _content: String, _tag_name: String, _thumbnail: String, _x: f64, _y: f64) -> Result<(), String> {
    Err("gui_only: open_annotation_dialog requires GUI shell".into())
}

pub async fn open_external_url_svc(_app: Option<()>, _url: String) -> Result<(), String> {
    Err("gui_only: open_external_url requires GUI shell".into())
}
