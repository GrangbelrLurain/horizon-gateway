import type { CustomTheme } from "./types";

export const DEFAULT_DARK_THEME: CustomTheme = {
  id: "horizon-gateway-dark",
  name: "Horizon Dark (Default)",
  base: "dark",
  colors: {
    primary: "#60a5fa",
    primaryContent: "#020617",
    secondary: "#818cf8",
    secondaryContent: "#020617",
    accent: "#38bdf8",
    accentContent: "#020617",
    base100: "#0f172a",
    base200: "#020617",
    base300: "#1e293b",
    content: "#f8fafc",
  },
  typography: {
    fontSource: { type: "bundled", id: "system" },
    baseFontSize: 13,
    fontWeightNormal: 400,
    fontWeightBold: 700,
    lineHeight: 1.4,
  },
};

export const DEFAULT_LIGHT_THEME: CustomTheme = {
  id: "horizon-gateway-light",
  name: "Horizon Light",
  base: "light",
  colors: {
    primary: "#3b82f6",
    primaryContent: "#ffffff",
    secondary: "#4f46e5",
    secondaryContent: "#ffffff",
    accent: "#0ea5e9",
    accentContent: "#ffffff",
    base100: "#ffffff",
    base200: "#f8fafc",
    base300: "#f1f5f9",
    content: "#0f172a",
  },
  typography: {
    fontSource: { type: "bundled", id: "system" },
    baseFontSize: 13,
    fontWeightNormal: 400,
    fontWeightBold: 700,
    lineHeight: 1.4,
  },
};

export const BUILTIN_PRESETS: CustomTheme[] = [DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME];
