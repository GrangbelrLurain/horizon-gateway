import type { CustomTheme } from "./types";

const BUILTIN_DAISY_THEME_IDS = new Set(["horizon-gateway-light", "horizon-gateway-dark"]);

/** DaisyUI only emits full token sets for themes declared in global.css. */
function resolveDaisyThemeId(theme: CustomTheme): string {
  if (theme.id && BUILTIN_DAISY_THEME_IDS.has(theme.id)) {
    return theme.id;
  }
  return theme.base === "light" ? "horizon-gateway-light" : "horizon-gateway-dark";
}

export function applyThemeToDocument(theme: CustomTheme) {
  if (!theme || !theme.colors) {
    return;
  }

  // Anchor to a compiled DaisyUI theme so semantic tokens (info/success/error/neutral)
  // resolve correctly. Custom theme ids are stored in localStorage only.
  const daisyThemeId = resolveDaisyThemeId(theme);
  const colorScheme = theme.base === "light" ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", daisyThemeId);
  document.documentElement.setAttribute("data-color-scheme", colorScheme);

  let fontCss = "system-ui, -apple-system, sans-serif";
  const fontSource = theme.typography?.fontSource;
  if (fontSource?.type === "system" && fontSource.familyName) {
    fontCss = `local("${fontSource.familyName}"), system-ui, sans-serif`;
  } else if (fontSource?.type === "bundled" && fontSource.id) {
    switch (fontSource.id) {
      case "inter":
        fontCss = "'Inter', system-ui, sans-serif";
        break;
      case "geist":
        fontCss = "'Geist', system-ui, sans-serif";
        break;
      case "jetbrains-mono":
        fontCss = "'JetBrains Mono', monospace";
        break;
      case "noto-sans-kr":
        fontCss = "'Noto Sans KR', sans-serif";
        break;
      default:
        fontCss = "system-ui, -apple-system, sans-serif";
    }
  }

  let styleTag = document.getElementById("custom-active-theme");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "custom-active-theme";
    document.head.appendChild(styleTag);
  }

  const baseFontSize = theme.typography?.baseFontSize ?? 14;
  const fontWeightNormal = theme.typography?.fontWeightNormal ?? 400;
  const lineHeight = theme.typography?.lineHeight ?? 1.5;

  // Inject into both :root and the active DaisyUI theme selector so overrides
  // win over @layer base rules from the compiled theme.
  const vars = `
    color-scheme: ${colorScheme} !important;
    --color-primary: ${theme.colors.primary || "#6366f1"} !important;
    --color-primary-content: ${theme.colors.primaryContent || "#ffffff"} !important;
    --color-secondary: ${theme.colors.secondary || "#ec4899"} !important;
    --color-secondary-content: ${theme.colors.secondaryContent || "#ffffff"} !important;
    --color-accent: ${theme.colors.accent || "#3b82f6"} !important;
    --color-accent-content: ${theme.colors.accentContent || "#ffffff"} !important;
    --color-base-100: ${theme.colors.base100 || "#0f172a"} !important;
    --color-base-200: ${theme.colors.base200 || "#020617"} !important;
    --color-base-300: ${theme.colors.base300 || "#1e293b"} !important;
    --color-base-content: ${theme.colors.content || "#f8fafc"} !important;
    --font-sans: ${fontCss} !important;
    font-family: ${fontCss} !important;
    font-size: ${baseFontSize}px !important;
    font-weight: ${fontWeightNormal} !important;
    line-height: ${lineHeight} !important;
  `;

  styleTag.innerHTML = `
    :root { ${vars} }
    [data-theme="${daisyThemeId}"] { ${vars} }
  `;
}
