import { useEffect, useState } from "react";
import { DEFAULT_DARK_THEME } from "@/entities/app/theme/presets";
import type { CustomTheme } from "@/entities/app/theme/types";

function injectThemeStyles(theme: CustomTheme) {
  const isLight = theme.base === "light";
  const colors = theme.colors || {};

  const vars = `
    --color-base-100: ${colors.base100 || (isLight ? "#ffffff" : "#0f172a")};
    --color-base-200: ${colors.base200 || (isLight ? "#f8fafc" : "#020617")};
    --color-base-300: ${colors.base300 || (isLight ? "#f1f5f9" : "#1e293b")};
    --color-base-content: ${colors.content || (isLight ? "#0f172a" : "#f8fafc")};
    --color-primary: ${colors.primary || (isLight ? "#3b82f6" : "#60a5fa")};
    --color-primary-content: ${colors.primaryContent || (isLight ? "#ffffff" : "#020617")};
    --color-secondary: ${colors.secondary || (isLight ? "#4f46e5" : "#818cf8")};
    --color-accent: ${colors.accent || (isLight ? "#0ea5e9" : "#38bdf8")};
    --color-success: ${isLight ? "#10b981" : "#34d399"};
    --color-warning: ${isLight ? "#f59e0b" : "#fbbf24"};
    --color-error: ${isLight ? "#ef4444" : "#f87171"};
    --color-info: ${isLight ? "#0ea5e9" : "#38bdf8"};

    --wt-bg-panel: ${colors.base100 || (isLight ? "#ffffff" : "#0f172a")};
    --wt-bg-panel-translucent: ${isLight ? "rgba(255, 255, 255, 0.98)" : "rgba(15, 23, 42, 0.98)"};
    --wt-bg-card: ${colors.base200 || (isLight ? "#f8fafc" : "#020617")};
    --wt-bg-card-hover: ${colors.base300 || (isLight ? "#f1f5f9" : "#1e293b")};
    --wt-bg-subtle: ${isLight ? "rgba(15, 23, 42, 0.05)" : "rgba(255, 255, 255, 0.06)"};
    --wt-bg-active: ${isLight ? "rgba(59, 130, 246, 0.12)" : "rgba(96, 165, 250, 0.18)"};

    --wt-text-main: ${colors.content || (isLight ? "#0f172a" : "#f8fafc")};
    --wt-text-muted: ${isLight ? "rgba(15, 23, 42, 0.6)" : "rgba(248, 250, 252, 0.6)"};
    --wt-text-faint: ${isLight ? "rgba(15, 23, 42, 0.4)" : "rgba(248, 250, 252, 0.4)"};

    --wt-border: ${colors.base300 || (isLight ? "#e2e8f0" : "#1e293b")};
    --wt-border-translucent: ${isLight ? "rgba(15, 23, 42, 0.14)" : "rgba(255, 255, 255, 0.15)"};
    --wt-border-primary: ${colors.primary || (isLight ? "#3b82f6" : "#60a5fa")};

    --wt-shadow: ${isLight ? "0 10px 30px -5px rgba(0,0,0,0.12), 0 4px 6px -2px rgba(0,0,0,0.05)" : "0 25px 50px -12px rgba(0, 0, 0, 0.7)"};

    color-scheme: ${isLight ? "light" : "dark"};
  `;

  const cssText = `
    :host, #wt-root, #horizon-gateway-injection-container {
      ${vars}
      color: var(--wt-text-main);
      font-family: system-ui, -apple-system, sans-serif;
    }
  `;

  const host = document.getElementById("horizon-gateway-injection-container");
  const roots = [host?.shadowRoot, document.head].filter(Boolean) as (ShadowRoot | HTMLElement)[];

  for (const root of roots) {
    let styleTag = root.querySelector("#wt-theme-vars") as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "wt-theme-vars";
      root.appendChild(styleTag);
    }
    styleTag.textContent = cssText;
  }
}

export function useInjectionTheme() {
  const [theme, setTheme] = useState<CustomTheme>(() => {
    try {
      const raw = localStorage.getItem("horizon-gateway-theme-cache");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.colors) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_DARK_THEME;
  });

  useEffect(() => {
    injectThemeStyles(theme);
  }, [theme]);

  useEffect(() => {
    const applyNewTheme = (newTheme: CustomTheme) => {
      if (!newTheme?.colors) {
        return;
      }
      console.log("🎨 [Horizon Gateway] Applying Injection Theme:", newTheme.name || newTheme.id);
      setTheme(newTheme);
      injectThemeStyles(newTheme);
      try {
        localStorage.setItem("horizon-gateway-theme-cache", JSON.stringify(newTheme));
      } catch {}
    };

    console.log("🎨 [Horizon Gateway] useInjectionTheme initializing...");

    // 1. Ask parent iframe immediately
    try {
      window.parent.postMessage({ type: "WT_GET_THEME" }, "*");
      window.parent.postMessage({ type: "WT_READY" }, "*");
    } catch {}

    // 2. Fetch active theme from Horizon Gateway local proxy backend
    fetch("/.horizon-gateway/api/theme")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.colors) {
          applyNewTheme(data);
        }
      })
      .catch(() => {});

    // 3. Listen for postMessage from parent
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "WT_SET_THEME" && event.data?.payload) {
        applyNewTheme(event.data.payload);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return { theme, setTheme };
}
