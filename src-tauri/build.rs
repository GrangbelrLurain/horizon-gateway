use std::{env, fs, path::PathBuf};

fn main() {
    embed_inspector_js();
    sync_skill_md_resource();
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
