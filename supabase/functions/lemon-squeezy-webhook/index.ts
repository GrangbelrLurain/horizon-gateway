// Supabase Edge Function (Deno): Lemon Squeezy subscription webhook receiver.
//
// Verifies the Lemon Squeezy webhook signature, then updates `workspaces.status` /
// `workspaces.seat_limit` from `subscription_*` events, matched via the
// `checkout[custom][workspace_id]` value echoed back as `meta.custom_data.workspace_id`.
//
// Required secrets (set via `supabase secrets set`):
//   - LEMON_SQUEEZY_WEBHOOK_SECRET — the signing secret configured on the LS webhook
//   - SUPABASE_URL                 — usually auto-provided in the Edge Function runtime
//   - SUPABASE_SERVICE_ROLE_KEY    — service role key (bypasses RLS; keep secret!)
//
// Lemon Squeezy webhook setup: Store settings -> Webhooks
//   - URL: https://<project-ref>.supabase.co/functions/v1/lemon-squeezy-webhook
//   - Events: subscription_created, subscription_updated, subscription_cancelled,
//             subscription_expired, subscription_resumed, subscription_paused
//
// Checkout must pass `checkout[custom][workspace_id]=<uuid>` (see
// `src/entities/team/ui/TeamSection.tsx` and VITE_LEMON_SQUEEZY_CHECKOUT_URL) so this
// function knows which workspace to update.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LEMON_SQUEEZY_WEBHOOK_SECRET = Deno.env.get("LEMON_SQUEEZY_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Map Lemon Squeezy subscription `status` -> our `workspaces.status`.
const STATUS_MAP: Record<string, "active" | "past_due" | "canceled"> = {
  active: "active",
  on_trial: "active",
  paused: "past_due",
  past_due: "past_due",
  unpaid: "past_due",
  cancelled: "canceled",
  expired: "canceled",
};

// Optional: map Lemon Squeezy `variant_id` -> seat_limit for that plan.
// Fill in your real variant IDs once the products are created in Lemon Squeezy.
const SEAT_LIMIT_BY_VARIANT: Record<string, number> = {
  // "123456": 5,
  // "123457": 20,
};

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !LEMON_SQUEEZY_WEBHOOK_SECRET) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(LEMON_SQUEEZY_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const computed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(toHex(computed), signatureHeader);
}

interface LemonSqueezyPayload {
  meta?: {
    event_name?: string;
    custom_data?: { workspace_id?: string };
  };
  data?: {
    attributes?: {
      status?: string;
      variant_id?: number | string;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  if (!(await verifySignature(rawBody, signature))) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: LemonSqueezyPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }

  const eventName = payload.meta?.event_name ?? "";
  if (!eventName.startsWith("subscription_")) {
    return new Response(`ignored event: ${eventName}`, { status: 200 });
  }

  const workspaceId = payload.meta?.custom_data?.workspace_id;
  if (!workspaceId) {
    console.warn("lemon-squeezy webhook missing meta.custom_data.workspace_id", eventName);
    return new Response("missing workspace_id in custom_data", { status: 200 });
  }

  const attributes = payload.data?.attributes ?? {};
  const status = STATUS_MAP[attributes.status ?? ""] ?? "active";
  const variantId = attributes.variant_id != null ? String(attributes.variant_id) : null;
  const seatLimit = variantId ? SEAT_LIMIT_BY_VARIANT[variantId] : undefined;

  const updates: Record<string, unknown> = { status };
  if (seatLimit != null) {
    updates.seat_limit = seatLimit;
  }

  const { error } = await supabase.from("workspaces").update(updates).eq("id", workspaceId);
  if (error) {
    console.error("workspaces update failed:", error.message);
    return new Response("update failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
