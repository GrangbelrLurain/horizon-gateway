fn main() {
    let specta_builder = watchtower_lib::get_specta_builder();
    specta_builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");
    println!("TS bindings exported successfully!");
}
