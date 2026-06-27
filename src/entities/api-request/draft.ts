import type { ParsedEndpoint } from "@/shared/lib/openapi-parser";
import type { ApiRequestDraft, HeaderRow } from "./types";

export interface QueryParamRow {
  key: string;
  value: string;
}

export function emptyQueryParamRow(): QueryParamRow {
  return { key: "", value: "" };
}

function parseQueryString(search: string): QueryParamRow[] {
  if (!search) {
    return [];
  }

  return search.split("&").map((pair) => {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) {
      try {
        return { key: decodeURIComponent(pair), value: "" };
      } catch {
        return { key: pair, value: "" };
      }
    }
    try {
      return {
        key: decodeURIComponent(pair.substring(0, eqIdx)),
        value: decodeURIComponent(pair.substring(eqIdx + 1)),
      };
    } catch {
      return {
        key: pair.substring(0, eqIdx),
        value: pair.substring(eqIdx + 1),
      };
    }
  });
}

export function parseRequestUrl(urlStr: string): {
  origin: string;
  pathname: string;
  params: QueryParamRow[];
} {
  if (!urlStr.trim()) {
    return { origin: "", pathname: "", params: [emptyQueryParamRow()] };
  }

  const qIdx = urlStr.indexOf("?");
  const beforeQuery = qIdx === -1 ? urlStr : urlStr.substring(0, qIdx);
  const params = parseQueryString(qIdx === -1 ? "" : urlStr.substring(qIdx + 1));

  try {
    const normalized = beforeQuery.includes("://") ? beforeQuery : `https://${beforeQuery}`;
    const parsed = new URL(normalized);
    return {
      origin: parsed.origin,
      pathname: parsed.pathname || "/",
      params: params.length > 0 ? params : [emptyQueryParamRow()],
    };
  } catch {
    const schemeIdx = beforeQuery.indexOf("://");
    if (schemeIdx !== -1) {
      const slashIdx = beforeQuery.indexOf("/", schemeIdx + 3);
      if (slashIdx !== -1) {
        return {
          origin: beforeQuery.substring(0, slashIdx),
          pathname: beforeQuery.substring(slashIdx) || "/",
          params: params.length > 0 ? params : [emptyQueryParamRow()],
        };
      }
    }
    return {
      origin: beforeQuery,
      pathname: "",
      params: params.length > 0 ? params : [emptyQueryParamRow()],
    };
  }
}

export function buildRequestUrlFromParts(origin: string, pathname: string, params: QueryParamRow[]): string {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const normalizedPath = pathname ? (pathname.startsWith("/") ? pathname : `/${pathname}`) : "";
  const base = `${normalizedOrigin}${normalizedPath}`;

  const activeParams = params.filter((row) => row.key.trim() !== "");
  if (activeParams.length === 0) {
    return base;
  }

  const queryString = activeParams
    .map((row) => {
      try {
        return `${encodeURIComponent(row.key.trim())}=${encodeURIComponent(row.value.trim())}`;
      } catch {
        return `${row.key.trim()}=${row.value.trim()}`;
      }
    })
    .join("&");

  return `${base}?${queryString}`;
}

export function emptyHeaderRow(): HeaderRow {
  return { key: "", value: "" };
}

export function parseHeaderText(text: string): HeaderRow[] {
  if (!text.trim()) {
    return [emptyHeaderRow()];
  }

  const rows = text
    .split("\n")
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx <= 0) {
        return { key: line.trim(), value: "" };
      }
      return {
        key: line.slice(0, idx).trim(),
        value: line.slice(idx + 1).trim(),
      };
    })
    .filter((row) => row.key || row.value);

  return rows.length > 0 ? rows : [emptyHeaderRow()];
}

export function headersToRecord(rows: HeaderRow[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) {
      headers[key] = row.value.trim();
    }
  }
  return headers;
}

export function createDefaultDraft(
  endpoint: ParsedEndpoint,
  origin: string,
  saved?: Partial<ApiRequestDraft> & { headerText?: string },
): ApiRequestDraft {
  const headers =
    saved?.headers ?? (saved?.headerText !== undefined ? parseHeaderText(saved.headerText) : [emptyHeaderRow()]);

  return {
    origin: saved?.origin ?? origin,
    pathname: saved?.pathname ?? endpoint.path,
    paramValues: saved?.paramValues ?? {},
    bodyText:
      saved?.bodyText ?? (endpoint.requestBody?.example ? JSON.stringify(endpoint.requestBody.example, null, 2) : ""),
    headers,
  };
}

export function buildRequestUrl(draft: ApiRequestDraft, endpoint: ParsedEndpoint): string {
  let path = draft.pathname;
  for (const param of endpoint.parameters.filter((item) => item.in === "path")) {
    const value = draft.paramValues[param.name] ?? "";
    path = path.replace(`{${param.name}}`, encodeURIComponent(value));
  }

  const queryParams = endpoint.parameters.filter((item) => item.in === "query");
  const query = queryParams
    .map((param) => {
      const value = draft.paramValues[param.name];
      if (value === undefined || value === "") {
        return null;
      }
      return `${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`;
    })
    .filter(Boolean)
    .join("&");

  const origin = draft.origin.replace(/\/+$/, "");
  return query ? `${origin}${path}?${query}` : `${origin}${path}`;
}

export function collectDraftHeaders(draft: ApiRequestDraft, endpoint: ParsedEndpoint): Record<string, string> {
  const headers = headersToRecord(draft.headers);
  for (const param of endpoint.parameters.filter((item) => item.in === "header")) {
    const value = draft.paramValues[param.name];
    if (value) {
      headers[param.name] = value;
    }
  }
  return headers;
}
