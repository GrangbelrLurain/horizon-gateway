# WinDivert redistributable (x64)

Official binaries from [WinDivert v2.2.2](https://github.com/basil00/WinDivert/releases/tag/v2.2.2)
(`WinDivert-2.2.2-A.zip` → `x64/`).

License: LGPLv3 / GPLv2 — see `LICENSE` in this folder.

Build uses `WINDIVERT_PATH` (see `src-tauri/.cargo/config.toml` and release CI) to
**dynamically** link these files. Do not enable the windivert crate `static` feature —
it conflicts with the MSVC CRT (`memcpy` LNK2005).

At runtime these must sit next to `horizon-gateway.exe`:
- `WinDivert.dll`
- `WinDivert64.sys`
