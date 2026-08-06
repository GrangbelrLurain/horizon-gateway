/**
 * Create Horizon Gateway Team Pro ($15/mo, 5 seats) in Lemon Squeezy.
 * Usage: node tools/lemon-create-team-product.mjs
 */
import { readFileSync, appendFileSync } from "node:fs";

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

const STORE_ID = "446457";
const PRICE_CENTS = 1500; // $15.00
const SEAT_LIMIT = 5;

async function ls(method, path, body) {
  const res = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    method,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${key}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}\n${JSON.stringify(json, null, 2)}`);
  }
  return json;
}

// 1) Create product (default variant is auto-created)
const product = await ls("POST", "/products", {
  data: {
    type: "products",
    attributes: {
      name: "Horizon Gateway Team Pro",
      description:
        "<p>Team workspace for Horizon Gateway: share domains, groups, mock rules &amp; scenarios. Includes <strong>5 seats</strong>.</p>",
      status: "published",
      // Pricing on product creation (legacy fields still accepted for default variant)
      price: PRICE_CENTS,
    },
    relationships: {
      store: {
        data: { type: "stores", id: STORE_ID },
      },
    },
  },
});

const productId = product.data.id;
const productAttrs = product.data.attributes;
console.log("Product created:", {
  id: productId,
  name: productAttrs.name,
  status: productAttrs.status,
  buy_now_url: productAttrs.buy_now_url,
});

// 2) Find default variant and convert to monthly subscription if needed
const variants = await ls("GET", `/variants?filter[product_id]=${productId}`);
const variant = variants.data?.[0];
if (!variant) {
  throw new Error("No variant returned for product");
}

console.log("Default variant before update:", {
  id: variant.id,
  name: variant.attributes.name,
  price: variant.attributes.price,
  is_subscription: variant.attributes.is_subscription,
  interval: variant.attributes.interval,
  status: variant.attributes.status,
});

const updated = await ls("PATCH", `/variants/${variant.id}`, {
  data: {
    type: "variants",
    id: variant.id,
    attributes: {
      name: "Monthly · 5 seats",
      description: "<p>$15/month · up to 5 team seats. Push/pull workspace sync included.</p>",
      price: PRICE_CENTS,
      is_subscription: true,
      interval: "month",
      interval_count: 1,
      status: "published",
    },
  },
});

const v = updated.data.attributes;
console.log("Variant updated:", {
  id: updated.data.id,
  name: v.name,
  price: v.price,
  is_subscription: v.is_subscription,
  interval: v.interval,
  interval_count: v.interval_count,
  status: v.status,
});

// buy_now_url is usually on the product; refresh product
const refreshed = await ls("GET", `/products/${productId}`);
const checkoutUrl = refreshed.data.attributes.buy_now_url;
console.log("\nCheckout URL:", checkoutUrl);
console.log("Variant ID (for SEAT_LIMIT_BY_VARIANT):", updated.data.id);

// Append to .env if missing
const envRaw = readFileSync(".env", "utf8");
const lines = [];
if (!/^VITE_LEMON_SQUEEZY_CHECKOUT_URL=/m.test(envRaw)) {
  lines.push(`VITE_LEMON_SQUEEZY_CHECKOUT_URL=${checkoutUrl}`);
}
if (!/^LEMON_SQUEEZY_TEAM_VARIANT_ID=/m.test(envRaw)) {
  lines.push(`LEMON_SQUEEZY_TEAM_VARIANT_ID=${updated.data.id}`);
}
if (!/^LEMON_SQUEEZY_TEAM_PRODUCT_ID=/m.test(envRaw)) {
  lines.push(`LEMON_SQUEEZY_TEAM_PRODUCT_ID=${productId}`);
}
if (lines.length) {
  appendFileSync(".env", `\n${lines.join("\n")}\n`);
  console.log("\nAppended to .env:", lines.map((l) => l.split("=")[0]).join(", "));
}

console.log("\nDone. Next: wire variant id into webhook SEAT_LIMIT_BY_VARIANT and restart app with new VITE_ checkout URL.");
