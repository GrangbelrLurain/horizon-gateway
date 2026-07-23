// Supabase Edge Function (Deno): GitHub Sponsors webhook receiver.
//
// Verifies the GitHub webhook signature, then updates `profiles.is_sponsor` /
// `sponsor_tier` / `sponsor_since` by matching `github_id` (preferred) or
// `github_login`. This is the ONLY code path that should ever write those columns —
// enforced additionally by a DB trigger (see supabase/migrations/20260717000000_monetization.sql).
//
// Required secrets (set via `supabase secrets set`):
//   - GITHUB_SPONSORS_WEBHOOK_SECRET  — the secret configured on the GitHub Sponsors webhook
//   - SUPABASE_URL                    — usually auto-provided in the Edge Function runtime
//   - SUPABASE_SERVICE_ROLE_KEY       — service role key (bypasses RLS; keep secret!)
//
// GitHub webhook setup: https://github.com/sponsors/<you>/dashboard/webhooks
//   - Payload URL: https://<project-ref>.supabase.co/functions/v1/github-sponsors-webhook
//   - Content type: application/json
//   - Events: "Sponsorships"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GITHUB_WEBHOOK_SECRET = Deno.env.get("GITHUB_SPONSORS_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
  if (!signatureHeader || !GITHUB_WEBHOOK_SECRET) {
    return false;
  }
  const [algo, hexSignature] = signatureHeader.split("=");
  if (algo !== "sha256" || !hexSignature) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(GITHUB_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const computed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(toHex(computed), hexSignature);
}

interface SponsorshipPayload {
  action: string;
  sponsorship?: {
    sponsor?: { id?: number; login?: string };
    tier?: { name?: string };
  };
}

const ACTIVATING_ACTIONS = new Set(["created", "tier_changed", "edited"]);
const CANCELLING_ACTIONS = new Set(["cancelled", "pending_cancellation"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!(await verifySignature(rawBody, signature))) {
    return new Response("invalid signature", { status: 401 });
  }

  const githubEvent = req.headers.get("x-github-event");
  if (githubEvent !== "sponsorship") {
    return new Response("ignored: not a sponsorship event", { status: 200 });
  }

  let payload: SponsorshipPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }

  const sponsor = payload.sponsorship?.sponsor;
  const githubId = sponsor?.id != null ? String(sponsor.id) : null;
  const githubLogin = sponsor?.login ?? null;
  const tier = payload.sponsorship?.tier?.name ?? null;

  if (!githubId && !githubLogin) {
    return new Response("no sponsor identity in payload", { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (ACTIVATING_ACTIONS.has(payload.action)) {
    updates.is_sponsor = true;
    updates.sponsor_tier = tier;
    updates.sponsor_since = new Date().toISOString();
  } else if (CANCELLING_ACTIONS.has(payload.action)) {
    updates.is_sponsor = false;
  } else {
    return new Response(`ignored action: ${payload.action}`, { status: 200 });
  }

  let query = supabase.from("profiles").update(updates);
  query = githubId ? query.eq("github_id", githubId) : query.eq("github_login", githubLogin as string);
  const { data, error } = await query.select("id");

  if (error) {
    console.error("profiles update failed:", error.message);
    return new Response("update failed", { status: 500 });
  }

  if (!data || data.length === 0) {
    // Matching failed (e.g. the sponsor never signed into the app with GitHub OAuth yet).
    // Logged here for manual backfill — see docs/planning/monetization-and-polish.md G1.
    console.warn("No matching profile for sponsor", { githubId, githubLogin, action: payload.action });
    return new Response("no matching profile (logged for manual backfill)", { status: 200 });
  }

  return new Response("ok", { status: 200 });
});
