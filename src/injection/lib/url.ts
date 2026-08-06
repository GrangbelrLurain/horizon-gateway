/**
 * URL Normalizer to ensure consistent pathname matching
 */
export function normalizeUrl(urlStr: string): { host: string; path: string } {
  try {
    const url = new URL(urlStr.split("/.horizon-gateway")[0]);
    return {
      host: url.host,
      path: url.pathname.replace(/\/$/, "") || "/",
    };
  } catch (_e) {
    return { host: "", path: "" };
  }
}
