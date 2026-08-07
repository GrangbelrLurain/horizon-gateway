export type BundledFontId = "system" | "inter" | "geist" | "jetbrains-mono" | "noto-sans-kr";

export type ThemeFontSource = { type: "system"; familyName: string } | { type: "bundled"; id: BundledFontId };

export interface CustomThemeColors {
  primary: string; // hex #3b82f6
  primaryContent: string; // text color on primary background
  secondary: string; // hex #4f46e5
  secondaryContent: string; // text color on secondary background
  accent: string; // hex #0ea5e9
  accentContent: string; // text color on accent background
  base100: string; // base-100 (panel bg)
  base200: string; // base-200 (app bg)
  base300: string; // base-300 (borders/dividers)
  content: string; // base-content (text color)
}

export interface CustomThemeTypography {
  fontSource: ThemeFontSource;
  baseFontSize: number; // 12-18, default 14
  fontWeightNormal: number; // 400 | 500
  fontWeightBold: number; // 600 | 700 | 800
  lineHeight: number; // 1.3 - 1.7, default 1.5
}

export interface CustomTheme {
  id: string;
  name: string;
  base: "light" | "dark";
  colors: CustomThemeColors;
  typography: CustomThemeTypography;
  _meta?: {
    version: "1";
    exportedAt: string;
    app: "horizon-gateway";
  };
}
