use std::time::Duration;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Manager};

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "tray_show", "Open Horizon Gateway", true, None::<&str>)?;
    let restart =
        MenuItem::with_id(app, "tray_restart_serve", "Restart Backend", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray_quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &restart, &quit])?;

    let icon = app
        .default_window_icon()
        .expect("missing app window icon")
        .clone();

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .tooltip("Horizon Gateway")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray_show" => show_main_window(app),
            "tray_restart_serve" => {
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = restart_serve_backend().await {
                        tracing::warn!("[tray] restart serve failed: {e}");
                    }
                });
            }
            "tray_quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub async fn restart_serve_backend() -> Result<(), String> {
    kill_serve_process();
    crate::serve::ensure::mark_inactive();
    tokio::time::sleep(Duration::from_secs(1)).await;
    crate::serve::ensure_running()
}

fn kill_serve_process() {
    #[cfg(windows)]
    {
        use std::process::Command;
        let _ = Command::new("taskkill")
            .args(["/IM", "horizon-gateway-serve.exe", "/F"])
            .output();
    }
    #[cfg(not(windows))]
    {
        use std::process::Command;
        let _ = Command::new("pkill")
            .args(["-f", "horizon-gateway-serve"])
            .output();
    }
}
