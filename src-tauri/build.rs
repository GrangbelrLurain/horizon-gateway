use std::{env, fs, path::PathBuf};

fn main() {
    embed_inspector_js();
    sync_skill_md_resource();
    #[cfg(windows)]
    copy_windivert_sidecars();
    tauri_build::build();
}

/// Automatically sync project master SKILL.md (`.agents/skills/horizon-gateway/SKILL.md`)
/// to embedded resources (`resources/skills/horizon-gateway/SKILL.md`) at build time.
fn sync_skill_md_resource() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let source_skill = manifest_dir
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
            println!("cargo:warning=failed to copy {name} next to exe: {e}");
        }
    }
}
