import { atomWithStorage } from "jotai/utils";

const STANDARD_HEADERS = ["Accept", "Authorization", "Content-Type", "User-Agent", "Cache-Control", "X-Api-Key"];

const STANDARD_HEADER_VALUES: Record<string, string[]> = {
  Accept: ["application/json", "*/*"],
  "Content-Type": ["application/json", "application/x-www-form-urlencoded", "text/plain", "multipart/form-data"],
  "Cache-Control": ["no-cache", "no-store, must-revalidate", "max-age=3600"],
};

function uniqueAppend(list: string[], value: string, max = 40): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return list;
  }
  return [trimmed, ...list.filter((item) => item !== trimmed)].slice(0, max);
}

function uniqueAppendMap(
  map: Record<string, string[]>,
  key: string,
  value: string,
  max = 30,
): Record<string, string[]> {
  const trimmed = value.trim();
  if (!trimmed) {
    return map;
  }
  return {
    ...map,
    [key]: uniqueAppend(map[key] ?? [], trimmed, max),
  };
}

export const autocompleteOriginsAtom = atomWithStorage<string[]>("watchtower-autocomplete-origins", []);

export const autocompletePathnamesAtom = atomWithStorage<string[]>("watchtower-autocomplete-pathnames", []);

export const autocompleteBodiesAtom = atomWithStorage<string[]>("watchtower-autocomplete-bodies", []);

export const autocompleteParamValuesAtom = atomWithStorage<Record<string, string[]>>(
  "watchtower-autocomplete-param-values",
  {},
);

/** @deprecated use autocompleteHeaderValuesAtom — kept for storage key compatibility */
export const autocompleteValuesAtom = atomWithStorage<Record<string, string[]>>(
  "watchtower-autocomplete-values",
  STANDARD_HEADER_VALUES,
);

export const autocompleteHeaderValuesAtom = autocompleteValuesAtom;

export const autocompleteHeadersAtom = atomWithStorage<string[]>("watchtower-autocomplete-headers", STANDARD_HEADERS);

export function appendOriginSuggestion(origins: string[], origin: string): string[] {
  return uniqueAppend(origins, origin, 30);
}

export function appendPathnameSuggestion(pathnames: string[], pathname: string): string[] {
  return uniqueAppend(pathnames, pathname, 80);
}

export function appendBodySuggestion(bodies: string[], body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 4_000) {
    return bodies;
  }
  return uniqueAppend(bodies, trimmed, 20);
}

export function appendParamSuggestion(
  map: Record<string, string[]>,
  paramKey: string,
  value: string,
): Record<string, string[]> {
  return uniqueAppendMap(map, paramKey, value);
}

export function appendPathnameForOrigin(
  map: Record<string, string[]>,
  origin: string,
  pathname: string,
): Record<string, string[]> {
  const normalizedOrigin = origin.trim().replace(/\/+$/, "");
  const trimmedPath = pathname.trim();
  if (!normalizedOrigin || !trimmedPath) {
    return map;
  }
  return uniqueAppendMap(map, normalizedOrigin, trimmedPath, 50);
}

export function mergeExtractedFieldValues(
  map: Record<string, string[]>,
  extracted: Record<string, string[]>,
): Record<string, string[]> {
  let next = map;
  for (const [key, values] of Object.entries(extracted)) {
    for (const value of values) {
      next = appendParamSuggestion(next, key, value);
    }
  }
  return next;
}

export const autocompletePathnamesByOriginAtom = atomWithStorage<Record<string, string[]>>(
  "watchtower-autocomplete-pathnames-by-origin",
  {},
);

export function appendHeaderSuggestions(
  headerKeys: string[],
  headerValues: Record<string, string[]>,
  headers: Array<{ key: string; value: string }>,
): { headerKeys: string[]; headerValues: Record<string, string[]> } {
  let nextKeys = headerKeys;
  let nextValues = headerValues;
  for (const row of headers) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (key) {
      nextKeys = uniqueAppend(nextKeys, key);
      if (value) {
        nextValues = uniqueAppendMap(nextValues, key, value);
      }
    }
  }
  return { headerKeys: nextKeys, headerValues: nextValues };
}
