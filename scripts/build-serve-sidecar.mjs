/**
 * Build horizon-gateway-serve and copy to Tauri bundle staging.
 *
 * Output: src-tauri/hg-gui/binaries/horizon-gateway-serve-{target-triple}[.exe]
 * build.rs copies this into resources/ for NSIS bundling.
 *
 * Usage: node scripts/build-serve-sidecar.mjs [--debug]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = path.join(root, "src-tauri");
const binariesDir = path.join(tauriDir, "hg-gui", "binaries");
const debug = process.argv.includes("--debug");
const profile = debug ? "dev" : "release";
const targetSubdir = debug ? "debug" : "release";

function hostTriple() {
	const result = spawnSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" });
	if (result.status !== 0) {
		throw new Error("rustc --print host-tuple failed");
	}
	return result.stdout.trim();
}

function run() {
	const triple = hostTriple();
	const ext = process.platform === "win32" ? ".exe" : "";

	console.log(`[build-serve-sidecar] cargo build -p horizon-gateway-serve (${profile})…`);
	const build = spawnSync(
		"cargo",
		["build", "-p", "horizon-gateway-serve", "--profile", profile],
		{
			cwd: tauriDir,
			stdio: "inherit",
			shell: process.platform === "win32",
		},
	);
	if (build.status !== 0) {
		process.exit(build.status ?? 1);
	}

	const src = path.join(tauriDir, "target", targetSubdir, `horizon-gateway-serve${ext}`);
	const dest = path.join(binariesDir, `horizon-gateway-serve-${triple}${ext}`);

	if (!fs.existsSync(src)) {
		console.error(`[build-serve-sidecar] missing built binary: ${src}`);
		process.exit(1);
	}

	fs.mkdirSync(binariesDir, { recursive: true });
	fs.copyFileSync(src, dest);
	console.log(`[build-serve-sidecar] → ${dest}`);
}

run();
