import React from "react";
import ReactDOM from "react-dom/client";
import { InjectionApp } from "./InjectionApp";

declare global {
  interface Window {
    // biome-ignore lint/style/useNamingConvention: Global flag for injection tracking
    __WATCHTOWER_LOADED__?: boolean;
  }
}

/**
 * Watchtower Injection Entry Point
 */
function initInjection() {
  // 1. 전역 플래그 체크
  if (window.__WATCHTOWER_LOADED__) {
    return;
  }

  // 2. DOM에 이미 컨테이너가 있는지 확인
  const containerId = "watchtower-injection-container";
  if (document.getElementById(containerId)) {
    return;
  }

  window.__WATCHTOWER_LOADED__ = true;
  console.log("🚀 [Watchtower] Injection Script Starting...");

  const host = document.createElement("div");
  host.id = containerId;

  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "2147483647",
    pointerEvents: "none",
    display: "block",
    visibility: "visible",
  });

  // body 대기
  const mount = () => {
    if (!document.body) {
      setTimeout(mount, 50);
      return;
    }

    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const rootContainer = document.createElement("div");
    rootContainer.id = "wt-root";
    Object.assign(rootContainer.style, {
      width: "100%",
      height: "100%",
      position: "relative",
      pointerEvents: "none",
    });
    shadow.appendChild(rootContainer);

    const root = ReactDOM.createRoot(rootContainer);
    root.render(
      <React.StrictMode>
        <InjectionApp />
      </React.StrictMode>,
    );
    console.log("✅ [Watchtower] App Mounted.");
  };

  mount();
}

// 즉시 실행 시도
initInjection();
