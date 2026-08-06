/**
 * Inspect Lemon Squeezy store / products (read-only).
 * Usage: node tools/lemon-inspect.mjs
 */
import { readFileSync } from "node:fs";

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

const env = loadEnv(".env");
const key = env.LEMON_SQUEEZY_API_KEY;
if (!key) {
  console.error("Missing LEMON_SQUEEZY_API_KEY");
  process.exit(1);
}

async function ls(path) {
  const res = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${key}`,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${JSON.stringify(json)}`);
  }
  return json;
}

const stores = await ls("/stores");
console.log("=== Stores ===");
for (const s of stores.data ?? []) {
  const a = s.attributes;
  console.log(`- id=${s.id} name=${a.name} slug=${a.slug} domain=${a.domain} currency=${a.currency}`);
}

const products = await ls("/products");
console.log("\n=== Products ===");
if (!products.data?.length) {
  console.log("(none)");
} else {
  for (const p of products.data) {
    const a = p.attributes;
    console.log(`- id=${p.id} name=${a.name} status=${a.status} store_id=${a.store_id}`);
  }
}

const variants = await ls("/variants");
console.log("\n=== Variants ===");
if (!variants.data?.length) {
  console.log("(none)");
} else {
  for (const v of variants.data) {
    const a = v.attributes;
    console.log(
      `- id=${v.id} name=${a.name} price=${a.price} interval=${a.interval} product_id=${a.product_id} status=${a.status}`,
    );
  }
}
