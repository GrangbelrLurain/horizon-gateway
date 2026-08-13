use std::{env, fs, path::PathBuf};

fn main() {
    embed_inspector_js();
    #[cfg(windows)]
    embed_admin_manifest();
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
    let manifest = include_str!("windows-app-manifest.xml");
    let mut res = winres::WindowsResource::new();
    res.set_manifest(manifest);
    if let Err(e) = res.compile() {
        eprintln!("winres compile failed: {e}");
    }
}
