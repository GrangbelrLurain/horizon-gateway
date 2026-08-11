"""Post-process *_svc signatures: State<T> -> &T."""

from __future__ import annotations

import re
from pathlib import Path

from add_svc_wrappers import split_params, transform_params_to_svc


def fix_file(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    pat = re.compile(
        r"(pub (?:async )?fn \w+_svc\()([^)]*(?:\([^)]*\)[^)]*)?)(\) ->)",
        re.DOTALL,
    )
    count = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal count
        params = m.group(2)
        if "State<" not in params and "tauri::State" not in params:
            return m.group(0)
        count += 1
        return f"{m.group(1)}{transform_params_to_svc(params)}{m.group(3)}"

    new_text = pat.sub(repl, text)
    if count:
        path.write_text(new_text, encoding="utf-8")
    return count


def main() -> None:
    total = 0
    for p in sorted(Path("src/command").glob("*.rs")):
        n = fix_file(p)
        if n:
            print(f"{p.name}: {n}")
            total += n
    print(f"fixed: {total}")


if __name__ == "__main__":
    main()
