/**
 * Pattern matching utility for Hostname and Pathname.
 */

function cleanHost(h: string): string {
  return h.trim().toLowerCase().split(":")[0];
}

/**
 * Matches actualHost against hostPattern (or domain as fallback).
 * Supports:
 * - Empty/undefined/'*' => matches any host
 * - Wildcards like `*.modetour.dev` => matches `www.modetour.dev`, `sub.modetour.dev`
 * - Multiple patterns separated by comma `,` (e.g. `*.modetour.dev, localhost`)
 * - Fallback to domain exact/contains check if no pattern is specified
 */
export function matchHostPattern(
  hostPattern: string | undefined | null,
  domain: string | undefined | null,
  actualHost: string,
): boolean {
  const currentHost = cleanHost(actualHost);
  if (!currentHost) {
    return false;
  }

  const rawPattern = (hostPattern || "").trim();
  if (rawPattern) {
    const patterns = rawPattern
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    return patterns.some((pattern) => {
      if (pattern === "*" || pattern === "") {
        return true;
      }
      const cleanPatt = cleanHost(pattern);
      if (cleanPatt.includes("*")) {
        const regexStr = `^${cleanPatt.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`;
        return new RegExp(regexStr).test(currentHost);
      }
      return cleanPatt === currentHost;
    });
  }

  if (domain?.trim()) {
    const cleanDom = cleanHost(domain);
    if (cleanDom.includes("*")) {
      const regexStr = `^${cleanDom.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`;
      return new RegExp(regexStr).test(currentHost);
    }
    return cleanDom === currentHost || currentHost.endsWith(`.${cleanDom}`);
  }

  return true;
}

/**
 * Helper to test a single path pattern string against actualPath.
 */
function matchSinglePathPattern(pattern: string, actualPath: string): boolean {
  let cleanActual = actualPath.trim().split("?")[0].split("#")[0];
  if (!cleanActual.startsWith("/")) {
    cleanActual = `/${cleanActual}`;
  }
  if (cleanActual.length > 1 && cleanActual.endsWith("/")) {
    cleanActual = cleanActual.slice(0, -1);
  }

  let patt = pattern.trim().split("?")[0].split("#")[0];
  if (!patt.startsWith("/")) {
    patt = `/${patt}`;
  }
  if (patt.length > 1 && patt.endsWith("/")) {
    patt = patt.slice(0, -1);
  }

  // Root or all-path wildcards: `/*`, `/**`, `*`, `""` match root `/` and any subpath
  if (patt === "*" || patt === "**" || patt === "/*" || patt === "/**" || patt === "" || patt === "/") {
    return true;
  }

  // Trailing wildcard `/*` or `/**`, e.g. `/promotion/*` or `/promotion/**`
  if (patt.endsWith("/*") || patt.endsWith("/**")) {
    const prefix = patt.endsWith("/**") ? patt.slice(0, -3) : patt.slice(0, -2);
    const cleanPrefix = prefix === "" ? "/" : prefix;
    if (cleanActual === cleanPrefix || cleanActual.startsWith(cleanPrefix === "/" ? "/" : `${cleanPrefix}/`)) {
      return true;
    }
  }

  // Convert Next.js / Nuxt / SvelteKit dynamic route syntax
  // 1. `[...slug]` or `[...id]` -> `.*` (catch-all)
  let regexPatt = patt.replace(/\[\.\.\.[^\]]+\]/g, ".*");
  // 2. `[id]`, `{id}`, `:id` -> `[^/]+` (single segment param)
  regexPatt = regexPatt.replace(/\[[^\]]+\]/g, "[^/]+");
  regexPatt = regexPatt.replace(/\{[^}]+\}/g, "[^/]+");
  regexPatt = regexPatt.replace(/:[a-zA-Z0-9_]+/g, "[^/]+");

  // Escape special regex chars EXCEPT `.*` and `[^/]+`
  const regexStr = `^${regexPatt
    .replace(/[.+?^${}()|[\]\\]/g, (match) => {
      return `\\${match}`;
    })
    .replace(/\\\.\\\*/g, ".*")
    .replace(/\\\[\\\^\/\\\]\\\+/g, "[^/]+")
    .replace(/\\\*/g, ".*")}$`;

  try {
    return new RegExp(regexStr).test(cleanActual);
  } catch (_e) {
    return cleanActual === patt;
  }
}

/**
 * Matches actualPath (e.g. `/promotion/1266`) against pathPattern (or targetUrl pathname as fallback).
 * Supports:
 * - Empty/undefined/'*'/'**'/'/*' => matches root `/` and any path
 * - Next.js dynamic routes: `/promotion/[id]`, `/promotion/[...slug]`
 * - Parameterized routes: `/promotion/:id`, `/promotion/{id}`
 * - Wildcards: `/promotion/*`, `/promotion/**`
 * - Comma-separated multiple patterns: `/promotion/*, /events/[id]`
 */
export function matchPathPattern(
  pathPattern: string | undefined | null,
  targetUrl: string | undefined | null,
  actualPath: string,
): boolean {
  const rawPattern = (pathPattern || "").trim();
  if (rawPattern) {
    const patterns = rawPattern
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    return patterns.some((p) => matchSinglePathPattern(p, actualPath));
  }

  if (targetUrl?.trim()) {
    try {
      const parsed = new URL(targetUrl.startsWith("http") ? targetUrl : `http://${targetUrl}`);
      const targetPath = parsed.pathname || "/";
      return matchSinglePathPattern(targetPath, actualPath);
    } catch (_e) {
      return true;
    }
  }

  return true;
}
