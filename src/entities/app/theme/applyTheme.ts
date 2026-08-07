import type { CustomTheme } from "./types";

export function applyThemeToDocument(theme: CustomTheme) {
  document.documentElement.setAttribute(
    "data-theme",
    theme.base === "dark" ? "horizon-gateway-dark" : "horizon-gateway-light",
  );

  let fontCss = "system-ui, -apple-system, sans-serif";
  if (theme.typography.fontSource.type === "system") {
    fontCss = `local("${theme.typography.fontSource.familyName}"), system-ui, sans-serif`;
  } else {
    switch (theme.typography.fontSource.id) {
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

  styleTag.innerHTML = `
    :root {
      --color-primary: ${theme.colors.primary} !important;
      --color-primary-content: ${theme.colors.primaryContent || "#ffffff"} !important;
      --color-secondary: ${theme.colors.secondary} !important;
      --color-secondary-content: ${theme.colors.secondaryContent || "#ffffff"} !important;
      --color-accent: ${theme.colors.accent} !important;
      --color-accent-content: ${theme.colors.accentContent || "#ffffff"} !important;
      --color-base-100: ${theme.colors.base100} !important;
      --color-base-200: ${theme.colors.base200} !important;
      --color-base-300: ${theme.colors.base300} !important;
      --color-base-content: ${theme.colors.content} !important;
      
      --font-sans: ${fontCss} !important;
      font-family: ${fontCss} !important;
      font-size: ${theme.typography.baseFontSize}px !important;
      font-weight: ${theme.typography.fontWeightNormal} !important;
      line-height: ${theme.typography.lineHeight} !important;
    }
  `;
}
