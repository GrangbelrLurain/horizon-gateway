use std::{
    env, fs,
    path::{Path, PathBuf},
};

fn main() {
    embed_inspector_js();
    sync_skill_md_resource();
    // Dev (`tauri dev`) must not write `resources/horizon-gateway-serve.exe`:
    // Tauri watches hg-gui, so copying that file retriggers a rebuild loop and
    // os error 32 / STATUS_ENTRYPOINT_NOT_FOUND on Windows.
    stage_sidecar_for_release_bundle("horizon-gateway-serve");
    stage_sidecar_for_release_bundle("hgc");
    #[cfg(windows)]
    copy_windivert_sidecars();
    copy_sidecar_next_to_exe("horizon-gateway-serve");
    copy_sidecar_next_to_exe("hgc");
    strip_debug_only_bundle_resources();
    build_tauri();
}

fn build_tauri() {
    #[cfg(windows)]
    {
        let windows = tauri_build::WindowsAttributes::new()
            .app_manifest(include_str!("windows-app-manifest.xml"));
        if let Err(e) =
            tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        {
            let msg = e.to_string();
            // Locked sidecar copies only. Do not ignore missing-resource errors:
            // try_build embeds the Common Controls v6 manifest *after* resource
            // copy, and skipping that yields STATUS_ENTRYPOINT_NOT_FOUND.
            if msg.contains("os error 32") || msg.contains("os error 33") {
                println!("cargo:warning=tauri build script sidecar warning: {msg}");
                embed_windows_manifest();
            } else {
                panic!("failed to run tauri build script: {msg}");
            }
        }
    }
    #[cfg(not(windows))]
    {
        tauri_build::build();
    }
}

/// RFC 7396-style merge that *keeps* JSON nulls so tauri-build can delete keys.
fn json_merge_keep_nulls(base: &mut serde_json::Value, patch: &serde_json::Value) {
    if let serde_json::Value::Object(patch_map) = patch {
        if !base.is_object() {
            *base = serde_json::json!({});
        }
        let serde_json::Value::Object(base_map) = base else {
            return;
        };
        for (key, val) in patch_map {
            if val.is_null() {
                base_map.insert(key.clone(), serde_json::Value::Null);
            } else {
                json_merge_keep_nulls(
                    base_map
                        .entry(key.clone())
                        .or_insert(serde_json::Value::Null),
                    val,
                );
            }
        }
    } else {
        *base = patch.clone();
    }
}

/// Dev must not ask tauri-build to copy serve.exe / WinDivert: missing serve.exe
/// used to abort try_build before the Windows app manifest was embedded.
fn strip_debug_only_bundle_resources() {
    if is_release_profile() {
        return;
    }
    let patch = serde_json::json!({
        "bundle": {
            "resources": {
                "resources/horizon-gateway-serve.exe": null,
                "resources/hgc.exe": null,
                "resources/windivert/WinDivert.dll": null,
                "resources/windivert/WinDivert64.sys": null
            }
        }
    });
    let mut merged = env::var("TAURI_CONFIG")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    json_merge_keep_nulls(&mut merged, &patch);
    env::set_var("TAURI_CONFIG", merged.to_string());
}

#[cfg(windows)]
fn embed_windows_manifest() {
    let mut res = winres::WindowsResource::new();
    res.set_manifest(include_str!("windows-app-manifest.xml"));
    if let Err(e) = res.compile() {
        println!("cargo:warning=failed to embed Windows app manifest: {e}");
    }
}

fn is_release_profile() -> bool {
    env::var("PROFILE").unwrap_or_else(|_| "debug".into()) == "release"
}

fn profile_target_dir(manifest_dir: &Path) -> PathBuf {
    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    if let Ok(dir) = env::var("CARGO_TARGET_DIR") {
        return PathBuf::from(dir).join(&profile);
    }
    manifest_dir.join("..").join("target").join(profile)
}

fn same_path(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(ca), Ok(cb)) => ca == cb,
        _ => false,
    }
}

fn copy_skipping_lock(src: &Path, dest: &Path, label: &str) {
    if same_path(src, dest) {
        return;
    }
    if let (Ok(src_meta), Ok(dest_meta)) = (src.metadata(), dest.metadata()) {
        if src_meta.len() == dest_meta.len()
            && src_meta.modified().ok() == dest_meta.modified().ok()
        {
            return;
        }
    }
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Err(e) = fs::copy(src, dest) {
        let locked = e.raw_os_error() == Some(32) || e.raw_os_error() == Some(33);
        if locked {
            println!(
                "cargo:warning=skipped copying {label} (file locked — stop horizon-gateway-serve to refresh)"
            );
        } else {
            println!("cargo:warning=failed to copy {label}: {e}");
        }
    }
}

fn sidecar_resource_path(manifest_dir: &Path, bin_name: &str) -> PathBuf {
    let ext = if cfg!(windows) { ".exe" } else { "" };
    manifest_dir
        .join("resources")
        .join(format!("{bin_name}{ext}"))
}

/// Release only: stage sidecars under `resources/` for the NSIS bundle (`tauri.conf.json`).
/// Never do this in debug — Tauri's hg-gui watcher treats that write as a source change.
fn stage_sidecar_for_release_bundle(bin_name: &str) {
    println!("cargo:rerun-if-changed=binaries");

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let resource_dest = sidecar_resource_path(&manifest_dir, bin_name);

    if !is_release_profile() {
        // Leftover copies would be watched and copied over target/debug binaries.
        if resource_dest.is_file() {
            let _ = fs::remove_file(&resource_dest);
        }
        return;
    }

    if let Some(src) = find_sidecar_binary(&manifest_dir, bin_name) {
        copy_skipping_lock(
            &src,
            &resource_dest,
            &format!("{bin_name} (bundle resource)"),
        );
        return;
    }

    if !resource_dest.is_file()
        || resource_dest
            .metadata()
            .map(|m| m.len() == 0)
            .unwrap_or(true)
    {
        panic!(
            "{bin_name} missing for release bundle.\n\
             Run `node scripts/build-serve-sidecar.mjs` before `tauri build`."
        );
    }
}

/// Copy sidecar next to the GUI executable (`src-tauri/target/{profile}/`), not into watched sources.
fn copy_sidecar_next_to_exe(bin_name: &str) {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let Some(src) = find_sidecar_binary(&manifest_dir, bin_name) else {
        if !is_release_profile() {
            println!(
                "cargo:warning={bin_name} not found; run `cargo build -p {bin_name}` (GUI will look in target/debug)"
            );
        }
        return;
    };

    let ext = if cfg!(windows) { ".exe" } else { "" };
    let dest = profile_target_dir(&manifest_dir).join(format!("{bin_name}{ext}"));
    copy_skipping_lock(&src, &dest, &format!("{bin_name} next to GUI exe"));
}

fn find_sidecar_binary(manifest_dir: &Path, bin_name: &str) -> Option<PathBuf> {
    let ext = if cfg!(windows) { ".exe" } else { "" };
    let file_name = format!("{bin_name}{ext}");
    let mut candidates = Vec::new();

    // Prefer this profile's workspace binary so debug does not overwrite it
    // with a leftover release sidecar from binaries/.
    candidates.push(profile_target_dir(manifest_dir).join(&file_name));

    if let Ok(target) = env::var("TARGET") {
        candidates.push(
            manifest_dir
                .join("binaries")
                .join(format!("{bin_name}-{target}{ext}")),
        );
    }

    if let Ok(entries) = fs::read_dir(manifest_dir.join("binaries")) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with(bin_name))
            {
                candidates.push(path);
            }
        }
    }

    candidates.into_iter().find(|path| {
        path.is_file() && path.metadata().map(|m| m.len() > 0).unwrap_or(false)
    })
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

    let target_dir = profile_target_dir(&manifest_dir);

    for name in ["WinDivert.dll", "WinDivert64.sys"] {
        let src = windivert_dir.join(name);
        if !src.is_file() {
            println!(
                "cargo:warning=missing {name} under resources/windivert — transparent proxy will fail"
            );
            continue;
        }
        copy_skipping_lock(&src, &target_dir.join(name), name);
    }
}
