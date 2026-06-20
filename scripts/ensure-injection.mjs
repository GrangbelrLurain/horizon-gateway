import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inspectorPath = path.join(root, "src-tauri/resources/inspector.js");

if (!fs.existsSync(inspectorPath)) {
  console.log("inspector.js not found — running pnpm build:injection");
  execSync("pnpm build:injection", { stdio: "inherit", cwd: root });
}
