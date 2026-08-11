import re
from pathlib import Path


def split_params(params: str) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    depth = 0
    for ch in params:
        if ch in "<([":
            depth += 1
        elif ch in ">)]":
            depth -= 1
        if ch == "," and depth == 0:
            part = "".join(current).strip()
            if part:
                parts.append(part)
            current = []
        else:
            current.append(ch)
    part = "".join(current).strip()
    if part:
        parts.append(part)
    return parts


def extract_brace_body(src: str, open_brace_index: int) -> tuple[str, int]:
    depth = 0
    i = open_brace_index
    while i < len(src):
        ch = src[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return src[open_brace_index + 1 : i], i + 1
        i += 1
    raise ValueError("unbalanced braces")


def transform_params_to_svc(params: str) -> str:
    out: list[str] = []
    for part in split_params(params):
        p = part
        p = re.sub(
            r"tauri::State<'_,\s*std::sync::Arc<([^>]+)>>",
            r"&std::sync::Arc<\1>",
            p,
        )
        p = re.sub(r"tauri::State<'_,\s*Arc<([^>]+)>>", r"&std::sync::Arc<\1>", p)
        p = re.sub(
            r"tauri::State<'_,\s*crate::service::([^>]+)>>",
            r"&crate::service::\1",
            p,
        )
        p = re.sub(r"tauri::State<'_,\s*([^>]+)>>", r"&\1", p)
        p = re.sub(r"\bapp:\s*tauri::AppHandle\b", "app: Option<tauri::AppHandle>", p)
        p = re.sub(r"\bapp:\s*AppHandle\b", "app: Option<tauri::AppHandle>", p)
        p = re.sub(
            r"\bapp_handle:\s*tauri::AppHandle\b",
            "app_handle: Option<tauri::AppHandle>",
            p,
        )
        out.append(p)
    return ", ".join(out)


def wrap_args_from_params(params: str) -> list[str]:
    args: list[str] = []
    for part in split_params(params):
        pname = part.split(":")[0].strip()
        if "tauri::State" in part or "State<" in part:
            args.append(f"&{pname}")
        elif pname in ("app", "app_handle") or "AppHandle" in part:
            args.append(f"Some({pname}.clone())")
        elif pname.startswith("_"):
            continue
        else:
            args.append(pname)
    return args


def add_svc_wrappers(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    if "_svc(" in text:
        return 0

    header = re.compile(
        r"(?P<attrs>(?:#\[[^\]]+\]\s*)+)"
        r"pub\s+(?P<async>async\s+)?fn\s+(?P<name>\w+)\s*\("
        r"(?P<params>.*?)\)\s*->\s*(?P<ret>[^{]+)\{",
        re.DOTALL,
    )

    out: list[str] = []
    last = 0
    count = 0

    for m in header.finditer(text):
        if "#[tauri::command]" not in m.group("attrs"):
            continue

        open_brace = m.end() - 1
        body, end_idx = extract_brace_body(text, open_brace)

        is_async = bool(m.group("async"))
        name = m.group("name")
        params = m.group("params")
        ret = m.group("ret").strip()
        svc_params = transform_params_to_svc(params)
        wrap_args = wrap_args_from_params(params)
        async_kw = "async " if is_async else ""
        svc_name = f"{name}_svc"
        call = f"{svc_name}({', '.join(wrap_args)})"
        if is_async:
            wrapper_body = f"    {call}.await"
        else:
            wrapper_body = f"    {call}"

        out.append(text[last:m.start()])
        out.append(
            f"{m.group('attrs')}pub {async_kw}fn {name}({params}) -> {ret} {{\n"
            f"{wrapper_body}\n"
            f"}}\n\n"
            f"pub {async_kw}fn {svc_name}({svc_params}) -> {ret} {{{body}}}"
        )
        last = end_idx
        count += 1

    if count == 0:
        return 0

    out.append(text[last:])
    path.write_text("".join(out), encoding="utf-8")
    return count


def main() -> None:
    for p in sorted(Path("src/command").glob("*.rs")):
        n = add_svc_wrappers(p)
        if n:
            print(f"{p.name}: {n}")


if __name__ == "__main__":
    main()
