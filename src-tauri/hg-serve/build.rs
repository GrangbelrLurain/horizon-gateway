fn main() {
    #[cfg(windows)]
    embed_admin_manifest();
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
