import { Activity, Search, Trash2, X } from "lucide-react";
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
        backgroundColor: "var(--wt-bg-panel)",
        borderRadius: "16px",
        border: "1px solid var(--wt-border-primary)",
        boxShadow: "var(--wt-shadow)",
        color: "var(--wt-text-main)",
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
          borderBottom: "1px solid var(--wt-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "var(--wt-bg-active)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Activity style={{ width: "15px", height: "15px", color: "var(--color-primary)" }} />
          <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--color-primary)" }}>
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
                color: "var(--wt-text-muted)",
                cursor: "pointer",
                fontSize: "11px",
                padding: "4px 6px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                borderRadius: "4px",
              }}
              title="지우기"
            >
              <Trash2 style={{ width: "12px", height: "12px" }} />
              <span>지우기</span>
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
              color: "var(--wt-text-muted)",
              cursor: "pointer",
              padding: "2px 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
            }}
            title="닫기"
          >
            <X style={{ width: "16px", height: "16px" }} />
          </button>
        </div>
      </div>

      {/* Log Search Input */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--wt-border)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "var(--wt-bg-card)",
            border: "1px solid var(--wt-border)",
            borderRadius: "8px",
            padding: "4px 10px",
          }}
        >
          <Search style={{ width: "13px", height: "13px", color: "var(--wt-text-muted)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="URL 또는 Method로 검색..."
            value={s.logSearchQuery}
            onChange={(e) => s.setLogSearchQuery(e.target.value)}
            style={{
              width: "100%",
              backgroundColor: "transparent",
              border: "none",
              color: "var(--wt-text-main)",
              fontSize: "11px",
              outline: "none",
              padding: "2px 0",
            }}
          />
        </div>
      </div>

      {s.apiTrafficLogs.length === 0 ? (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--wt-text-muted)", fontSize: "12px" }}>
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
                  backgroundColor: "var(--wt-bg-card)",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  fontSize: "11px",
                  border: "1px solid var(--wt-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        backgroundColor:
                          log.method === "GET" ? "var(--color-primary, #3b82f6)" : "var(--color-success, #10b981)",
                        color: "var(--color-primary-content, white)",
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
                          log.status >= 200 && log.status < 300
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                        color:
                          log.status >= 200 && log.status < 300
                            ? "var(--color-success, #10b981)"
                            : "var(--color-error, #ef4444)",
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
                          backgroundColor: "rgba(245, 158, 11, 0.15)",
                          color: "var(--color-warning, #f59e0b)",
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
                    <span style={{ fontSize: "10px", color: "var(--wt-text-muted)" }}>{log.duration}ms</span>
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
                        backgroundColor: "rgba(245, 158, 11, 0.15)",
                        border: "1px solid var(--color-warning, #f59e0b)",
                        color: "var(--color-warning, #f59e0b)",
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
                        backgroundColor: "var(--wt-bg-subtle)",
                        border: "1px solid var(--wt-border)",
                        color: "var(--wt-text-main)",
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
                    color: "var(--wt-text-main)",
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
