"""Fix remaining _svc State params, multiline signatures, and Option<AppHandle> emit."""

from __future__ import annotations

import re
from pathlib import Path


def fix_state_types(text: str) -> str:
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    in_svc_sig = False
    buf = ""

    for line in lines:
        if re.search(r"pub (?:async )?fn \w+_svc\(", line):
            in_svc_sig = True
            buf = line
            if ") ->" in line:
                in_svc_sig = False
                out.append(fix_line(buf))
                buf = ""
            continue

        if in_svc_sig:
            buf += line
            if ") ->" in line:
                in_svc_sig = False
                fixed = buf
                fixed = re.sub(
                    r"tauri::State<'_,\s*([^>]+(?:<[^>]+>)?)>",
                    r"&\1",
                    fixed,
                    flags=re.DOTALL,
                )
                fixed = re.sub(
                    r"State<'_,\s*([^>]+(?:<[^>]+>)?)>",
                    r"&\1",
                    fixed,
                    flags=re.DOTALL,
                )
                out.append(fixed)
                buf = ""
            continue

        out.append(line)

    return "".join(out)


def fix_line(line: str) -> str:
    line = re.sub(
        r"tauri::State<'_,\s*([^>]+(?:<[^>]+>)?)>",
        r"&\1",
        line,
    )
    line = re.sub(r"State<'_,\s*([^>]+(?:<[^>]+>)?)>", r"&\1", line)
    return line


def fix_emit(text: str) -> str:
    return re.sub(
        r"let _ = (app)\.emit\(([^;]+)\);",
        r"if let Some(app) = \1 { let _ = app.emit(\2); }",
        text,
    )


def fix_api_schema(text: str) -> str:
    text = text.replace(
        "fn schemas_dir(app: &tauri::AppHandle) -> PathBuf {\n    use tauri::Manager;\n    let base = app\n        .path()\n        .app_data_dir()\n        .expect(\"failed to get app data dir\");\n    base.join(\"schemas\")\n}",
        "fn schemas_dir(base: &std::path::Path) -> PathBuf {\n    base.join(\"schemas\")\n}",
    )
    text = text.replace(
        "download_api_schema_svc(payload, Some(app.clone())).await.unwrap()",
        "download_api_schema_svc(payload, &schemas_dir_from_app(&app)).await.unwrap()",
    )
    text = text.replace(
        "pub async fn download_api_schema_svc(payload: DownloadApiSchemaPayload, app: Option<tauri::AppHandle>)",
        "pub async fn download_api_schema_svc(payload: DownloadApiSchemaPayload, schemas_base: &std::path::Path)",
    )
    text = text.replace("let dir = schemas_dir(&app);", "let dir = schemas_dir(schemas_base);")
    text = text.replace(
        "get_api_schema_content_svc(payload, Some(app.clone())).unwrap()",
        "get_api_schema_content_svc(payload, &schemas_dir_from_app(&app)).unwrap()",
    )
    text = text.replace(
        "pub fn get_api_schema_content_svc(payload: GetApiSchemaPayload, app: Option<tauri::AppHandle>)",
        "pub fn get_api_schema_content_svc(payload: GetApiSchemaPayload, schemas_base: &std::path::Path)",
    )
    text = text.replace(
        "let file_path = schemas_dir(&app).join(format!(\"{}.json\", payload.domain_id));",
        "let file_path = schemas_dir(schemas_base).join(format!(\"{}.json\", payload.domain_id));",
    )
    if "fn schemas_dir_from_app" not in text:
        text = text.replace(
            "fn schemas_dir(base: &std::path::Path) -> PathBuf {",
            "fn schemas_dir_from_app(app: &tauri::AppHandle) -> PathBuf {\n    use tauri::Manager;\n    let base = app\n        .path()\n        .app_data_dir()\n        .expect(\"failed to get app data dir\");\n    schemas_dir(&base)\n}\n\nfn schemas_dir(base: &std::path::Path) -> PathBuf {",
        )
    return text


def main() -> None:
    for path in sorted(Path("src/command").glob("*.rs")):
        text = path.read_text(encoding="utf-8")
        if "_svc" not in text:
            continue
        new = fix_state_types(text)
        new = fix_emit(new)
        if path.name == "api_log_commands.rs":
            new = fix_api_schema(new)
        if new != text:
            path.write_text(new, encoding="utf-8")
            print(path.name)


if __name__ == "__main__":
    main()
