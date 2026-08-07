import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { BUILTIN_PRESETS, DEFAULT_DARK_THEME } from "./presets";
import type { CustomTheme } from "./types";

export type AppTheme = "horizon-gateway-dark" | "horizon-gateway-light";

export const themeAtom = atomWithStorage<AppTheme>("horizon-gateway-theme", "horizon-gateway-dark");

export const customThemesAtom = atomWithStorage<CustomTheme[]>("horizon-gateway-custom-themes", []);

export const activeCustomThemeAtom = atom<CustomTheme>((get) => {
  const currentTheme = get(themeAtom);
  const customList = get(customThemesAtom);
  const safeList = Array.isArray(customList) ? customList : [];
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
