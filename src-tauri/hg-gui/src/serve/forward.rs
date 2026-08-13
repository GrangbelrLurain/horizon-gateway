/// GUI-only commands: intercepted by the Tauri specta handler, NOT forwarded to serve.
/// All other commands are always forwarded to hg-serve via TCP IPC.
const GUI_ONLY_COMMANDS: &[&str] = &[
    "open_window",
    "open_inspector_window",
    "open_annotation_dialog",
    "open_external_url",
    "plugin:updater|check",
    "plugin:updater|download_and_install",
];

/// Returns true if this command must run in-process (needs Tauri AppHandle / WebView).
pub fn is_gui_only(command: &str) -> bool {
    GUI_ONLY_COMMANDS.contains(&command)
}

/// Returns true if this command should be forwarded to hg-serve.
pub fn should_forward(command: &str) -> bool {
    !is_gui_only(command)
}
