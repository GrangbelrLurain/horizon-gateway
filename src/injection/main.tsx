import React from "react";
import ReactDOM from "react-dom/client";
import { InjectionApp } from "./InjectionApp";

declare global {
  interface Window {
    __HORIZON_GATEWAY_LOADED__?: boolean;
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

/** The desktop app webview must never mount the proxy inspector toolbar. */
function isHorizonGatewayShell(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
    return true;
  }
  const host = window.location.hostname.toLowerCase();
  return host === "tauri.localhost" || host === "asset.localhost" || host === "ipc.localhost";
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message || String(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("❌ [Watchtower Injection Error]:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            backgroundColor: "#ef4444",
            color: "white",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontFamily: "sans-serif",
            zIndex: 2147483647,
            pointerEvents: "auto",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          Horizon Gateway Error: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Horizon Gateway Injection Entry Point
 */
function initInjection() {
  if (isHorizonGatewayShell()) {
    return;
  }

  // 1. 전역 플래그 체크
  if (window.__HORIZON_GATEWAY_LOADED__) {
    return;
  }

  // 2. DOM에 이미 컨테이너가 있는지 확인
  const containerId = "horizon-gateway-injection-container";
  if (document.getElementById(containerId)) {
    return;
  }

  window.__HORIZON_GATEWAY_LOADED__ = true;
  console.log("🚀 [Horizon Gateway] Injection Script Starting...");

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

    try {
      const root = ReactDOM.createRoot(rootContainer);
      root.render(
        <React.StrictMode>
          <ErrorBoundary>
            <InjectionApp />
          </ErrorBoundary>
        </React.StrictMode>,
      );
      console.log("✅ [Horizon Gateway] App Mounted into #wt-root.");
    } catch (err) {
      console.error("❌ [Horizon Gateway] React Mount Error:", err);
    }
  };

  mount();
}

// 즉시 실행 시도
initInjection();
