---
name: horizon-gateway
description: Inspect HTTP/API traffic, proxy status, domain monitoring, mock rules, and sandbox libraries captured by Horizon Gateway. Use when the user asks about network requests, API logs, proxy setup, domain health, HTTP debugging, local routing, pipelines, JSON schemas, or crypto presets.
---

# Horizon Gateway Skill

Horizon Gateway is a local HTTP proxy/debugging app. Agents interact with it in two ways:

| Tool | Use when |
|------|----------|
| `scripts/logs.mjs` | Read API logs **directly from disk** (fast, no app startup) |
| `horizon-gateway cli` | Call **any Horizon Gateway command** (domains, proxy, mocking, sandbox, settings, …) |

## Install this skill

Run once so your agent discovers Horizon Gateway automatically:

```bash
horizon-gateway cli init                  # global install (auto-detect agent)
horizon-gateway cli init --target cursor  # specific agent
horizon-gateway cli init --target all     # all supported agents
horizon-gateway cli init --project        # current repo: .agents/skills/horizon-gateway/
horizon-gateway cli init --print          # print SKILL.md without installing
```

Supported `--target` values: `auto`, `all`, `cursor`, `claude`, `codex`, `gemini`, `copilot`, `windsurf`.

Without this skill, bootstrap from the binary:

```bash
horizon-gateway cli list
horizon-gateway cli help <command>
```

---

## 1. API Logs (disk reader)

Best for searching and inspecting captured API traffic. Does **not** start the Horizon Gateway app.

```bash
node <skill-dir>/scripts/logs.mjs [options]
```

After `cli init`, `<skill-dir>` is typically `~/.cursor/skills/horizon-gateway` or `.agents/skills/horizon-gateway`.

### Options

- `--date <YYYY-MM-DD>`: Log date. Defaults to today.
- `--host <host>`: Filter by host (case-insensitive substring).
- `--method <method>`: HTTP method (GET, POST, …).
- `--path <path>`: Path substring filter.
- `--status <status>`: Status code (`500`, `4xx`, …).
- `--search <text>`: Search in request/response body.
- `--limit <number>`: Max results. Default `5`, max `50`.
- `--fields <fields>`: Comma-separated fields. Default `id,timestamp,method,host,path,status_code`.
  - Available: `id`, `timestamp`, `method`, `host`, `path`, `url`, `status_code`, `request_headers`, `response_headers`, `request_body`, `response_body`, `elapsed_ms`.
- `--truncate <length>`: Truncate body text. Default `200`.
- `--id <uuid>`: Fetch a single log by ID.
- `--summary`: Return aggregate stats instead of entries.

### Token-saving workflow

1. **Search first** with default fields — never pull bodies in list queries.
2. **Drill down** by `--id` with `--fields response_body --truncate 500`.

```bash
node .agents/skills/horizon-gateway/scripts/logs.mjs --host modetour.dev --status 500 --limit 5
node .agents/skills/horizon-gateway/scripts/logs.mjs --id <uuid> --fields response_body --truncate 1000
```

---

## 2. Horizon Gateway CLI (full app commands)

```bash
horizon-gateway cli <subcommand> [args]
```

On Windows use `horizon-gateway.exe`.

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `init` | Install this skill for coding agents |
| `list` | List all available commands (`category`, `guiOnly`, `payloadExample`) |
| `help <command>` | Show payload schema for one command |
| `run <command> [payload] [--query <path>]` | Execute a command (headless — no GUI required) |

`cli run` works **without** starting the Horizon Gateway GUI. It bootstraps app services, prints JSON to stdout, and exits.

Payload forms:

```bash
horizon-gateway cli run get_domains '{}'
horizon-gateway cli run regist_domains @domains.json
horizon-gateway cli run create_scenario -   # JSON from stdin
horizon-gateway cli run get_domains '{}' --payload @body.json
```

### Windows PowerShell

Release builds use the **console subsystem** so pipes, `spawn`, and file redirection capture stdout reliably (v2.4.2+). The console window is hidden automatically when launching the GUI.

**JSON escaping** — wrap the payload in single quotes and escape inner double quotes:

```powershell
horizon-gateway cli run set_local_route_enabled '{\"id\": 24, \"enabled\": true}'
```

**Prefer file payloads** for complex JSON (avoids escaping issues):

```powershell
horizon-gateway cli run regist_domains @domains.json
horizon-gateway cli run create_scenario - --payload @body.json   # stdin
```

If a terminal still drops output, `| Out-String` remains a safe fallback:

```powershell
horizon-gateway cli run get_proxy_status '{}' | Out-String
```

### Examples

```bash
horizon-gateway cli list
horizon-gateway cli help get_api_logs
horizon-gateway cli run get_domains '{}'
horizon-gateway cli run get_domains '{}' --query data.[].url
horizon-gateway cli run get_api_logs '{"date":"2026-07-06"}' --query data.logs[statusCode>=500].path
horizon-gateway cli run get_saved_pipelines '{}' --query data.[].{id,name}
```

### Recommended commands by task

| Task | Start with |
|------|------------|
| Domains / groups | `get_domains`, `get_groups`, `regist_domains` |
| Proxy / routing | `get_proxy_status`, `get_local_routes`, `start_local_proxy` |
| API logs | Prefer `logs.mjs`; or `get_api_logs`, `list_api_log_dates` |
| Mocking | `get_scenarios`, `get_mock_rules`, `create_mock_rule` |
| Pipeline library | `get_saved_pipelines`, `create_saved_pipeline`, `execute_pipeline` |
| JSON Schema registry | `get_json_schemas`, `create_json_schema`, `validate_json_schema` |
| Crypto presets | `get_crypto_presets`, `create_crypto_preset`, `process_crypto` |
| Inspector policies | `get_annotations`, `add_annotation` |

Skip entries where `guiOnly: true` in `cli list` (window/dialog commands).

### Query syntax (`--query`)

| Pattern | Meaning |
|---------|---------|
| `data.logs` | Navigate object keys |
| `data.logs.[].path` | Project array field |
| `data.logs.[].{path,statusCode}` | Slice object fields |
| `data.logs[statusCode>=500].path` | Filter then project |

### When to use CLI vs logs.mjs

| Task | Prefer |
|------|--------|
| Search/filter API logs | `logs.mjs` |
| Get domains, proxy status, mocking rules, sandbox libraries | `horizon-gateway cli` |
| Mutate settings | `horizon-gateway cli` |

### CLI limits

- **`cli init` / `list` / `help` / `run`**: Run without the GUI (preferred for agents).
- **`guiOnly` commands** (`open_window`, `save_root_ca`, …): Fail in headless `cli run` with a clear error — use the desktop app.
- **`start_local_proxy`**: Headless not supported yet (needs GUI `AppHandle` for proxy runtime).
- **Reading API logs**: Prefer `logs.mjs` (streaming, token-efficient).
- **GUI open + CLI write**: Avoid concurrent writes to the same app_data JSON files.
- **`execute_pipeline`**: Rust runner only; FE-only `script` nodes are not supported via CLI.
- Always call `cli help <command>` before `run` if unsure — use the returned `payloadExample` as the template.

---

## Response format

JSON to stdout. Errors on stderr: `{"success": false, "error": "..."}`.

Use `--query` to extract only the fields you need.
