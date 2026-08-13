use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
#[cfg(windows)]
use tauri::webview::ScrollBarStyle;

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
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title(title)
        .inner_size(width, height)
        .decorations(false);

    #[cfg(windows)]
    {
        builder = builder.scroll_bar_style(ScrollBarStyle::FluentOverlay);
    }

    let _window = builder
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn open_inspector_window(
    app: AppHandle,
    url: String,
    script: Option<String>,
) -> Result<(), String> {
    let label = "inspector";

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

#[tauri::command]
#[specta::specta]
pub async fn open_annotation_dialog(
    app: AppHandle,
    selector: String,
    content: String,
    tag_name: String,
    thumbnail: String,
) -> Result<(), String> {
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
