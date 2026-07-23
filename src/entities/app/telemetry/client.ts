import { getDefaultStore } from "jotai";
import { supabase } from "@/shared/api/supabase";
import { APP_VERSION, getOsLabel } from "@/shared/lib/appMeta";
import { installIdAtom, telemetryEnabledAtom } from "./store";

/**
 * Size-bucketed strings, e.g. domain/mock-rule counts. Never send raw counts if they could
 * be used to fingerprint a specific setup — bucket them instead.
 */
export type TelemetryBucket = "0" | "1-5" | "6-20" | "21-50" | "51-100" | "100+";

/**
 * Telemetry payload values are structurally restricted to counters, booleans, and short
 * enum/bucket strings.
 *
 * ABSOLUTELY NEVER include: domain names/URLs, request/response bodies or headers, mock
 * rule contents, certificate data, file paths, IP addresses, emails, or any other
 * user-identifiable or sensitive data.
 */
export type TelemetryProps = Record<string, number | boolean | TelemetryBucket | string>;

const MAX_STRING_VALUE_LENGTH = 24;
const FORBIDDEN_KEY_PATTERN = /url|body|header|path|token|secret|cert|email|domain|ip$|addr/i;
const FORBIDDEN_VALUE_PATTERN = /:\/\/|[\\/]{2,}|@|\.(com|net|org|io|dev)\b/i;

function sanitizeProps(props: TelemetryProps | undefined): Record<string, number | boolean | string> {
  if (!props) {
    return {};
  }
  const safe: Record<string, number | boolean | string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
      continue;
    }
    if (typeof value === "string" && value.length <= MAX_STRING_VALUE_LENGTH && !FORBIDDEN_VALUE_PATTERN.test(value)) {
      safe[key] = value;
    }
  }
  return safe;
}

/** Buckets a raw count into a coarse range so exact numbers are never transmitted. */
export function bucketize(count: number): TelemetryBucket {
  if (count <= 0) {
    return "0";
  }
  if (count <= 5) {
    return "1-5";
  }
  if (count <= 20) {
    return "6-20";
  }
  if (count <= 50) {
    return "21-50";
  }
  if (count <= 100) {
    return "51-100";
  }
  return "100+";
}

/**
 * Inserts an anonymous telemetry event into Supabase if the user has opted in.
 * No-ops (and never throws) when telemetry is disabled or the insert fails —
 * telemetry must never disrupt the app or leak errors to the user.
 */
export async function trackEvent(event: string, props?: TelemetryProps): Promise<void> {
  const store = getDefaultStore();
  const enabled = store.get(telemetryEnabledAtom);
  if (!enabled) {
    return;
  }

  try {
    const installId = store.get(installIdAtom);
    await supabase.from("events").insert({
      install_id: installId,
      app_version: APP_VERSION,
      os: getOsLabel(),
      event,
      props: sanitizeProps(props),
    });
  } catch {
    // Fail silently by design.
  }
}
