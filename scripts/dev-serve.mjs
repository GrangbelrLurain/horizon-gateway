/**
 * Start only the headless serve backend (proxy / IPC / WinDivert).
 *
 * Usage: pnpm dev:serve
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = path.join(root, "src-tauri");

const child = spawn("cargo", ["run", "-p", "horizon-gateway-serve"], {
	cwd: tauriDir,
	stdio: "inherit",
	shell: process.platform === "win32",
});

child.on("close", (code) => process.exit(code ?? 0));
