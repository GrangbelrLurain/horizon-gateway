<div align="center">

<img src="https://delete-horizon.com/logo-animated.svg" alt="Horizon Gateway Logo" width="100%" />

# Horizon Gateway

### The All-in-One Local Dev-Infra Control Center

**Domain Observability • Local MITM Proxy • OpenAPI Mocking • UI/UX Policy Inspector • Mobile Tunneling • AI Agent CLI**

<p align="center">
  <a href="./README.ko.md"><strong>한국어 문서 (Korean) 🌐</strong></a>
</p>

[![Release](https://img.shields.io/github/v/release/GrangbelrLurain/watchtower?style=flat-square&color=blue)](https://github.com/GrangbelrLurain/watchtower/releases)
[![License](https://img.shields.io/badge/license-Custom-green?style=flat-square)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey?style=flat-square)](#-installation)
[![Built with](https://img.shields.io/badge/built%20with-Rust%20%2B%20Tauri%202%20%2B%20React%2019-orange?style=flat-square)](https://tauri.app)

</div>

---

## 💡 Why Horizon Gateway?

Modern frontend and backend development often requires running **5+ disconnected tools**:
- Charles / Proxyman for HTTPS packet debugging
- Mockoon / Postman for API mocking
- Ngrok / Cloudflare for mobile & remote tunneling
- Browser devtools & spreadsheets for UI/UX guidelines and domain health checks

**Horizon Gateway unites your entire local development and network infrastructure into a single, ultra-lightweight, native desktop application.**

- ⚡ **Native Performance**: Built on Rust & Tauri 2 — over 90% lighter installer size and minimal memory footprint compared to Electron.
- 🤖 **AI Agent-First**: Native CLI (`hgc`) built for direct integration with AI coding assistants (Cursor, Gemini CLI, Claude Code).
- 🧩 **Zero Complex Setup**: Intuitive GUI to switch proxy routes, mock APIs, and inspect web apps with a single click.

---

## ✨ Core Features

### 🌐 1. Domain Health & Live Observability
- Monitor latency, HTTP status codes, and SSL certificate validity across your development, staging, and production domains.
- Group domains logically into project/team clusters with real-time health indicator cards.

### 🔀 2. High-Performance MITM Proxy & Dynamic Routing
- Built-in HTTPS decryption proxy powered by Hyper & Tokio.
- **Dynamic Local Routing**: Seamlessly redirect traffic from live production/staging domains (`*.example.com`) to your `localhost:3000` dev server or a local build directory without touching `/etc/hosts` or DNS.
- PAC script generation with customizable TLS bypass lists (Teams, Slack, Zoom, SSO).

### 🧪 3. OpenAPI Explorer & Scenario-Based Mocking
- Load OpenAPI specifications to inspect endpoints, schemas, and parameter trees.
- Define flexible mock rules (status codes, response delays, custom JSON bodies, and dynamic headers) to prototype without waiting for backend readiness.

### 🎯 4. Live Capture & UI/UX Policy Inspector
- Inject lightweight inspector overlays into monitored web applications.
- Visually pick DOM elements, pin interactive notes, and associate UI/UX design policies with rich Markdown support (`[[` feature links).
- Dynamic theme synchronization with DaisyUI 5 tokens.

### 📱 5. Mobile Debugging & Secure Tunneling
- **ADB Port Forwarding**: Effortlessly route Android mobile traffic into your local proxy.
- **Instant Tunneling**: Expose local servers securely via Tailscale and Cloudflare tunnels for remote QA and cross-device testing.

### 🤖 6. AI Agent Integration (`hgc` CLI)
- Control all proxy routes, mock rules, and domain states directly from your terminal.
- Install native AI agent skills with `hgc init --project` to give Cursor, Gemini CLI, and Claude Code instant control over your dev-infra.

---

## 📥 Installation

Download the latest installer from the **[GitHub Releases](https://github.com/GrangbelrLurain/watchtower/releases)** page:

| OS | Package | Notes |
|----|---------|-------|
| **Windows** | `.msi` / `.exe` | Windows 10/11 (x64) |
| **macOS** | `.dmg` | Universal / Apple Silicon & Intel |

---

## 🚀 Quick Start (1 Minute)

1. **Launch the App**: Open Horizon Gateway and start the local proxy from the sidebar.
2. **Install Root CA**: Click **Settings ➔ Root CA ➔ Export & Install** to enable HTTPS packet inspection.
3. **Add a Route**: Go to **Proxy ➔ Routes**, enter the domain pattern (e.g. `api.example.dev`), and point it to `http://localhost:8080`.
4. **Mock an Endpoint**: Go to **APIs ➔ Mocking**, create a mock rule for `/user/profile`, and test your frontend instantly!

---

## 🤖 AI Agent CLI (`hgc`)

Horizon Gateway includes `hgc`, a fast, elevation-free console client.

```bash
# 1. Initialize AI agent skills in your project
hgc init --project

# 2. List all available commands
hgc list

# 3. View command details and schemas
hgc help get_domains

# 4. Execute commands directly
hgc run get_domains '{}'
```

---

## 🛠️ Tech Stack

- **Desktop Shell**: Tauri 2, Rust, Tokio, Hyper, Axum
- **Frontend UI**: React 19, Vite 7, TanStack Router, Jotai, Tailwind CSS 4, DaisyUI 5
- **Tooling**: TypeScript 5.8, Biome, pnpm

For architecture conventions and contribution instructions, please refer to **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

---

## 📄 License & Author

- **Author**: 규연 (kyuyeon)
- **Copyright**: Copyright (c) 2026 규연. All rights reserved.
- **Changelog**: See [CHANGELOG.md](./CHANGELOG.md) for version history.
