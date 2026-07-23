// Supabase Edge Function (Deno): builds a Lemon Squeezy checkout URL for a workspace.
//
// OPTIONAL — the app currently builds the checkout URL client-side from
// `VITE_LEMON_SQUEEZY_CHECKOUT_URL` (see `src/entities/team/ui/TeamSection.tsx`), which is
// simpler and works fine for a single static plan. Use this function instead once you need
// to look up dynamic pricing, validate the workspace/seat count server-side before
// checkout, or avoid exposing the checkout URL directly in the client bundle.
//
// Required secrets (set via `supabase secrets set`):
//   - LEMON_SQUEEZY_CHECKOUT_URL — base checkout URL, e.g.
//       https://<store>.lemonsqueezy.com/checkout/buy/<variant-uuid>
//
// Request body: { "workspace_id": "<uuid>", "email"?: "<string>" }
// Response body: { "url": "<checkout-url-with-custom-data>" }

const LEMON_SQUEEZY_CHECKOUT_URL = Deno.env.get("LEMON_SQUEEZY_CHECKOUT_URL") ?? "";

interface CreateCheckoutBody {
  workspace_id?: string;
  email?: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  if (!LEMON_SQUEEZY_CHECKOUT_URL) {
    return new Response(JSON.stringify({ error: "LEMON_SQUEEZY_CHECKOUT_URL is not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  let body: CreateCheckoutBody;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.workspace_id) {
    return new Response(JSON.stringify({ error: "workspace_id is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(LEMON_SQUEEZY_CHECKOUT_URL);
  url.searchParams.set("checkout[custom][workspace_id]", body.workspace_id);
  if (body.email) {
    url.searchParams.set("checkout[email]", body.email);
  }

  return new Response(JSON.stringify({ url: url.toString() }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
