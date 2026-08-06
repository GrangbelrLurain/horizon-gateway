import type { InjectionAppState } from "../hooks/useInjectionAppState";

type State = Pick<
  InjectionAppState,
  | "dragOffset"
  | "apiTrafficLogs"
  | "setApiTrafficLogs"
  | "logSearchQuery"
  | "setLogSearchQuery"
  | "setEditingMockRule"
  | "setSelectedLogDetail"
  | "closeAllPopovers"
>;

export function TrafficLogPopover({ s }: { s: State }) {
  return (
    <div
      style={{
        position: "fixed",
        right: `${s.dragOffset.x}px`,
        bottom: `${s.dragOffset.y + 48}px`,
        width: "420px",
        maxHeight: "65vh",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(16px)",
        borderRadius: "16px",
        border: "1px solid rgba(59, 130, 246, 0.4)",
        boxShadow: "0 20px 50px -10px rgba(0,0,0,0.7), 0 0 20px rgba(59, 130, 246, 0.15)",
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
          backgroundColor: "rgba(59, 130, 246, 0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#3b82f6", fontSize: "14px" }}>📡</span>
          <span style={{ fontWeight: "700", fontSize: "13px", color: "#3b82f6" }}>
            실시간 API 통신 로그 ({s.apiTrafficLogs.length})
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {s.apiTrafficLogs.length > 0 && (
            <button
              type="button"
              onClick={() => s.setApiTrafficLogs([])}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontSize: "11px",
                padding: "2px 6px",
              }}
              title="지우기"
            >
              🧹 지우기
            </button>
          )}
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
      </div>

      {/* Log Search Input */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <input
          type="text"
          placeholder="🔍 URL 또는 Method로 검색..."
          value={s.logSearchQuery}
          onChange={(e) => s.setLogSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 10px",
            borderRadius: "8px",
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "white",
            fontSize: "11px",
            outline: "none",
          }}
        />
      </div>

      {s.apiTrafficLogs.length === 0 ? (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>
          현재 페이지에서 감지된 API 요청이 없습니다.
        </div>
      ) : (
        <div style={{ overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {s.apiTrafficLogs
            .filter(
              (log) =>
                !s.logSearchQuery ||
                log.url.toLowerCase().includes(s.logSearchQuery.toLowerCase()) ||
                log.method.toLowerCase().includes(s.logSearchQuery.toLowerCase()),
            )
            .map((log) => (
              <div
                key={log.id}
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  fontSize: "11px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        backgroundColor: log.method === "GET" ? "#3b82f6" : "#10b981",
                        color: "white",
                        fontSize: "9px",
                        fontWeight: "900",
                        padding: "1px 5px",
                        borderRadius: "4px",
                      }}
                    >
                      {log.method}
                    </span>
                    <span
                      style={{
                        backgroundColor:
                          log.status >= 200 && log.status < 300 ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: log.status >= 200 && log.status < 300 ? "#10b981" : "#ef4444",
                        fontSize: "9px",
                        fontWeight: "800",
                        padding: "1px 5px",
                        borderRadius: "4px",
                      }}
                    >
                      {log.status}
                    </span>
                    {log.isMocked && (
                      <span
                        style={{
                          backgroundColor: "rgba(245, 158, 11, 0.2)",
                          color: "#f59e0b",
                          fontSize: "9px",
                          fontWeight: "800",
                          padding: "1px 5px",
                          borderRadius: "4px",
                        }}
                      >
                        MOCKED
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{log.duration}ms</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cleanUrl = log.url.split("?")[0];
                        s.setEditingMockRule({
                          name: `Mock for ${cleanUrl.split("/").pop() || "API"}`,
                          method: log.method,
                          url_pattern: cleanUrl,
                          response_status: log.status || 200,
                          response_body: '{\n  "mocked": true\n}',
                          enabled: true,
                        });
                        s.closeAllPopovers();
                      }}
                      style={{
                        backgroundColor: "rgba(245, 158, 11, 0.2)",
                        border: "1px solid #f59e0b",
                        color: "#f59e0b",
                        fontSize: "9px",
                        fontWeight: "800",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                      title="이 API를 모킹 규칙으로 전환"
                    >
                      + Mock
                    </button>
                    <button
                      type="button"
                      onClick={() => s.setSelectedLogDetail(log)}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        color: "white",
                        fontSize: "9px",
                        fontWeight: "800",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                      title="상세 보기 및 복사"
                    >
                      상세
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "11px",
                    wordBreak: "break-all",
                    color: "#f3f4f6",
                    fontWeight: "600",
                  }}
                >
                  {log.url}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
