use std::{env, fs, path::PathBuf};

fn main() {
    embed_inspector_js();
    sync_skill_md_resource();
    ensure_serve_bundle_resource();
    #[cfg(windows)]
    copy_windivert_sidecars();
    copy_serve_next_to_exe();
    build_tauri();
}

fn build_tauri() {
    #[cfg(windows)]
    {
        let windows = tauri_build::WindowsAttributes::new()
            .app_manifest(include_str!("windows-app-manifest.xml"));
        tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
            .unwrap_or_else(|e| {
                let msg = e.to_string();
                if msg.contains("os error 32") {
                    panic!(
                        "failed to run tauri build script: {msg}\n\
                         hint: stop horizon-gateway / horizon-gateway-serve (WinDivert locks target/debug) and retry"
                    );
                }
                panic!("failed to run tauri build script: {msg}");
            });
    }
    #[cfg(not(windows))]
    {
        tauri_build::build();
    }
}

/// Stage `horizon-gateway-serve.exe` for Tauri bundle resources (NSIS copies next to main exe).
fn ensure_serve_bundle_resource() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let resource_dest = manifest_dir
        .join("resources")
        .join("horizon-gateway-serve.exe");
    println!(
        "cargo:rerun-if-changed={}",
        resource_dest.display()
    );
    println!("cargo:rerun-if-changed=binaries");

    if let Some(src) = find_serve_binary(&manifest_dir) {
        let _ = fs::create_dir_all(resource_dest.parent().unwrap());
        if fs::copy(&src, &resource_dest).is_ok() {
            return;
        }
    }

    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    if profile == "release" && !resource_dest.is_file() {
        panic!(
            "horizon-gateway-serve.exe missing for release bundle.\n\
             Run `node scripts/build-serve-sidecar.mjs` before `tauri build`."
        );
    }

    if !resource_dest.is_file() {
        let _ = fs::create_dir_all(resource_dest.parent().unwrap());
        let _ = fs::write(&resource_dest, []);
        println!(
            "cargo:warning=horizon-gateway-serve.exe placeholder created (dev build); run `cargo build -p horizon-gateway-serve` for a real backend binary"
        );
    }
}

/// Copy serve next to the built GUI exe (dev runs, same layout as NSIS post-install).
fn copy_serve_next_to_exe() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let Some(src) = find_serve_binary(&manifest_dir) else {
        return;
    };

    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    let mut target_dir = manifest_dir.join("target").join(&profile);
    if let Ok(dir) = env::var("CARGO_TARGET_DIR") {
        target_dir = PathBuf::from(dir).join(&profile);
    }

    let _ = fs::create_dir_all(&target_dir);
    let dest = target_dir.join("horizon-gateway-serve.exe");
    if fs::copy(&src, &dest).is_err() {
        println!("cargo:warning=failed to copy horizon-gateway-serve.exe next to GUI exe");
    }
}

fn find_serve_binary(manifest_dir: &PathBuf) -> Option<PathBuf> {
    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    let ext = if cfg!(windows) { ".exe" } else { "" };

    let mut candidates = Vec::new();

    if let Ok(target) = env::var("TARGET") {
        candidates.push(
            manifest_dir
                .join("binaries")
                .join(format!("horizon-gateway-serve-{target}{ext}")),
        );
    }

    let workspace_target = manifest_dir.join("..").join("target").join(&profile);
    candidates.push(workspace_target.join(format!("horizon-gateway-serve{ext}")));

    if let Ok(entries) = fs::read_dir(manifest_dir.join("binaries")) {
        for entry in entries.flatten() {
            candidates.push(entry.path());
        }
    }

    for path in candidates {
        if path.is_file() && path.metadata().map(|m| m.len() > 0).unwrap_or(false) {
            return Some(path);
        }
    }
    None
}

/// Automatically sync project master SKILL.md (`.agents/skills/horizon-gateway/SKILL.md`)
/// to embedded resources (`resources/skills/horizon-gateway/SKILL.md`) at build time.
fn sync_skill_md_resource() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let source_skill = manifest_dir
        .join("..")
        .join("..")
        .join(".agents")
        .join("skills")
        .join("horizon-gateway")
        .join("SKILL.md");
    let dest_skill = manifest_dir
        .join("resources")
        .join("skills")
        .join("horizon-gateway")
        .join("SKILL.md");

    println!("cargo:rerun-if-changed={}", source_skill.display());

    if source_skill.is_file() {
        if dest_skill.is_file() {
            let src_bytes = fs::read(&source_skill).ok();
            let dest_bytes = fs::read(&dest_skill).ok();
            if src_bytes.is_some() && src_bytes == dest_bytes {
                return;
            }
        }
        if let Some(parent) = dest_skill.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::copy(&source_skill, &dest_skill);
    }
}

/// Copy `resources/inspector.js` into OUT_DIR so the crate can `include_str!` it
/// as a last-resort fallback when runtime filesystem lookups fail.
fn embed_inspector_js() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let inspector = manifest_dir.join("resources").join("inspector.js");
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let embed_rs = out_dir.join("inspector_js_embed.rs");

    println!("cargo:rerun-if-changed=resources/inspector.js");

    if inspector.is_file() {
        let dest_js = out_dir.join("inspector.js");
        fs::copy(&inspector, &dest_js).expect("failed to copy inspector.js into OUT_DIR");
        fs::write(
            &embed_rs,
            r#"pub const EMBEDDED_INSPECTOR_JS: Option<&str> = Some(include_str!(concat!(env!("OUT_DIR"), "/inspector.js")));
"#,
        )
        .expect("failed to write inspector_js_embed.rs");
    } else {
        fs::write(
            &embed_rs,
            r#"pub const EMBEDDED_INSPECTOR_JS: Option<&str> = None;
"#,
        )
        .expect("failed to write inspector_js_embed.rs");
        println!(
            "cargo:warning=resources/inspector.js missing — run `pnpm build:injection` before release builds"
        );
    }
}

/// Place WinDivert sidecar files next to the built exe so `cargo run` / local builds work.
/// Installers also bundle these via `tauri.conf.json` resources + NSIS post-install copy.
#[cfg(windows)]
fn copy_windivert_sidecars() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let windivert_dir = manifest_dir.join("resources").join("windivert");
    println!("cargo:rerun-if-changed=resources/windivert/WinDivert.dll");
    println!("cargo:rerun-if-changed=resources/windivert/WinDivert64.sys");

    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    let target_dir = manifest_dir.join("target").join(&profile);
    // Prefer CARGO_TARGET_DIR when set (e.g. workspace / CI).
    let target_dir = env::var("CARGO_TARGET_DIR")
        .map(|p| PathBuf::from(p).join(&profile))
        .unwrap_or(target_dir);

    for name in ["WinDivert.dll", "WinDivert64.sys"] {
        let src = windivert_dir.join(name);
        if !src.is_file() {
            println!(
                "cargo:warning=missing {name} under resources/windivert — transparent proxy will fail"
            );
            continue;
        }
        let _ = fs::create_dir_all(&target_dir);
        let dest = target_dir.join(name);
        if let Err(e) = fs::copy(&src, &dest) {
            let locked = e.raw_os_error() == Some(32);
            if locked {
                println!(
                    "cargo:warning=skipped copying {name} (file locked — stop horizon-gateway-serve to refresh sidecars)"
                );
            } else {
                println!("cargo:warning=failed to copy {name} next to exe: {e}");
            }
        }
    }
}
