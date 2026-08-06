import type { InjectionAppState } from "../hooks/useInjectionAppState";

type State = Pick<
  InjectionAppState,
  | "dragOffset"
  | "status"
  | "showAllProxyRoutes"
  | "setShowAllProxyRoutes"
  | "proxyRoutes"
  | "matchedProxyRoutes"
  | "handleToggleProxyRoute"
  | "closeAllPopovers"
>;

export function PrxPopover({ s }: { s: State }) {
  return (
    <div
      style={{
        position: "fixed",
        right: `${s.dragOffset.x}px`,
        bottom: `${s.dragOffset.y + 48}px`,
        width: "380px",
        maxHeight: "65vh",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(16px)",
        borderRadius: "16px",
        border: "1px solid rgba(16, 185, 129, 0.4)",
        boxShadow: "0 20px 50px -10px rgba(0,0,0,0.7), 0 0 20px rgba(16, 185, 129, 0.15)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 2147483647,
        fontFamily: "sans-serif",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "rgba(16, 185, 129, 0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span style={{ fontWeight: "700", fontSize: "13px", color: "#10b981" }}>로컬 프록시 상태 & 라우트</span>
        </div>
        <button
          type="button"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            s.closeAllPopovers();
          }}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            fontSize: "14px",
            padding: "2px 6px",
          }}
          title="닫기"
        >
          ✕
        </button>
      </div>
      <div
        style={{
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          fontSize: "12px",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.7)" }}>프록시 연결 상태</span>
          <span style={{ fontWeight: "700", color: s.status.proxy ? "#10b981" : "#ef4444" }}>
            {s.status.proxy ? "● ACTIVE (정상)" : "○ INACTIVE (비활성)"}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.7)" }}>중계된 총 트래픽 수</span>
          <span style={{ fontWeight: "700", color: "#f3f4f6" }}>{s.status.proxyCount ?? 0}건</span>
        </div>

        <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#10b981" }}>
              {s.showAllProxyRoutes
                ? `전체 로컬 프록시 라우트 (${s.proxyRoutes.length})`
                : `현재 도메인 라우트 (${s.matchedProxyRoutes.length})`}
            </span>
            {s.proxyRoutes.length > 0 && (
              <button
                type="button"
                onClick={() => s.setShowAllProxyRoutes(!s.showAllProxyRoutes)}
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#38bdf8",
                  fontSize: "9px",
                  fontWeight: "700",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                {s.showAllProxyRoutes ? "🎯 현재 도메인만" : `🌐 전체 보기 (${s.proxyRoutes.length})`}
              </button>
            )}
          </div>

          {s.matchedProxyRoutes.length === 0 ? (
            <div style={{ padding: "12px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>
              {s.showAllProxyRoutes
                ? "등록된 로컬 프록시 라우트가 없습니다."
                : `현재 도메인(${window.location.hostname})에 매칭되는 라우트가 없습니다.`}
            </div>
          ) : (
            s.matchedProxyRoutes.map((route) => (
              <div
                key={route.id}
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      fontWeight: "700",
                      fontSize: "11px",
                      color: "#f3f4f6",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {route.domain}
                  </span>
                  <span style={{ fontSize: "10px", color: "#38bdf8", fontFamily: "monospace" }}>
                    ➔ {route.target_host}:{route.target_port}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => s.handleToggleProxyRoute(route.id, !route.enabled)}
                  style={{
                    backgroundColor: route.enabled ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.1)",
                    border: `1px solid ${route.enabled ? "#10b981" : "rgba(255,255,255,0.2)"}`,
                    color: route.enabled ? "#10b981" : "rgba(255,255,255,0.5)",
                    fontSize: "10px",
                    fontWeight: "800",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginLeft: "8px",
                    flexShrink: 0,
                  }}
                >
                  {route.enabled ? "ON" : "OFF"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
