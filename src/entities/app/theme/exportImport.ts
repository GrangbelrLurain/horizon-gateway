import type { CustomTheme } from "./types";

export function exportThemeToJson(theme: CustomTheme): string {
  const exportPayload: CustomTheme = {
    ...theme,
    _meta: {
      version: "1",
      exportedAt: new Date().toISOString(),
      app: "horizon-gateway",
    },
  };
  return JSON.stringify(exportPayload, null, 2);
}

export function parseAndValidateThemeJson(jsonString: string): {
  theme?: CustomTheme;
  warning?: string;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object" || !parsed.name || !parsed.colors || !parsed.typography) {
      return { error: "Invalid theme JSON structure." };
    }

    const theme: CustomTheme = {
      id: parsed.id || `custom-theme-${Date.now()}`,
      name: parsed.name,
      base: parsed.base === "light" ? "light" : "dark",
      colors: {
        primary: parsed.colors.primary || "#3b82f6",
        primaryContent: parsed.colors.primaryContent || "#ffffff",
        secondary: parsed.colors.secondary || "#4f46e5",
        secondaryContent: parsed.colors.secondaryContent || "#ffffff",
        accent: parsed.colors.accent || "#0ea5e9",
        accentContent: parsed.colors.accentContent || "#ffffff",
        base100: parsed.colors.base100 || "#0f172a",
        base200: parsed.colors.base200 || "#020617",
        base300: parsed.colors.base300 || "#1e293b",
        content: parsed.colors.content || "#f8fafc",
      },
      typography: {
        fontSource: parsed.typography.fontSource || { type: "bundled", id: "system" },
        baseFontSize: Number(parsed.typography.baseFontSize) || 14,
        fontWeightNormal: Number(parsed.typography.fontWeightNormal) || 400,
        fontWeightBold: Number(parsed.typography.fontWeightBold) || 700,
        lineHeight: Number(parsed.typography.lineHeight) || 1.5,
      },
    };

    let warning: string | undefined;
    if (theme.typography.fontSource.type === "system") {
      warning = `Theme uses system font "${theme.typography.fontSource.familyName}". If this font is not installed on this PC, system UI font will be used as fallback.`;
    }

    return { theme, warning };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to parse theme JSON: ${message}` };
  }
}
