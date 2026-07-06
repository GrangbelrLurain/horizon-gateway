---
name: watchtower
description: Inspect HTTP/API traffic, proxy status, domain monitoring, and mock rules captured by Watchtower. Use when the user asks about network requests, API logs, proxy setup, domain health, HTTP debugging, or local routing.
---

# Watchtower Skill

Watchtower is a local HTTP proxy/debugging app. Agents interact with it in two ways:

| Tool | Use when |
|------|----------|
| `scripts/logs.mjs` | Read API logs **directly from disk** (fast, no app startup) |
| `watchtower cli` | Call **any Watchtower command** (domains, proxy, mocking, settings, …) |

## Install this skill

Run once so your agent discovers Watchtower automatically:

```bash
watchtower cli init                  # global install (auto-detect agent)
watchtower cli init --target cursor  # specific agent
watchtower cli init --target all     # all supported agents
watchtower cli init --project        # current repo: .agents/skills/watchtower/
watchtower cli init --print          # print SKILL.md without installing
```

Supported `--target` values: `auto`, `all`, `cursor`, `claude`, `codex`, `gemini`, `copilot`, `windsurf`.

Without this skill, bootstrap from the binary:

```bash
watchtower cli list
watchtower cli help <command>
```

---

## 1. API Logs (disk reader)

Best for searching and inspecting captured API traffic. Does **not** start the Watchtower app.

```bash
node <skill-dir>/scripts/logs.mjs [options]
```

After `cli init`, `<skill-dir>` is typically `~/.cursor/skills/watchtower` or `.agents/skills/watchtower`.

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
node .agents/skills/watchtower/scripts/logs.mjs --host modetour.dev --status 500 --limit 5
node .agents/skills/watchtower/scripts/logs.mjs --id <uuid> --fields response_body --truncate 1000
```

---

## 2. Watchtower CLI (full app commands)

```bash
watchtower cli <subcommand> [args]
```

On Windows use `watchtower.exe`.

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `init` | Install this skill for coding agents |
| `list` | List all available commands |
| `help <command>` | Show payload schema for one command |
| `run <command> [payload] [--query <path>]` | Execute a command |

### Examples

```bash
watchtower cli list
watchtower cli help get_api_logs
watchtower cli run get_domains '{}'
watchtower cli run get_domains '{}' --query data.[].url
watchtower cli run get_api_logs '{"date":"2026-07-06"}' --query data.logs[statusCode>=500].path
```

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
| Get domains, proxy status, mocking rules | `watchtower cli` |
| Mutate settings | `watchtower cli` |

---

## Response format

JSON to stdout. Errors on stderr: `{"success": false, "error": "..."}`.

Use `--query` to extract only the fields you need.
