use std::future::Future;

use tauri::AppHandle;

use super::AppContext;

pub enum CliRuntime<'a> {
    Tokio(&'a tokio::runtime::Runtime),
    Tauri,
}

impl CliRuntime<'_> {
    pub fn block_on<F>(&self, future: F) -> F::Output
    where
        F: Future,
    {
        match self {
            Self::Tokio(rt) => rt.block_on(future),
            Self::Tauri => tauri::async_runtime::block_on(future),
        }
    }
}

pub struct CommandEnv<'a> {
    pub ctx: Option<&'a AppContext>,
    pub app_handle: Option<&'a AppHandle>,
    pub runtime: CliRuntime<'a>,
}

impl CommandEnv<'_> {
    pub fn require_gui(&self, command: &str) -> Result<(), String> {
        if self.app_handle.is_some() {
            Ok(())
        } else {
            Err(format!(
                "gui_only: `{command}` requires the Horizon Gateway GUI (native dialog/window). Use the desktop app or export data via other CLI commands."
            ))
        }
    }

    pub fn require_ctx(&self) -> Result<&AppContext, String> {
        self.ctx
            .ok_or_else(|| "internal error: headless AppContext is missing".to_string())
    }
}
