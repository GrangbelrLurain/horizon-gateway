# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [v2.1.2] - 2026-07-07

### Added

- **Windows CLI Console Attachment**: Configures release builds on Windows to dynamically attach to the parent console (`AttachConsole`) in CLI mode, ensuring `println!` outputs are visible when run from the command line.

## [v2.1.1] - 2026-07-07

### Added

- **Installer PATH Option**: Added a custom user-consent confirmation prompt during Windows (NSIS) installation to safely append the `watchtower.exe` installation directory to the user's `PATH` environment variable.
- **Silent Mode Handling**: Integrates `IfSilent` checks in the installer post-install hook to bypass the PATH prompt and modification during background auto-updates, ensuring smooth updates.
- **Installer PATH Cleanup**: Automatically cleans up the user's `PATH` environment variable on uninstallation.

## [v2.1.0] - 2026-07-06

### Added

- **Headless CLI Mode**: Run `watchtower cli list`, `help`, and `run` from the terminal without launching the GUI. All Tauri commands are exposed with JSON payloads and optional `--query` projection for token-efficient agent output.
- **Agent Skill Installer (`cli init`)**: Install bundled `SKILL.md` and `logs.mjs` to coding-agent skill directories (`cursor`, `claude`, `codex`, `gemini`, `copilot`, `windsurf`, `all`, or `auto`). Supports `--project` for `.agents/skills/watchtower/` and `--print` to output skill content without installing.
- **Disk Log Reader Script**: `logs.mjs` reads API logs directly from the app data directory (Windows, macOS, Linux) without starting Watchtower — bundled for agent skill distribution.
- **Tauri Env Loader**: `pnpm tauri` now loads `.env` via `scripts/tauri-env.mjs` before invoking the Tauri CLI.

### Changed

- **CLI Log Verbosity**: Suppresses trace/debug logs in CLI mode (`LevelFilter::ERROR`) to keep agent-facing stdout clean.

## [v2.0.1] - 2026-07-06

### Changed

- **Client-Side API Log Filtering**: Refactored the API Logs view (`src/routes/apis/logs/index.tsx`) to fetch all logs for the selected date and apply filters (method, host, path/search) client-side using `useMemo`. This replaces server-side filtering on input change, eliminating excessive API request firing and improving responsiveness.

### Fixed

- **Mock Rule Card Layout Overflow**: Fixed layout overflow issues on the Mocking page rules dashboard cards (`src/routes/apis/mocking/index.tsx`) by introducing proper flex container bounds (`min-w-0`, `flex-1`, and `shrink-0`) to truncate long URL patterns and hosts gracefully without breaking action buttons.
- **FlowBuilder Props Mapping Formatting**: Cleaned up code layout and formatting rules inside mapping functions in the sandbox FlowBuilder component (`src/features/sandbox/ui/FlowBuilder.tsx`).

## [v2.0.0] - 2026-06-28

### Added

- **Sandbox Data Pipeline JSX/TSX Monaco Editor Integration**: Upgraded the plain `textarea` React Component code editor in the Sandbox Data Pipeline properties panel to use the high-performance `TsCodeEditor` (Monaco).
  - Enables full TSX/JSX syntax highlighting, auto-formatting, and autocomplete suggestions.
  - Dynamically resolves properties and structures based on either the pipeline's runtime output data (dynamic props from parent nodes) or the selected JSON validation schema.
- **Dynamic Live Rendering Canvas Nodes**: Upgraded the Preview Node (`PreviewNodeComponent`) on the ReactFlow canvas to compile and render your JSX code inside a nested live rendering iframe directly inside the graph layout after successful pipeline execution.

### Fixed

- **Monaco Multi-Editor Input Collision**: Resolved a critical bug where having multiple Monaco editors (e.g. Target Keys, Source Expressions, and Preview code) active simultaneously would cause keyboard inputs to freeze or values to overwrite each other.
  - Generates unique in-memory model paths (`file:///preview_${editorKey}.tsx` etc.) for each editor instance to isolate Monaco text buffers.
  - Scopes global autocomplete providers and type definitions (`.d.ts` declarations) to their respective editor instance to prevent token bleeding.

## [v1.8.1] - 2026-06-11

### Fixed

- **Next.js HMR WebSocket Proxy Connection**: Resolved connection failures (such as `400 Bad Request` and `upgrade expected but low level API in use` errors) for Next.js Hot Module Replacement (`/_next/webpack-hmr`) WebSocket connections.
  - Implemented raw HTTP/1.1 client connection upgrades (`hyper::client::conn::http1::handshake`) for local routing.
  - Formatted upstream upgrade requests with relative path-and-query URIs compatible with HTTP/1.1 origin servers.
  - Rewrote target `Host` and `Origin` headers to bypass Next.js CORS and Host verification rejections.
  - Enabled connection upgrades by calling `.with_upgrades()` on both client-side and server-side connection builders.

## [v1.8.0] - 2026-06-10

### Added

- **Android USB Connection Tab**: Redesigned the Mobile Connection page (`/proxy/mobile`) into a two-tab layout:
  - **Wireless Connect (Wi-Fi / VPN)**: Existing Tailscale VPN and Cloudflare tunnel-based handoff flow.
  - **USB Connect (Android Only)**: New tab for direct USB cable debugging via ADB reverse port forwarding.
- **ADB Auto-Detection**: Backend automatically finds the `adb` binary by scanning:
  - System `PATH`.
  - Standard Android SDK platform-tools locations on Windows (`%LOCALAPPDATA%/Android/Sdk/platform-tools/adb.exe`).
  - macOS paths including Homebrew (`/opt/homebrew/bin/adb`, `/usr/local/bin/adb`).
- **USB Device Status Panel**: The USB tab shows ADB installation status (path, version), lists all connected Android devices by serial number, and provides a one-click Refresh button.
- **ADB Installation Guide**: When ADB is not found, the UI shows platform-specific installation instructions with one-click copy commands (`choco install adb` / `brew install --cask android-platform-tools`).
- **USB Port Tunneling Switch**: A toggle to activate/deactivate `adb reverse tcp:PORT tcp:PORT` for the configured proxy port.
- **Automated Android System Proxy Injection**: Upon activating the USB tunnel, Watchtower automatically injects the system-wide proxy settings directly into connected Android devices via ADB, eliminating manual Wi-Fi proxy configuration:
  - **Enable**: `adb -s <serial> shell settings put global http_proxy 127.0.0.1:PORT`
  - **Disable**: Clears and deletes all global proxy keys on switch off or page exit.
- **iOS Unsupported Warning Card**: Explicit notice in the USB tab explaining why iOS does not support USB reverse tunneling (Apple sandbox limitations), with guidance to use the Wireless tab instead.

### Changed

- **Hardcoded Port Cleanup**: Removed all hardcoded `8888` (proxy) and `13030` (Axum handoff server) values across the codebase:
  - Frontend USB guides now use the live `proxyStatus.port` value dynamically.
  - `landing.html` now uses a `{{AXUM_PORT}}` template placeholder injected by `tunnel_service.rs` at runtime.
- **USB Guide Step 3 Rewritten**: Replaced the manual Wi-Fi proxy configuration instruction with a note that proxy settings are now **automatically injected by Watchtower** and advises users to revert any previously set manual proxy to "None".

### Fixed

- **Tauri App "Not Responding" (응답 없음) on Mobile Page**: Resolved a critical deadlock that caused the application window to freeze when navigating to the Mobile Connection page.
  - **Root cause**: USB Tauri commands (`check_adb_status`, `start_usb_reverse`, `stop_usb_reverse`) were synchronous (`fn`), blocking the main GUI thread. When the ADB daemon was not running, `Command::output()` on `adb devices` would block indefinitely as the spawned background daemon process inherited the piped stdout/stderr file handles.
  - **Fix 1**: Converted all USB Tauri commands to `async fn` to offload execution to Tokio's thread pool.
  - **Fix 2**: Implemented an `ensure_adb_server()` helper that runs `adb start-server` with `Stdio::null()` before any command that pipes output, safely starting the daemon without creating a deadlock.
- **Android "망 접속 안됨" (No Network Access)**: Resolved the issue where the device lost internet access after configuring `127.0.0.1` as a Wi-Fi proxy.
  - **Root cause**: Android OS ignores or blocks loopback addresses (`127.0.0.1`) entered via the Wi-Fi settings UI, rendering the device network-inaccessible.
  - **Fix**: Replaced manual proxy configuration instructions with the automated `adb shell settings put global http_proxy` injection approach, which correctly applies the proxy at the system level and bypasses Android UI restrictions.

## [v1.7.6] - 2026-06-08

### Added

- **Domain Dashboard Copy Button**: Added a copy dropdown to `/domains/dashboard` with two formats:
  - **Domain + Group Name Copy**: Copies domains with their group names in `domain.com (Group A, Group B)` format.
  - **Domains by Group Copy**: Copies domains organized by group sections.
- **API Logs Copy Dropdown**: Replaced single copy button in the log detail modal with a dropdown offering two copy modes:
  - **Copy as HTML**: Copies rich HTML with inline styling, optimized for Azure DevOps ticket comments.
  - **Copy as Markdown**: Copies dual-clipboard (HTML + Markdown plain text), optimized for Microsoft Teams sharing.
- **API Schema Copy Dropdown**: Applied the same copy dropdown policy to `/apis/schema` response cards, positioned in the endpoint header bar alongside History/Send buttons.
- **Promise-based Alert Modal**: Introduced `usePromiseModal` for non-blocking copy confirmation feedback across all copy actions.

### Changed

- **Copy Markdown Format**: Refactored markdown template generation from template literals to `Array.join("\n")` for precise line control, fixing indentation and extra whitespace issues in pasted output.
- **Log Detail Modal Layout**: Restructured the API log detail modal with block-styled headers and JSON pretty-printing for better readability and copy fidelity.

## [v1.7.5] - 2026-06-08

### Added

- **Tauri Specta v2 Integration**: Replaced the manual, error-prone `invokeApi` wrapper and `ApiCommandMap` definitions with automatically generated type-safe TypeScript command bindings.
- **Type Safety and Import Alignment**: Updated all global store atoms (such as `globalSiteCheckAtom`) and route files to utilize the new Specta types, resolving all type incompatibilities.

### Changed

- **Direct Command Binding Calls**: Refactored frontend components to invoke camelCase backend commands directly from `src/bindings.ts` with a unified `unwrap` helper.
- **Opener Plugin Guest Bindings**: Migrated standard tauri-plugin-opener `invoke` calls (`plugin:opener|open` and `plugin:opener|open_url`) in `ux/policies/index.tsx` to use typed official guest bindings (`openPath` and `openUrl`) from `@tauri-apps/plugin-opener`.

### Removed

- **Obsolete API Helpers**: Deleted deprecated helper files (`commands.ts`, `invoke.ts`, and `types.ts` under `src/shared/api`) since the compiler now automatically generates bindings.

## [v1.7.4] - 2026-04-29

### Fixed

- **Mock Rule Registration**: Fixed a critical bug where API mock rules failed to register due to a data structure mismatch between the frontend and backend.
- **Backend Command Refactoring**: Standardized `create_mock_rule` and `update_mock_rule` to use `payload` objects and return consistent `ApiResponse` wrappers.
- **API Type Synchronization**: Updated TypeScript command definitions to perfectly align with the Rust backend's expected input/output structures, ensuring better runtime stability.

## [v1.7.3] - 2026-04-16

### Added

- **Sidebar Status Dot for Inspector**: Added a real-time status indicator to the "UX Policy" and "Inspector" sidebar menus. Users can now instantly see if the inspector/injection engine is active.
- **Improved Sidebar Feedback**: Menu icons now pulse when their respective services (Proxy, Mocking, Inspector) are active, providing better visual feedback.

### Fixed

- **Inspector Setting Persistence**: Resolved an issue where the Inspector's On/Off state was reset after application restart. The state is now correctly persisted in the backend configuration.
- **Service Syncing Logic**: Corrected the synchronization between the `InspectorService` and the `local_proxy` engine to ensure UI toggles are immediately reflected in the traffic interception layer.

## [v1.7.2] - 2026-04-14

### Added

- **Dual View Policy Management**: Introduced a new "Policy List" dashboard with two distinct modes:
  - **Manage Mode**: Interactive cards for easy editing, deleting, and quick access to linked sites.
  - **Report Mode**: A clean, document-style preview optimized for final review and PDF export.
- **Selective Injection Policy**: Enhanced the proxy engine to support selective script injection. Users can now:
  - Toggle injection globally.
  - Define specific domains for injection.
  - If no domains are specified, injection applies globally by default.
- **Report Display Options**: Added toolbar toggles to show/hide specific technical fields (URL, Tag, Selector) in the policy list and PDF report.
- **Dedicated Edit Modal**: Replaced inline editing with a focused modal for updating policy titles and descriptions.

### Changed

- **UX Navigation Overhaul**: Restructured the sidebar to prioritize policy management, separating the high-frequency "Inspector" capture tool from the "Policy List" management dashboard.
- **Improved "Visit Site" Feature**: Enhanced reliability of external URL opening with multi-layer fallbacks (Tauri Opener v2, shell open, and browser window fallback) and expanded security capabilities.

### Fixed

- **WYSIWYG PDF Export**: Completely redesigned the PDF generation logic using style isolation and fixed-width desktop rendering. This resolves layout breaking, missing padding, and "oklch/oklab" color parsing errors in the generated reports.
- **Proxy CORS Interception**: Fixed a bug where API-logged requests were missing critical CORS headers, preventing cross-origin fetches during live interception.

## [v1.7.1] - 2026-04-13

### Fixed

- **Code Quality & Linting**: Resolved multiple Biome linting errors, including unused type definitions (`Position`), shadowed variables (`handleMouseMove`), and missing block statements in `InspectorPanel` and `InjectionApp`.
- **UI Interaction Stability**: Fixed a shadowing issue in the injection engine's mouse move handler that could potentially cause dragging behavior to conflict with inspection logic.

## [v1.7.0] - 2026-04-13

### Added

- **Robust Injection Engine**: Completely overhauled the inspector injection system. It now features aggressive cache-busting, automatic HTTP/3 fallback to HTTP/1.1/2, and a dual-strategy injection (UTF-8 + Byte-level fallback) to ensure the inspector works on any website, regardless of encoding or caching.
- **Policy List Sidebar**: Added a new "📋" panel in the injected app. Users can now view, manage, and delete all policies associated with the current page, even if their visual badges are misplaced due to DOM changes.
- **Heuristic Element Tracking**: Upgraded the selector generator to use IDs and stable semantic attributes (like `data-testid`). The recovery logic now uses a weighted similarity score to re-anchor policies more accurately when page structures change.

### Changed

- **Proxy Pipeline Optimization**: Enhanced the internal proxy to automatically handle Gzip/Brotli decompression for intercepted traffic, enabling reliable content modification without manual encoding management.
- **Cross-Platform Build CI**: Standardized build scripts to be OS-independent, ensuring seamless releases from GitHub Actions runners.

### Fixed

- **MIME Type Enforcement**: Resolved a "text/html" MIME type error for `inspector.js` by strengthening the internal proxy's path interception and adding explicit caching headers for reserved assets.
- **SSL Interception Toggle**: Fixed an issue where the global inspector state wasn't correctly propagated to the SSL decryption layer.

---

## [v1.6.2] - 2026-04-08

### Added

- **Responsive UI Rollout**: Implemented a comprehensive responsive layout down to `720px` (tablet) across Settings, Proxy Dashboard, and Monitoring pages.
- **Persistent Mocking State**: Enhanced the API Mocking experience by persisting selected scenarios, mocking search queries, and the global mocking toggle in local storage across sessions.

### Changed

- **Dynamic Grid Optimization**: Refactored dashboard and monitor grids to use CSS Grid `auto-fill` with `minmax` constraints, ensuring consistent card sizing and graceful wrapping across all resolutions.
- **Virtualized Grid Responsiveness**: Added a `ResizeObserver`-based column calculation to the domain monitor's virtualized list, preserving performance while adapting to container width changes.

### Fixed

- **Dark Mode Audit & Polish**: Resolved broken UI rendering issues in Proxy Setup, Loading screens, and Empty States by replacing hardcoded slate/white colors with semantic theme variables.
- **A11y & Linting**: Resolved sidebar accessibility warnings and fixed missing React hooks and block statement lint errors in monitoring components.

---

## [v1.6.1] - 2026-04-08

### Added

- **Global Proxy Safeguard (`ProxyServerWarning`)**: Created a premium, reusable warning component that indicates when the proxy engine is inactive across all features.
- **Unified Proxy Infrastructure Control**: Relocated the master Proxy Server switch and detailed port settings (Forward/Reverse HTTP/HTTPS) to the global Settings page for centralized infrastructure management.

### Changed

- **Feature-Level Proxy Awareness**: Integrated the `ProxyServerWarning` into Dashboard, Proxy Dashboard, API Logs, API Mocking, and Server Logs.
- **Improved UI Masking**: Functional elements (buttons, lists, filters) in Proxy-dependent pages are now conditionally hidden when the server is OFF to prevent user confusion.
- **Localized Proxy Guidance**: Updated Korean and English dictionaries with clear instructions on how to reactivate the proxy engine directly from the warning component.

### Fixed

- **Proxy Setup Pathing**: Corrected internal navigation links within the Setup Guide to ensure seamless flow between setup and dashboard views.
- **Server Logs Consistency**: Resolved a UI overlapping issue where functional controls were still visible through the proxy warning alert.

---

## [v1.6.0] - 2026-04-08

### Added

- **Unified StatusToggle Component**: Introduced a premium, high-feedback toggle component (`StatusToggle`) to standardize feature activation across all dashboards.
- **Interactive Home Dashboard**: Transformed passive status badges on the home screen into active toggles. Users can now control **Mocking** and **Proxy Active** (Local Routing) directly from the header.
- **Advanced Proxy Controls**: Integrated full Start/Stop server controls into the Proxy Dashboard using the new unified toggle UI, replacing legacy buttons and static badges.

### Changed

- **UI/UX Consistency**: Synchronized the design language for feature toggles (Mocking, Proxy, Local Routing) across the entire application for a more cohesive, high-end experience.
- **Real-time Feedback**: Added integrated loading states to all major feature toggles, providing immediate visual confirmation during asynchronous backend operations.

### Fixed

- **Dashboard Accessibility**: Resolved multiple WCAG compliance issues by properly associating form labels with their respective inputs using unique IDs.
- **API Scoping Precision**: Enhanced Mock Rule logic to include optional `Host (Origin)` filtering, allowing for domain-specific mocking behavior.

---

## [v1.5.2] - 2026-04-03

### Changed

- **Unified Multi-Group Management**: Refactored Monitoring and API Setting dashboards to display domains independently under each assigned group section, removing legacy comma-separated headers.
- **Synchronized Selection Tracking**: Implemented ID-based unified selection logic. Checking a domain in one group section now automatically updates all of its other occurrences across the dashboard.
- **Refined Registration Workflow**: Removed automatic navigation and background monitoring sync upon new domain registration, allowing for a more controlled setup process.

### Fixed

- **Registration Group Matching**: Resolved a bug where domains could be assigned to incorrect groups during bulk registration due to UI state desynchronization.
- **Search Scope Expansion**: Enhanced dashboard search to include both domain URLs and group names for more comprehensive results.

---

## [v1.5.1] - 2026-04-03

### Added

- **Enhanced Domain Group Management**: Redesigned the "Assign Domains" modal with a search bar, group-based filtering, and cross-group membership visibility (badges showing other assigned groups).
- **Smart Home Dashboard Stats**: Integrated real-time API request counting for the "Today" stats on the home dashboard, replacing previous static/incorrect counts.

### Changed

- **UI Refinement (Border Radius)**: Optimized the global modal border radius from `2.5rem` to `3xl` (24px) for a sharper, more professional look, along with internal element radius adjustments.
- **Flattened Monitoring Groups**: Domains belonging to multiple groups are now displayed in each group's section independently, rather than creating a combined group header.
- **Empty State Modernization**: Overhauled all "Empty State" visuals across Domain and Monitor dashboards with theme-aware dashed borders and glowing icon effects.

### Fixed

- **Modal Context Stability**: Resolved a critical "Modal provider" error that caused the application to crash when opening certain domain management modals.
- **Z-Index Collisions**: Fixed minor layering issues where the sidebar glow effect could overlap with open modals.

---

## [v1.5.0] - 2026-04-03

### Added

- **Dynamic Theme Personalization**: Linked the app's `primary-color` to the user's selected avatar theme. The entire UI color scheme (Sidebar highlights, buttons, loading bars, icons) now updates in real-time based on the user's profile choice.
- **Theme-Aware Confirmation System**: Replaced native browser alerts with a premium, theme-consistent `ConfirmModal` for sensitive actions like API and domain deletion.

### Changed

- **UI Modernization (DaisyUI v4)**: Fully transitioned all hardcoded slate/white styles to semantic DaisyUI variables throughout the Monitoring, API Schema, and Proxy dashboards.
- **Dashboard Aesthetic**: Standardized all dashboard cards with `rounded-[2rem]` or `rounded-[3rem]` and enhanced typography (`font-black`) for a more modern, premium feel.
- **API Schema UX**: Redesigned the "Empty State" for the API Schema explorer with better instructions and a theme-consistent visual call-to-action.

### Fixed

- **Server Logs Visibility**: Resolved contrast issues in the Log Viewer where timestamps and labels were illegible in Light Mode. Applied a theme-independent high-contrast terminal styling.
- **Sidebar Icon Matching**: Synchronized Sidebar icon colors and hover states with the dynamic primary theme to fix visual imbalance.
- **Monitor Grouping Constraints**: Fixed a layout bug where `overflow-scroll` was clipping card borders and shadows in grouped monitoring views.

---

## [v1.4.10] - 2026-04-02

### Added

- **Isolated Window Persistence**: Introduced `atomWithWindowStorage`, a new persistence strategy that isolates UI state by window label. This allows multiple API windows to have their own independent selection and search history while maintaining data in `localStorage`.
- **Inherited Initial Context**: Detached windows now automatically clone the current state of the "main" window upon opening, providing immediate context that can then diverge independently.

### Changed

- **API Context Isolation**: Switched `/apis/schema` and `/apis/logs` to use isolated persistence. This allows users to open multiple documentation and log viewers for different domains simultaneously without synchronization conflicts.

### Fixed

- **Rust Build Compatibility**: Resolved compilation errors on Darwin (macOS) targets related to `WebviewWindowBuilder::transparent` and type inference in `window_commands.rs`.
- **Rust Code Quality**: Cleaned up various `unused_mut`, `unused_imports`, and `dead_code` warnings in `local_proxy.rs` to ensure a completely clean build.

---

## [v1.4.9] - 2026-04-02

### Added

- **Multi-Window State Synchronization**: Refined `atomWithBroadcast` with remote update locking and value equality checks to eliminate infinite render loops across detached windows.
- **Universal Detach Support**: Added a generic "Detach" button to the titlebar, allowing any page (including the root Dashboard) to be pulled into a standalone window.
- **Security Capability Expansion**: Updated Tauri's capability configuration to grant all detached windows (`*` label) permission to listen to backend events and invoke APIs.
- **Context-Aware Sync Strategy**:
  - **Global Data Broadcast**: Synchronizes true backend data (domains, proxy routes, logs) across all windows in real-time.
  - **Local View Persistence**: Isolated UI-only states (search queries, filters, scroll positions) per window to prevent "ghost typing" while inheriting initial state via `atomWithStorage`.

### Changed

- **Server Logs UI**: Cleaned up duplicated search inputs and improved the header layout for better space efficiency.
- **Window Lifecycle**: Refined sub-window management to ensure all detached windows close gracefully when the main application window is exited.

---

## [v1.4.8] - 2026-03-31

### Added

- **Server Logs Dashboard**: Implemented a high-performance terminal-style log viewer for real-time Rust backend and proxy traffic monitoring.
- **Log Level Filtering**: Added a multi-level filter (DEBUG, INFO, WARN, ERROR) to the server logs to isolate specific events.
- **Advanced Log Detail View**: Integrated a detailed modal view for logs with support for:
  - **DNS Record Parsing**: Specialized visualization for DNS response dumps (Hickory Resolver) with color-coded records (CNAME, A, etc.).
  - **Pattern Highlighting**: Automatic syntax highlighting for IP addresses, HTTP methods, and status codes.
- **Log Control**: Added Pause/Resume functionality to stabilize the view during high-traffic periods and a 10,000-line virtualized scroll buffer.

### Fixed

- **TanStack Router Warnings**: Optimized route tree scanning by configuring `routeFileIgnorePattern` for non-route internal files (`en.ts`, `ko.ts`, `store.ts`).

---

## [v1.4.7] - 2026-03-30

### Added

- **Domain Dashboard Functional Hub**: Transformed the domain list into a centralized hub for managing monitoring, proxying, and API logging in-place.
- **In-line Feature Toggling**: Users can now toggle Monitoring, Proxy Local Routing, and API Logging status directly on each domain card without navigating away.
- **Direct Proxy Route Addition**: Integrated a mini-modal to add local proxy routes from the domain list, eliminating the need to visit the proxy dashboard for basic setup.
- **Proxy Status Context**: Added real-time global proxy status awareness and guidance (e.g., toast banners) when trying to manage routes while the proxy is stopped.

### Changed

- **Domain Row UI**: Redesigned domain rows to accommodate feature badges while maintaining a clean, premium aesthetic with improved spacing and animations.
- **Modal UX**: Rewrote proxy route modals to use Portals for better stacking in virtualized lists and improved field alignment for a more professional feel.

---

## [v1.4.6] - 2026-03-30

### Added

- **Persistent Page State Management**: Implemented route-level Jotai stores for all major pages to maintain UI state (search queries, filters, input fields) across navigation.
- **API Schema Persistence**: Enhanced the API schema explorer to remember selected domains, endpoints, and individual form data per endpoint, surviving app restarts via `atomWithStorage`.
- **Expanded Filter Persistence**: Migrated monitor and API logs to use `atomWithStorage` for filter settings, ensuring selections persist across app reloads.
- **Proxy Dashboard Memory**: Port settings and route addition inputs now persist across page changes.

### Changed

- **State Architecture**: Refactored application state to a modular "route-level store" pattern for better maintainability and performance.

---

## [v1.4.5] - 2026-03-27

### Added

- **User Profile System**: Integrated a persistent user profile system using Jotai (`atomWithStorage`). Users can now customize their name, role, and avatar theme (gradients).
- **Onboarding Flow**: Added a premium first-time onboarding modal that greets new users and guides them through account setup and language selection.
- **Standalone Profile Page**: Created a dedicated `/profile` route for managing personal information and language preferences, providing a focused space for user customization.

### Changed

- **Sidebar Redesign**:
  - Removed the top logo section for a minimalist, sophisticated aesthetic.
  - Replaced hardcoded profile data with dynamic atom-based data.
  - Decoupled Profile Settings and General Settings click targets to prevent overlapping event issues.
- **Settings Refinement**: Migrated language preferences from global settings to the Profile page.

### Fixed

- **A11y (Accessibility)**: Resolved multiple labeling inconsistencies and ensured all inputs on the onboarding and profile pages are correctly associated for screen-reader support.

---

## [v1.4.4] - 2026-03-27

### Changed

- **Routing Structure**: Migrated file-based routes (`*.tsx`) across `apis`, `domains`, `monitor`, and `proxy` to a folder-based structure (`*/index.tsx`) for better code organization and collocation of localization files.
- **Localization (i18n)**: Fully decoupled hardcoded UI text in domain feature components (`DomainListEmpty`, `EditDomainModal`, `GroupSelectModal`, `GroupCard`, etc.) by passing translation dictionaries via props. Refined Korean dictionaries for a more natural UX.

### Fixed

- **Logs UI Layout**: Fixed an issue where grid and flex layouts were completely broken on `/monitor/logs` and `/apis/logs`. The root cause was an overly broad `logs` entry in `.gitignore` that caused Tailwind v4 to abruptly skip scanning any directory named `logs` for utility classes.

---

## [v1.4.3] - 2026-03-26

### Fixed

- **Proxy Infinite Loop**: Fixed an issue where the `reqwest` client would pick up the OS system proxy (Watchtower itself), causing an infinite request loop. Added `.no_proxy()` to bypass system settings.
- **Local Route Streaming**: Fixed a bug where local route requests were fully buffered into memory when API logging was disabled. Now uses a fast streaming body path to support SSE and chunked streams properly.
- **Root Path 404 Error**: Fixed the Axum router configuration to correctly match the root `/` path. Previously, the `/*path` rule failed to match `/`, leading to unexpected 404 errors.
- **GET Request Body Error**: Fixed a bug where `GET`, `HEAD`, and `OPTIONS` requests were assigned an empty body stream, causing `reqwest` to append a `Transfer-Encoding: chunked` header which was rejected by Next.js/Node servers.
- **Garbled Text Rendering**: Fixed an issue where compressed responses (like `gzip` or `br`) appeared as garbled text in the browser. The proxy now preserves the `content-encoding` header, allowing the browser to decode it correctly.

---

## [v1.4.2] - 2026-02-27

### Added

- **Docs**: Aligned architecture design with the new 9-step development roadmap.
  - Defined new data models: SubPage, TestScenario, ScenarioStep, and MockRule.
  - Detailed the API Chaining pipeline (variable extraction & template substitution).
  - Integrated Golden Master (Mocking) interceptor logic into the Proxy architecture.
  - Specified the Sequential Migration (Migration Chain: v1->v2->v3) strategy.

### Changed

- **Monitoring**: Expanded monitoring scope to include per-route health checks for sub-pages.
- **Architecture Models**: Updated project overview diagrams and unified backend command specifications.
- **UI**: Updated icons across the application.

---

## [v1.4.1] - 2026-02-20

### Added

- **API Logs System** (`/apis/logs`): Full implementation of request/response logging (Phase 2).
  - Daily JSONL log rotation with file management.
  - Logs Dashboard with filtering by Date, Method, Host, and Path.
  - Detail view for request/response headers and bodies.
- **API History & Replay**: Schema Viewer now has a "History" button to view log entries for the selected endpoint.
- **Request Replay**: One-click to populate request headers and body from historical logs into the Schema test form.
- **API Log Filter**: `get_api_logs` backend command extended with `exact_match` filter support for precise endpoint lookup.

### Changed

- **Schema UI**: Improved Domain Selector design (Card-based) and overall Schema Viewer layout responsiveness.
- **UI Refinement**: Fixed button shrinking and text wrapping issues on mobile layouts across Dashboard and Logs pages.
- **Code Quality**: Fixed `ApiLogEntry` property naming (snake_case) consistency between frontend and backend.
- **Icons**: Added missing Lucide icons (`Clock`, `X`) to Schema Viewer.

---

## [v1.4.0] - 2026-02-13

### Added

- **APIs section**: New sidebar section "APIs" with Dashboard, Settings, Schema, and Logs (Logs placeholder).
- **APIs Dashboard**: Per-domain API logging—register domains, toggle logging/body, set Schema URL, download OpenAPI schema from URL. Cascade delete of API logging links when a domain is removed.
- **APIs Settings** (`/apis/settings`): Two-panel UI for domain registration/unregistration with group-based sections and search (same pattern as Monitor Settings).
- **API Schema viewer** (`/apis/schema`): OpenAPI 3.x JSON viewer—select domain, browse tag-grouped endpoints, fill parameters/body, send request (Try-it-out), view response. Custom headers collapsible; compact parameter layout.
- **Schema URL & download**: `DomainApiLoggingLink` now has `schemaUrl`; backend commands `download_api_schema` and `get_api_schema_content` for fetching and storing schemas under `{app_data}/schemas/{domain_id}.json`.
- **Send API request**: Backend `send_api_request` command (reqwest, TLS skip, 30s timeout) returns status, headers, body, elapsed time; errors returned as ApiResponse for clear UI feedback.
- **OpenAPI parser**: Frontend `openapi-parser.ts` for endpoint extraction, `$ref`/`allOf` resolution, and example JSON generation.
- **Version bump scripts**: `pnpm version:patch`, `version:minor`, `version:major` to sync version across `package.json`, `tauri.conf.json`, and `Cargo.toml`.

### Changed

- **Proxy always-on**: Proxy auto-starts on app launch; start/stop buttons removed. "Local routing" toggle controls whether traffic is routed to local backends or passed through; port settings (forward + reverse) consolidated in one card.
- **Proxy auto-start errors**: Persistent error state and banner when proxy fails to start (e.g. port in use); manual retry via dashboard.
- **Monitor rename**: "Status" renamed to "Monitor"—routes `/status` → `/monitor`, "Status Check Settings" → "Monitor Settings", "Live Status" → "Live Monitor". Backend `DomainStatus` → `DomainMonitorLink`, `domain_status.json` → `domain_monitor_links.json` with migration.
- **Monitor Settings**: Group-based collapsible UI and search (URL or group name); fixed scroll-to-top bug on checkbox click by moving ListItem out of parent component.
- **Docs**: `docs/plans/` restructured to `docs/architecture/`; added `docs/TODO.md` for implementation checklist. New/updated docs: 05-monitor (group UI), 07-apis (Dashboard, Settings, Schema viewer), 09-domain-use-cases, 10-json-schema-migration.

### Fixed

- **HTTPS CONNECT**: Fixed request body stream blocking in `forward_to_backend` (reconstruct request for GET/HEAD/etc. to avoid blocking on TLS-terminated body).
- **PAC file**: Forward proxy now passes its port to `ProxyState` so `/.watchtower/proxy.pac` is generated correctly.
- **Certificate download**: Setup page certificate download now uses HTTP proxy port (`http://127.0.0.1:{port}/.watchtower/cert/...`) instead of HTTPS target URL, avoiding chicken-and-egg trust issue.
- **Schema viewer base URL**: Domain URL already containing scheme (e.g. `https://api.example.com`) no longer double-prefixed as `https://https//...`.

---

## [v1.3.2] - 2026-02-12

### Added

- **Search domains in proxy**: Added search domains support in proxy feature.
- **Version display**: App version is now shown on the Home page hero section (from `tauri.conf.json`).
- **Docs consolidation**: Project docs moved from `.agent/workflows` to `docs/` (Human·Agent shared). Added `.agent/README.md` and `.cursor/README.md` as pointers.
- **YAML frontmatter**: All docs now have consistent frontmatter (`title`, `description`, `keywords`, `when`, `related`). Keywords unified in Korean.

### Changed

- **Route restructure**: Split dashboards (`/domains/dashboard`, `/proxy/dashboard`), reorganized status routes (`/status` with index, logs, settings).
- **Docs structure**: Standardized `related` path format; updated docs/README with document map and directory structure.

---

## [v1.3.1] - 2026-02-11

### Fixed

- **Pubkey alignment**: Fixed updater public key to match the signing key used in CI. In-app update install and verification now work correctly (resolves "signature was created with a different key" error).

---

## [v1.3.0] - 2026-02-11

### Added

- **Auto-update notifications**: App checks for updates on startup (3s delay) and shows a notification banner when a new version is available.
- **Settings page**: "Check for updates" button for manual check.
- **Signed updates**: Tauri updater plugin with GitHub Releases; requires signing keys. See "Updater Setup" in README.

---

## [v1.2.1] - 2026-02-11

### Added

- **In-app setup page** (`/proxy/setup`): PAC URL, manual proxy, and HTTPS certificate download. "Open Setup Page" button now navigates in-app instead of opening in browser.
- **Host-specific certificate**: Shared `HostCertCache` so TLS and download serve the same cert—installing the downloaded cert now correctly trusts the server. Fixed CN (hostname) and validity dates (no more 1975 issue).
- **Setup page in English**: Both in-app and proxy-served setup pages localized to English.
- **Window startup**: App starts maximized (`maximized: true` in `tauri.conf.json`).

### Changed

- **Setup HTML extraction**: Proxy setup page moved from inline Rust to `src-tauri/resources/setup.html` for easier maintenance.

### Removed

- **Standalone setup app**: `apps/setup` Vite project removed (consolidated into main app).

---

## [v1.2.0] - 2026-02-10

### Added

- **Settings page** (sidebar entry): DNS server (used for proxy pass-through and domain status checks), full settings Export/Import (JSON: domains, groups, links, proxy routes, DNS).
- **Proxy**: Optional DNS server for pass-through; when no route matches, hostnames are resolved via the configured DNS. Domain status checks also use the same global DNS.
- **Domain management**: Domain settings (pencil icon) opens Edit modal: change address (URL) and group in one place.
- **Status Logs**: Level filter (All / Info / Warning / Error) to narrow log list.
- **App identity**: Watchtower tower icon (SVG) applied to sidebar, titlebar, favicon, and window/taskbar.

### Changed

- **UI consistency**: Input, Button (incl. `size="icon"`), Textarea, Badge style unified across pages; raw inputs replaced with shared components where applicable.
- **API**: `update_domain_by_id` now takes optional payload `{ url? }`.

---

## [v1.1.0] - 2026-02-10

### Added

- Row virtualizer on Domains list page for smooth scrolling with large lists.
- Row virtualizer on Status page (per-group) with card grid virtualization.
- Row spacing between virtualized rows on domains and status pages.

### Changed

- **Refactored UI** into feature modules: `features/dashboard`, `features/domains-list`, `features/domain-groups`, `features/domain-status`.
- Extracted reusable components: HeroSection, FeatureGrid, SystemStatusCard, VirtualizedDomainList, DomainRow, GroupSelectModal, DomainListEmpty, CreateGroupCard, GroupCard, AssignDomainsModal, VirtualizedGroupSection.

---

## [v1.0.0] - 2026-02-09

### Added

- **Initial Stable Release** 🚀
- Global Loading Screen with interactive cancel functionality.
- Full History Logs system with daily file rotation.
- Dashboard Hero design and responsive layout.
- Husky + lint-staged for development workflow.
- Unified domain management and real-time status UI.
