# Horizon Gateway

<p align="right">
  <a href="./README.md"><strong>한국어 버전 🌐</strong></a>
</p>

**Horizon Gateway** is a desktop application built with Tauri 2 + Rust + React. It provides domain health checking, local proxy capabilities (MITM, mocking, routing), an OpenAPI viewer, inspector injection, and mobile connectivity (USB/tunnel) all in one development and operation infrastructure toolbox.

---

## Table of Contents
1. [Installation](#installation)
2. [Usage](#usage)
3. [CLI Usage](#cli-usage)
4. [Tech Stack](#tech-stack)
5. [Getting Started (Developers)](#getting-started-developers)
6. [Architecture Rules](#architecture-rules)
7. [Development Workflow](#development-workflow)
8. [Release History](#release-history)
9. [Author & License](#author--license)

---

## Installation

### For End-Users (Binary Execution)
1. Go to the **GitHub Releases** page and download the latest package matching your operating system (e.g., `.msi` for Windows, `.dmg` for macOS).
2. Run the downloaded installer to complete the installation.
3. **If a security warning appears**:
   - **Windows**: Click "More info" and then select "Run anyway".
   - **macOS**: Go to System Settings -> Privacy & Security and explicitly allow running the blocked application.

### For Developers (Source Code Build)
If you want to build and run the application from source, please refer to the [Getting Started (Developers)](#getting-started-developers) section below.

---

## Usage

### 1. Domain Health Check
- Register the domains you want to monitor under the **Domains** tab in the app.
- It performs periodic Ping and HTTP status code checks, allowing you to monitor real-time connection status on the dashboard.
- You can group registered domains for organized management.

### 2. Local Proxy & MITM (Man-in-the-Middle)
- Configure the proxy port (default: 9090) and reverse ports in **Proxy Settings**, then start the proxy server.
- **HTTPS Traffic Capturing (MITM)**:
  - Generate and download the **Root CA Certificate** in the Settings menu (Export Root CA).
  - To decrypt and monitor HTTPS packets, you must import (install) the Root CA certificate into your operating system or browser's certificate store as a "Trusted Root Certification Authority".
- **Local Routing Rules**: You can redirect specific external domain requests to a local directory or another port's development server to easily test your development environment.

### 3. OpenAPI Viewer & Mocking
- Load or link an OpenAPI specification file in the **APIs** menu to inspect the API Schema structurally.
- Define scenarios (Scenarios) and mocking rules (Mock Rules) to return mock responses (status codes, headers, JSON body, etc.) for specific incoming API requests intercepted by the proxy.

### 4. Inspector Injection
- Dynamically inject Horizon Gateway's debugging Inspector script into any monitored web page domain.
- This allows you to remotely inspect and control console logs, network requests, and DOM tree states of the client browser directly inside the Horizon Gateway application in real time.

### 5. Mobile Connection
- Intercept and reverse-forward traffic from connected Android devices to your local proxy server using **USB Debugging (ADB)** integration.
- Launch the **Tunneling (Tailscale / Cloudflare)** modules to expose the local proxy environment to the external internet or specific virtual networks, enabling easy remote debugging on mobile devices.

---

## CLI Usage

Horizon Gateway features a robust Command Line Interface (CLI) in addition to its GUI client, facilitating configuration management via terminal and automated integration with AI coding assistants (such as Cursor, Gemini, Claude, etc.).

### How to Run CLI
- **Using packaged binary**:
  ```bash
  Horizon Gateway.exe cli <subcommand> [arguments]
  ```
- **From development environment (Source Code)**:
  ```bash
  # From the project root
  cargo run --manifest-path src-tauri/Cargo.toml -- cli <subcommand> [arguments]
  ```

### Main CLI Subcommands

#### 1. `init` (Initialize Agent Skill Configuration)
Installs the custom skill document so that AI assistants can automatically discover and control Horizon Gateway capabilities within your workspace.
- **Local Workspace Installation**:
  ```bash
  Horizon Gateway cli init --project
  ```
  Creates `SKILL.md` and helper scripts in the `.agents/skills/Horizon Gateway` directory of the current project.
- **Global Agent Installation**:
  ```bash
  Horizon Gateway cli init --target gemini
  ```
  Links the skill to a specific agent platform's global configuration (e.g., `gemini`, `cursor`, `claude`, `copilot`, `windsurf`, etc.).
- **Options**:
  - `--force`: Overwrite existing files if they exist.
  - `--print`: Print the contents of `SKILL.md` directly to the console as JSON instead of writing to files.

#### 2. `list` (List Available API Commands)
Outputs all internal Horizon Gateway API commands that can be invoked via the CLI in JSON format.
```bash
Horizon Gateway cli list
```

#### 3. `help` (Detailed Command Guide)
Queries descriptions and the expected input JSON Payload format for a specific API command.
```bash
Horizon Gateway cli help get_domains
```

#### 4. `run` (Execute API Command)
Directly invokes Horizon Gateway's backend business logic. Pass the input parameters as a JSON payload in the second argument. You can filter the output using a simple jq-like JSON query with the `--query` option.
- **Get All Domains**:
  ```bash
  Horizon Gateway cli run get_domains '{}'
  ```
- **Create a Domain Group**:
  ```bash
  Horizon Gateway cli run create_group '{"name": "Production Domains"}'
  ```
- **Example of Filtering Output**:
  ```bash
  Horizon Gateway cli run get_domains '{}' --query 'data[].domainName'
  ```

---

## Tech Stack

| Category | Technology |
|------|------|
| Frontend | Vite 7, React 19, TanStack Router, Jotai, Tailwind CSS 4 |
| Backend | Rust, Tauri 2, Specta (Automatic TS bindings generation) |
| Proxy | Axum, Hyper, Tokio |
| Tooling | pnpm, Biome, Husky, TypeScript 5.8 |

---

## Getting Started (Developers)

### Prerequisites
- [Install Rust](https://www.rust-lang.org/tools/install)
- [Install Node.js](https://nodejs.org/) & [pnpm](https://pnpm.io/installation)

### Local Development
```bash
pnpm install
pnpm tauri dev
```
Running `tauri dev` will execute `pnpm dev` automatically via the `beforeDevCommand` hook. `pnpm dev` checks for the presence of `inspector.js` and compiles it using `build:injection` before booting up the Vite dev server.

To modify the debugging Inspector injection script with hot reloading, execute:
```bash
pnpm watch:injection
```

### Build & Release
```bash
pnpm tauri build   # runs beforeBuildCommand -> pnpm build (including injection build)
```
Versions are automatically synchronized across `package.json`, `tauri.conf.json`, and `Cargo.toml`.

Use the following scripts to bump versions:
```bash
pnpm version:patch   # or version:minor, version:major
```
This updates `CHANGELOG.md`, commits the changes, creates the `v<VERSION>` git tag, and pushes to remote, which triggers the GitHub Actions release CI.

### Updater Signing Key setup
1. Generate your private signing key locally:
   `pnpm tauri signer generate -w ~/.tauri/Horizon Gateway.key`
2. Configure the generated public key in `tauri.conf.json` under `plugins.updater.pubkey`.
3. Add the private key string as a repository secret called `TAURI_SIGNING_PRIVATE_KEY` on GitHub Actions.

---

## Architecture Rules

Rules for code layout and integration.

### Directory Layout

```
src/                          # Frontend
├── routes/                   # TanStack Router (page composition)
├── features/                 # Feature-specific UI assembling
├── entities/                 # domain entities (store, api, hooks, ui)
├── shared/
│   ├── api/                  # bindings re-export + unwrap
│   └── ui/                   # Shared UI components
├── injection/                # Proxy Inspector script (separate Vite entry)
└── bindings.ts               # Specta generated — DO NOT modify directly

src-tauri/src/                # Backend
├── command/                  # Tauri Commands (thin entry points)
├── service/                  # Business logic
│   └── local_proxy/          # HTTP proxy runtime (complex module, see below)
├── model/                    # Data models
└── storage/                  # JSON storage and migrations
```

### Frontend layering (FSD)

```
bindings.ts → entities/{name}/ → features/ → routes/
```

We enforce architectural dependency directions and barrel imports using Biome's `noRestrictedImports`.

| Layer | Forbidden Import |
|--------|-------------|
| `shared` | `@/entities/**`, `@/features/**`, `@/routes/**` |
| `entities` | `@/features/**`, `@/routes/**`, `@/entities/*/**` (deep) |
| `features` | `@/routes/**`, `@/entities/*/**`, `@/features/*/**` (deep) |
| `routes` | `@/entities/*/**`, `@/features/*/**` (deep) |

Entities and features should only import from their sibling barrel entry points (`@/entities/{name}`, `@/features/{name}`). Use relative paths (`../store`) only for internal files within the same entity or feature folder.

### Backend service unit convention (Tier 2)

Complex backend modules maintain a uniform structure within each sub-unit folder.

```
service/{module}/{unit}/
├── mod.rs              # wiring + re-export
├── {role}.rs           # implementations categorized by role
└── tests/
    ├── mod.rs
    └── {role}.rs       # 1:1 mapping with logic files
```

The first reference module using this structure is `local_proxy/` (containing `flags`, `routing`, `connect`, `handler`, `server`, etc.).

Simple CRUD services (`domain_service.rs`, etc.) remain as Tier 1 flat files.

### Routes (Current)

| Route | Role |
|------|------|
| `/` | Home / Dashboard |
| `/domains/*` | Domain registration, groups, and monitoring dashboards |
| `/monitor/*` | Status monitor, logs, and settings |
| `/proxy/*` | Proxy dashboard, configurations, mobile connection, and inspector |
| `/apis/*` | API dashboard, schemas, logs, mocking, and settings |
| `/ux/*` | Policies and Live Capture |
| `/settings`, `/profile`, `/about`, `/server-logs` | Settings, Profile, About, Server logs |

`routeTree.gen.ts` is auto-generated — do not edit it manually.

### Backend Layering

```
command/  →  service/  →  model/ + storage/
```

| Convention | Description |
|------|------|
| Command Arguments | Must accept a single `payload` struct, marked `#[serde(rename_all = "camelCase")]` |
| Command Responses | Wrapped in `ApiResponse<T>` (`success`, `message`, `data`) |
| Join Tables | Suffix with `*_link` (e.g. `domain_group_links.json`) |
| Errors | Return Rust `Result` and propagate using `?`. Avoid `unwrap()` |
| Serialization | Fields communicated to the frontend must use camelCase |

### Frontend ↔ Backend

| Rule | Description |
|------|------|
| Types & Invocation | Import from `@/shared/api` (avoid direct imports from `bindings.ts`) |
| Response Handling | Use `unwrap(result)` or branching on `result.status` |
| Naming Conventions | PascalCase for components, camelCase for functions/variables, CONSTANT_CASE for constants |
| Export Convention | Avoid default exports (except for TanStack Router route files) |
| Styles & Linting | Biome configurations (`biome.json`) serve as the single source of truth |

### Data Storage

Data is stored as JSON under Tauri's `app_data_dir` (wrapped in a structure containing `schema_version` and `data`). `storage::migration::run_all()` runs on startup.

| File | Purpose |
|------|------|
| `domains.json` | Domain masters |
| `groups.json` / `domain_group_links.json` | Groups and n:n links |
| `domain_monitor_links.json` / `logs/` | Monitor settings & daily logs |
| `domain_local_routes.json` | Local routes for proxy |
| `proxy_settings.json` | Proxy ports and DNS configurations |
| `domain_api_logging_links.json` | API logging target links |
| `scenarios.json` / `mock_rules.json` | Mocking scenarios and rules |

### Error Handling

| Layer | Strategy |
|------|------|
| Rust Command | Return business or network errors via `ApiResponse<T>` |
| Proxy | Handle failures per request/response unit (`service/local_proxy/handler/`) |
| FE | Apply `typedError` + `unwrap()`. Backend invoke exceptions are rare |
| UI | Error boundaries are not used (SPA inside Tauri, API responses handle errors) |

### Security (Intentional Settings)

Due to proxying, MITM, and external device integration requirements, the following settings are **intentional**:

| Config Setting | Reason |
|------|------|
| `csp: null` | Required for injection of custom scripts on proxy pages |
| Opener `url: "*"` | Needed for setup URLs, tunneling, and external IP connections |
| `danger_accept_invalid_certs` | Necessary for handling TLS in MITM proxies |
| File System Write | Required for exporting CA certificates and backing up settings |

---

## Development Workflow

### Local Hooks (Husky pre-commit)
- `biome check --write` (via lint-staged)
- `tsc --noEmit`

### CI Integration (`.github/workflows/ci.yml`)
| Job | Checks |
|-----|------|
| `frontend` | Runs `biome ci src` and `pnpm type-check` |
| `rust` | Runs `cargo clippy -D warnings` and `cargo test` |

---

## Release History

Please see [CHANGELOG.md](./CHANGELOG.md) for detailed version history and updates.

---

## Author & License

- **Author**: 규연 (Administrator)
- **Copyright**: Copyright (c) 2026 규연. All rights reserved.
- **License Terms**:
  - **Installer core features**: Free of charge for both personal and commercial use.
  - **Paid features**: If additional paid features are added in the future, using those features may require a separate payment or subscription.
  - **Source Code Copyright**: The copyright of the source code belongs entirely to '규연'. Unauthorized copying, distribution, or modification is strictly prohibited. Please see [LICENSE](./LICENSE) for more details.
