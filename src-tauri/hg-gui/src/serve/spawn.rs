use std::path::{Path, PathBuf};

/// Resolve `horizon-gateway-serve.exe` next to the running binary (dev + release layouts).
pub fn serve_exe_path() -> Result<PathBuf, String> {
    let mut candidates = Vec::new();

    if let Ok(current) = std::env::current_exe() {
        if let Some(dir) = current.parent() {
            push_serve_candidates(&mut candidates, dir);
            // `cargo run` / test binaries live under target/debug/deps/
            if dir.ends_with("deps") {
                if let Some(debug) = dir.parent() {
                    push_serve_candidates(&mut candidates, debug);
                }
            }
        }
    }

    // Workspace target dir when invoked from hg-gui crate paths during dev.
    let workspace_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("target");
    push_serve_candidates(&mut candidates, &workspace_root.join("debug"));
    push_serve_candidates(&mut candidates, &workspace_root.join("release"));

    // Tauri externalBin staging (local `tauri build` / CI).
    let sidecar_staging = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
    if sidecar_staging.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&sidecar_staging) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .is_some_and(|n| n.starts_with("horizon-gateway-serve"))
                {
                    candidates.push(path);
                }
            }
        }
    }

    for path in candidates {
        if path.is_file() {
            return Ok(path);
        }
    }

    Err(
        "horizon-gateway-serve not found (build with `cargo build -p horizon-gateway-serve`)"
            .to_string(),
    )
}

fn push_serve_candidates(out: &mut Vec<PathBuf>, dir: &Path) {
    out.push(dir.join("horizon-gateway-serve.exe"));
    out.push(dir.join("horizon-gateway-serve"));
}

/// Spawn the serve backend detached. On Windows uses `runas` so UAC is shown.
pub fn spawn_detached() -> Result<(), String> {
    let exe = serve_exe_path()?;
    #[cfg(windows)]
    {
        spawn_elevated_windows(&exe)
    }
    #[cfg(not(windows))]
    {
        use std::process::{Command, Stdio};
        Command::new(exe)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("failed to spawn horizon-gateway-serve: {e}"))?;
        Ok(())
    }
}

#[cfg(windows)]
#[allow(unsafe_code)]
fn spawn_elevated_windows(exe: &Path) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    fn wide(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(std::iter::once(0)).collect()
    }

    let exe_wide = wide(exe.as_os_str());
    let verb = wide(OsStr::new("runas"));
    let work_dir = exe.parent().map(|p| wide(p.as_os_str()));

    let result = unsafe {
        windows_sys::Win32::UI::Shell::ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            exe_wide.as_ptr(),
            std::ptr::null(),
            work_dir
                .as_ref()
                .map_or(std::ptr::null(), |p| p.as_ptr()),
            windows_sys::Win32::UI::WindowsAndMessaging::SW_HIDE,
        )
    };

    // ShellExecuteW returns > 32 on success.
    if result as isize <= 32 {
        let code = result as i32;
        let hint = if code == 1223 {
            " (UAC prompt was cancelled)"
        } else if code == 740 {
            " (elevation required — retry and approve UAC)"
        } else {
            ""
        };
        return Err(format!(
            "failed to elevate horizon-gateway-serve via UAC (ShellExecute={code}){hint}"
        ));
    }

    Ok(())
}
