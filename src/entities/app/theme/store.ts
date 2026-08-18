import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { BUILTIN_PRESETS, DEFAULT_DARK_THEME } from "./presets";
import type { CustomTheme } from "./types";

// Use `string` instead of a narrow union so custom theme IDs (e.g. "custom-theme-1234567890")
// can be stored without `as any` casts.
export type AppTheme = string;

export const themeAtom = atomWithStorage<AppTheme>("horizon-gateway-theme", "horizon-gateway-dark");

export const customThemesAtom = atomWithStorage<CustomTheme[]>("horizon-gateway-custom-themes", []);

export const activeCustomThemeAtom = atom<CustomTheme>((get) => {
  const currentTheme = get(themeAtom);
  const customList = get(customThemesAtom);

  // When customThemesAtom hasn't been hydrated from localStorage yet (returns []),
  // fall back to reading localStorage directly so a custom active theme is not
  // lost on app restart due to atom initialization order.
  let safeList = Array.isArray(customList) && customList.length > 0 ? customList : [];
  if (safeList.length === 0) {
    try {
      const raw = localStorage.getItem("horizon-gateway-custom-themes");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          safeList = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  const foundCustom = safeList.find((t) => t && t.id === currentTheme);
  if (foundCustom) {
    return {
      ...DEFAULT_DARK_THEME,
      ...foundCustom,
      colors: {
        ...DEFAULT_DARK_THEME.colors,
        ...(foundCustom.colors || {}),
      },
      typography: {
        ...DEFAULT_DARK_THEME.typography,
        ...(foundCustom.typography || {}),
      },
    };
  }
  const foundBuiltin = BUILTIN_PRESETS.find((t) => t && t.id === currentTheme);
  return foundBuiltin || DEFAULT_DARK_THEME;
});

export const settingsActiveTabAtom = atom<"general" | "theme">("general");
