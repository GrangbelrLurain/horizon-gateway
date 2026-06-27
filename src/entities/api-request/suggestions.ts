import type { ParsedParam } from "@/shared/lib/openapi-parser";
import type { ApiRequestSuggestionContext } from "./types";

export function bareFieldKey(key: string): string {
  const colon = key.indexOf(":");
  if (colon !== -1) {
    return key.slice(colon + 1);
  }
  const dot = key.lastIndexOf(".");
  return dot !== -1 ? key.slice(dot + 1) : key;
}

export function valuesForFieldKey(map: Record<string, string[]>, logicalKey: string): string[] {
  if (!logicalKey.trim()) {
    return [];
  }
  const bare = bareFieldKey(logicalKey).toLowerCase();
  const lists: string[][] = [];

  for (const [storedKey, values] of Object.entries(map)) {
    if (bareFieldKey(storedKey).toLowerCase() === bare) {
      lists.push(values);
    }
  }

  return mergeSuggestionLists(...lists);
}

export function pathnamesForOrigin(byOrigin: Record<string, string[]>, origin: string): string[] {
  const normalized = origin.trim().replace(/\/+$/, "");
  if (!normalized) {
    return [];
  }
  return byOrigin[normalized] ?? [];
}

const RESPONSE_VALUE_MAX_LEN = 500;
const RESPONSE_VALUES_PER_KEY = 12;
const RESPONSE_WALK_MAX_DEPTH = 2;

function pushExtractedValue(result: Record<string, string[]>, key: string, raw: unknown) {
  if (raw === null || raw === undefined) {
    return;
  }
  const value = String(raw).trim();
  if (!value || value.length > RESPONSE_VALUE_MAX_LEN) {
    return;
  }

  const keys = new Set<string>([key, bareFieldKey(key)]);
  for (const k of keys) {
    const list = result[k] ?? [];
    if (list.includes(value)) {
      continue;
    }
    result[k] = [value, ...list].slice(0, RESPONSE_VALUES_PER_KEY);
  }
}

function walkResponseNode(node: unknown, depth: number, prefix: string, result: Record<string, string[]>) {
  if (depth > RESPONSE_WALK_MAX_DEPTH || node === null || node === undefined) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node.slice(0, 5)) {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        if (prefix) {
          pushExtractedValue(result, prefix, item);
        }
      } else if (typeof item === "object" && item !== null) {
        walkResponseNode(item, depth + 1, prefix, result);
      }
    }
    return;
  }

  if (typeof node !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "object") {
      walkResponseNode(value, depth + 1, fullKey, result);
    } else {
      pushExtractedValue(result, fullKey, value);
      pushExtractedValue(result, key, value);
    }
  }
}

/** 응답 JSON에서 필드명(key)별 스칼라 값을 추출해 자동완성 저장용 맵으로 반환 */
export function extractAutocompleteValuesFromResponse(body: unknown): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  if (body === null || body === undefined) {
    return result;
  }

  let parsed = body;
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) {
      return result;
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return result;
    }
  }

  walkResponseNode(parsed, 0, "", result);
  return result;
}

export function filterSuggestions(options: string[], query: string, limit = 24): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const q = query.trim().toLowerCase();

  for (const option of options) {
    const trimmed = option.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    if (q && !trimmed.toLowerCase().includes(q)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

export function paramSuggestionKey(param: Pick<ParsedParam, "in" | "name">): string {
  return `${param.in}:${param.name}`;
}

export function enumValuesFromParam(param: ParsedParam): string[] {
  const values = param.schema?.enum;
  if (!values?.length) {
    return [];
  }
  return values.map((value) => String(value));
}

export function mergeSuggestionLists(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      merged.push(trimmed);
    }
  }
  return merged;
}

export function buildParamSuggestions(param: ParsedParam, stored: Record<string, string[]>): string[] {
  const key = paramSuggestionKey(param);
  return mergeSuggestionLists(
    enumValuesFromParam(param),
    valuesForFieldKey(stored, key),
    valuesForFieldKey(stored, param.name),
  );
}

export function createEmptySuggestionContext(): ApiRequestSuggestionContext {
  return {
    origins: [],
    pathnames: [],
    paramValues: {},
    headerKeys: [],
    headerValues: {},
    bodies: [],
  };
}
