export interface ChangelogItem {
  version: string;
  date: string;
  changes: {
    type: "added" | "changed" | "fixed";
    title: Record<string, string>;
    description?: Record<string, string>;
  }[];
}

/**
 * Gets a localized value from a dictionary. Falls back to English ("en").
 * If the selected language is not found, it resolves to "en". If "en" is also
 * not found, it falls back to the first available language value.
 */
export function getLocalizedValue<T>(
  dict: Record<string, T> | undefined,
  lang: string,
  fallback = "en",
): T | undefined {
  if (!dict) {
    return undefined;
  }
  if (lang in dict) {
    return dict[lang];
  }
  if (fallback in dict) {
    return dict[fallback];
  }
  const keys = Object.keys(dict);
  if (keys.length > 0) {
    return dict[keys[0]];
  }
  return undefined;
}
