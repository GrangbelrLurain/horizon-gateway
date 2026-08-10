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
 * Matches actualPath (e.g. `/products/123`) against pathPattern (or targetUrl pathname as fallback).
 * Supports:
 * - Empty/undefined/'*'/'**' => matches any path
 * - Wildcard `*` => matches single path segment or characters (e.g. `/products/*`)
 * - Double wildcard `**` => matches arbitrary path depth (e.g. `/products/**`)
 * - Named params `:id` => matches a single path segment (e.g. `/users/:id/edit`)
 */
export function matchPathPattern(
  pathPattern: string | undefined | null,
  targetUrl: string | undefined | null,
  actualPath: string,
): boolean {
  let cleanActual = actualPath.trim().split("?")[0].split("#")[0];
  if (!cleanActual.startsWith("/")) {
    cleanActual = `/${cleanActual}`;
  }
  if (cleanActual.length > 1 && cleanActual.endsWith("/")) {
    cleanActual = cleanActual.slice(0, -1);
  }

  const rawPattern = (pathPattern || "").trim();
  if (rawPattern) {
    let patt = rawPattern.split("?")[0].split("#")[0];
    if (!patt.startsWith("/")) {
      patt = `/${patt}`;
    }
    if (patt.length > 1 && patt.endsWith("/")) {
      patt = patt.slice(0, -1);
    }

    if (patt === "*" || patt === "**" || patt === "") {
      return true;
    }

    const regexStr = `^${patt
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\*\\\*/g, ".*")
      .replace(/\\\*/g, "[^/]+")
      .replace(/:[a-zA-Z0-9_]+/g, "[^/]+")}$`;

    return new RegExp(regexStr).test(cleanActual);
  }

  if (targetUrl?.trim()) {
    try {
      const parsed = new URL(targetUrl.startsWith("http") ? targetUrl : `http://${targetUrl}`);
      let targetPath = parsed.pathname || "/";
      if (targetPath.length > 1 && targetPath.endsWith("/")) {
        targetPath = targetPath.slice(0, -1);
      }
      return targetPath === cleanActual;
    } catch (_e) {
      return true;
    }
  }

  return true;
}
