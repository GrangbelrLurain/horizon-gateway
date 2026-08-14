use std::{env, fs, path::PathBuf};

fn main() {
    embed_inspector_js();
    copy_tray_icon();
    #[cfg(windows)]
    embed_admin_manifest();
}

fn copy_tray_icon() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let src = manifest_dir.join("..").join("hg-gui").join("icons").join("icon.ico");
    println!("cargo:rerun-if-changed=../hg-gui/icons/icon.ico");
    if !src.is_file() {
        return;
    }
    let Ok(out_dir) = env::var("OUT_DIR") else {
        return;
    };
    let mut dir = PathBuf::from(out_dir);
    for _ in 0..6 {
        let name = dir.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name == "debug" || name == "release" {
            let _ = fs::copy(&src, dir.join("icon.ico"));
            return;
        }
        if !dir.pop() {
            return;
        }
    }
}

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
    }
}

#[cfg(windows)]
fn embed_admin_manifest() {
    println!("cargo:rerun-if-changed=windows-app-manifest.xml");
    println!("cargo:rerun-if-changed=windows-app-manifest.rc");
    // Apply requireAdministrator only to the serve daemon, never to lib tests or other bins.
    embed_resource::compile_for(
        "windows-app-manifest.rc",
        &["horizon-gateway-serve"],
        embed_resource::NONE,
    )
    .manifest_required()
    .expect("failed to embed Windows admin manifest for horizon-gateway-serve");
}
