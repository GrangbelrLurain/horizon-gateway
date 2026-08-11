# WinDivert redistributable (x64)

Official binaries from [WinDivert v2.2.2](https://github.com/basil00/WinDivert/releases/tag/v2.2.2)
(`WinDivert-2.2.2-A.zip` → `x64/`).

License: LGPLv3 / GPLv2 — see `LICENSE` in this folder.

These files must sit next to `horizon-gateway.exe` at runtime:
- `WinDivert.dll` — required when linking dynamically
- `WinDivert64.sys` — kernel driver (needed for transparent proxy even with static linking)
