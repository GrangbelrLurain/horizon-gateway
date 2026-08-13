/**
 * Full local dev stack: horizon-gateway-serve (backend) + Tauri GUI + Vite.
 *
 * Order matters on Windows: build/start GUI before elevated serve, otherwise
 * serve locks WinDivert sidecars in target/debug and Tauri rebuild fails (os error 32).
 *
 * Usage: pnpm dev:all
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = path.join(root, "src-tauri");

const SERVE_HOST = "127.0.0.1";
const SERVE_PORT = 17345;
const VITE_PORT = 1420;
const SERVE_READY_TIMEOUT_MS = 30_000;
const VITE_READY_TIMEOUT_MS = 180_000;

/** @type {import("node:child_process").ChildProcess | null} */
let serveProcess = null;

function loadDotenv() {
	const envPath = path.join(root, ".env");
	if (!fs.existsSync(envPath)) return;
	for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const index = trimmed.indexOf("=");
		if (index === -1) continue;
		const key = trimmed.slice(0, index).trim();
		const val = trimmed.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
		process.env[key] = val;
	}
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

function runCommand(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			shell: process.platform === "win32",
			...options,
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve(undefined);
			else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
		});
	});
}

function probePort(host, port) {
	return new Promise((resolve) => {
		const socket = net.createConnection({ host, port });
		const done = (ok) => {
			socket.removeAllListeners();
			socket.destroy();
			resolve(ok);
		};
		socket.setTimeout(500, () => done(false));
		socket.on("connect", () => done(true));
		socket.on("error", () => done(false));
		socket.on("timeout", () => done(false));
	});
}

async function waitForPort(host, port, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (await probePort(host, port)) return true;
		await sleep(300);
	}
	return false;
}

async function stopStaleServe() {
	if (!(await probePort(SERVE_HOST, SERVE_PORT))) return;
	console.log(
		"[dev:all] stopping existing horizon-gateway-serve (unlocks target/debug for GUI rebuild)…",
	);
	if (process.platform === "win32") {
		spawn("taskkill", ["/IM", "horizon-gateway-serve.exe", "/F"], {
			stdio: "ignore",
			shell: true,
		});
	}
	await sleep(1500);
}

function serveExePath() {
	const base = path.join(tauriDir, "target/debug/horizon-gateway-serve");
	return process.platform === "win32" ? `${base}.exe` : base;
}

/** Launch serve elevated on Windows (ShellExecute runas → UAC prompt). */
function startServeElevated(exe) {
	if (process.platform !== "win32") {
		serveProcess = spawn(exe, [], {
			cwd: tauriDir,
			stdio: "inherit",
			detached: true,
		});
		return Promise.resolve();
	}

	const escaped = exe.replace(/'/g, "''");
	return new Promise((resolve, reject) => {
		const child = spawn(
			"powershell.exe",
			[
				"-NoProfile",
				"-ExecutionPolicy",
				"Bypass",
				"-Command",
				`Start-Process -FilePath '${escaped}' -Verb RunAs -WindowStyle Hidden`,
			],
			{ stdio: "inherit" },
		);
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve(undefined);
			else reject(new Error(`failed to launch elevated serve (powershell exit ${code})`));
		});
	});
}

async function startServeIfNeeded() {
	if (await probePort(SERVE_HOST, SERVE_PORT)) {
		console.log(`[dev:all] serve already listening on ${SERVE_HOST}:${SERVE_PORT}`);
		return;
	}

	const exe = serveExePath();
	if (!fs.existsSync(exe)) {
		console.warn(`[dev:all] serve binary missing at ${exe}`);
		return;
	}

	console.log("[dev:all] launching serve with UAC elevation…");
	try {
		await startServeElevated(exe);
	} catch (err) {
		console.warn(`[dev:all] elevated serve launch failed: ${err.message ?? err}`);
		return;
	}

	const ready = await waitForPort(SERVE_HOST, SERVE_PORT, SERVE_READY_TIMEOUT_MS);
	if (!ready) {
		console.warn(
			"[dev:all] serve did not open the IPC port in time (UAC denied or startup failed); GUI will run in-process",
		);
		return;
	}

	console.log(`[dev:all] serve ready on ${SERVE_HOST}:${SERVE_PORT}`);
}

function stopServe() {
	if (serveProcess && !serveProcess.killed) {
		console.log("\n[dev:all] stopping serve backend…");
		if (process.platform === "win32") {
			spawn("taskkill", ["/pid", String(serveProcess.pid), "/T", "/F"], {
				stdio: "ignore",
				shell: true,
			});
		} else {
			serveProcess.kill("SIGTERM");
		}
		serveProcess = null;
	} else if (process.platform === "win32") {
		spawn("taskkill", ["/IM", "horizon-gateway-serve.exe", "/F"], {
			stdio: "ignore",
			shell: true,
		});
	}
}

function startTauriDev() {
	console.log("[dev:all] starting Tauri dev (Vite via beforeDevCommand)…");
	return new Promise((resolve) => {
		const child = spawn("pnpm", ["tauri", "dev"], {
			cwd: root,
			stdio: "inherit",
			shell: process.platform === "win32",
		});
		child.on("close", (code) => resolve(code ?? 0));
	});
}

async function main() {
	loadDotenv();
	await stopStaleServe();

	console.log("[dev:all] building workspace (before serve — avoids WinDivert file locks)…");
	await runCommand("cargo", ["build", "-p", "horizon-gateway-serve", "-p", "hgc"], { cwd: tauriDir });
	await runCommand("cargo", ["build", "-p", "horizon-gateway"], { cwd: tauriDir });

	const onExit = () => {
		stopServe();
		process.exit(0);
	};
	process.on("SIGINT", onExit);
	process.on("SIGTERM", onExit);

	const tauriDone = startTauriDev();

	console.log(`[dev:all] waiting for Vite on port ${VITE_PORT} (initial GUI compile)…`);
	const viteReady = await waitForPort("127.0.0.1", VITE_PORT, VITE_READY_TIMEOUT_MS);
	if (!viteReady) {
		console.warn("[dev:all] Vite not ready yet; starting serve anyway");
	} else {
		console.log("[dev:all] Vite ready — starting elevated serve");
	}

	await startServeIfNeeded();

	const code = await tauriDone;
	stopServe();
	process.exit(code);
}

main().catch((err) => {
	console.error("[dev:all]", err.message ?? err);
	stopServe();
	process.exit(1);
});
