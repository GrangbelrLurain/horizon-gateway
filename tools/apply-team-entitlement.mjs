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
const PROJECT_REF = "fcngkhnadezrggqgwhuk";
const sql = readFileSync("supabase/migrations/20260806000001_team_entitlement.sql", "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
if (!res.ok) {
  console.error(text);
  process.exit(1);
}
console.log("team_entitlement migration applied");

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await sb
  .from("profiles")
  .select("id,email,display_name,team_entitlement")
  .eq("id", "142b1dfb-cae3-4c56-b5c7-54a3b4036b37")
  .single();
if (error) {
  console.error(error);
  process.exit(1);
}
console.log("Owner profile:", data);
