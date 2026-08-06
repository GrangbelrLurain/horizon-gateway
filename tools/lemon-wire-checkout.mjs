/**
 * Sync Lemon checkout URL / IDs into .env and redeploy webhook.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const CHECKOUT =
  "https://horizon-gateway.lemonsqueezy.com/checkout/buy/7efd50de-94aa-480d-9e41-956234a36f54";
const PRODUCT_ID = "1271176";
const VARIANT_ID = "1987632";
const PROJECT_REF = "fcngkhnadezrggqgwhuk";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

function upsertEnv(path, entries) {
  let raw = readFileSync(path, "utf8");
  if (!raw.endsWith("\n")) raw += "\n";
  for (const [k, v] of Object.entries(entries)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(raw)) {
      raw = raw.replace(re, `${k}=${v}`);
    } else {
      raw += `${k}=${v}\n`;
    }
  }
  writeFileSync(path, raw);
}

upsertEnv(".env", {
  VITE_LEMON_SQUEEZY_CHECKOUT_URL: CHECKOUT,
  LEMON_SQUEEZY_TEAM_PRODUCT_ID: PRODUCT_ID,
  LEMON_SQUEEZY_TEAM_VARIANT_ID: VARIANT_ID,
});
console.log("Updated .env with checkout URL + product/variant ids");

const env = loadEnv(".env");
if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN — skip deploy");
  process.exit(1);
}

const childEnv = { ...process.env, SUPABASE_ACCESS_TOKEN: env.SUPABASE_ACCESS_TOKEN };
const r = spawnSync(
  "pnpm",
  [
    "dlx",
    "supabase",
    "functions",
    "deploy",
    "lemon-squeezy-webhook",
    "--project-ref",
    PROJECT_REF,
    "--no-verify-jwt",
  ],
  { env: childEnv, encoding: "utf8", shell: true, stdio: "inherit" },
);
process.exit(r.status || 0);
