use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
#[cfg(windows)]
use tauri::webview::ScrollBarStyle;

pub const OPEN_WINDOW_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "open_window",
    description: "[GUI] Tauri 앱 내 새 Webview 창을 엽니다.",
    payload_example: r#"{"label": "my-window", "title": "My Window", "url": "/page", "width": 800, "height": 600}"#,
    category: "window",
    gui_only: true,
};

#[tauri::command]
#[specta::specta]
pub async fn open_window(
    app: AppHandle,
    label: String,
    title: String,
    url: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    open_window_svc(Some(app.clone()), label, title, url, width, height).await
}

pub async fn open_window_svc(app: Option<tauri::AppHandle>, label: String, title: String, url: String, width: f64, height: f64) -> Result<(), String> {
    let app = app.ok_or_else(|| "GUI required".to_string())?;
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title(title)
        .inner_size(width, height)
        .decorations(false);

    // Must match main window / same WebView data dir (Windows).
    #[cfg(windows)]
    {
        builder = builder.scroll_bar_style(ScrollBarStyle::FluentOverlay);
    }

    let _window = builder
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;

    Ok(())
}

pub const OPEN_INSPECTOR_WINDOW_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "open_inspector_window",
    description: "[GUI] UI 인스펙터 외부 URL Webview 창을 엽니다.",
    payload_example: r#"{"url": "https://example.com", "script": null}"#,
    category: "window",
    gui_only: true,
};

#[tauri::command]
#[specta::specta]
pub async fn open_inspector_window(
    app: AppHandle,
    url: String,
    script: Option<String>,
) -> Result<(), String> {
    open_inspector_window_svc(Some(app.clone()), url, script).await
}

pub async fn open_inspector_window_svc(app: Option<tauri::AppHandle>, url: String, script: Option<String>) -> Result<(), String> {
    let app = app.ok_or_else(|| "GUI required".to_string())?;
    let label = "inspector";

    // Close existing inspector if any
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.close();
    }

    let parsed_url = url.parse::<tauri::Url>().map_err(|e| e.to_string())?;
    let mut builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(parsed_url))
        .title("UI Inspector")
        .inner_size(1280.0, 800.0);

    if let Some(s) = script {
        builder = builder.initialization_script(&s);
    }

    builder.build().map_err(|e: tauri::Error| e.to_string())?;

    Ok(())
}

pub const OPEN_ANNOTATION_DIALOG_CLI_INFO: crate::cli::CliCommandInfo = crate::cli::CliCommandInfo {
    name: "open_annotation_dialog",
    description: "[GUI] UI 요소에 주석을 달기 위한 대화상자를 엽니다.",
    payload_example: r#"{"selector": ".btn", "content": "<p>Hello</p>", "tagName": "button", "thumbnail": ""}"#,
    category: "window",
    gui_only: true,
};

#[tauri::command]
#[specta::specta]
pub async fn open_annotation_dialog(
    app: AppHandle,
    selector: String,
    content: String,
    tag_name: String,
    thumbnail: String,
) -> Result<(), String> {
    open_annotation_dialog_svc(Some(app.clone()), selector, content, tag_name, thumbnail).await
}

pub async fn open_annotation_dialog_svc(app: Option<tauri::AppHandle>, selector: String, content: String, tag_name: String, thumbnail: String) -> Result<(), String> {
    let app = app.ok_or_else(|| "GUI required".to_string())?;
    app.emit(
        "annotation-dialog-requested",
        serde_json::json!({
            "selector": selector,
            "content": content,
            "tagName": tag_name,
            "thumbnail": thumbnail,
        }),
    )
    .map_err(|e: tauri::Error| e.to_string())?;

    if let Some(main) = app.get_webview_window("main") {
        main.set_focus().map_err(|e: tauri::Error| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
