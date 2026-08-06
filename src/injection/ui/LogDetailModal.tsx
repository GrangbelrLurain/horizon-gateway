import type { InjectionAppState } from "../hooks/useInjectionAppState";
import { HeadersViewer } from "./HeadersViewer";
import { JsonViewer } from "./JsonViewer";

type State = Pick<
  InjectionAppState,
  | "selectedLogDetail"
  | "setSelectedLogDetail"
  | "activeDetailTab"
  | "setActiveDetailTab"
  | "setEditingMockRule"
  | "closeAllPopovers"
>;

export function LogDetailModal({ s }: { s: State }) {
  const selectedLogDetail = s.selectedLogDetail!;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        backgroundColor: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: "560px",
          maxHeight: "85vh",
          backgroundColor: "rgba(15, 23, 42, 0.98)",
          borderRadius: "16px",
          border: "1px solid rgba(59, 130, 246, 0.5)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.9)",
          padding: "20px",
          color: "white",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                backgroundColor: selectedLogDetail.method === "GET" ? "#3b82f6" : "#10b981",
                color: "white",
                fontSize: "10px",
                fontWeight: "900",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              {selectedLogDetail.method}
            </span>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#f3f4f6" }}>API 통신 상세 Log</h3>
          </div>
          <button
            type="button"
            onClick={() => s.setSelectedLogDetail(null)}
            style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "16px" }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "#f3f4f6",
            wordBreak: "break-all",
            fontFamily: "monospace",
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: "8px",
            borderRadius: "6px",
          }}
        >
          {selectedLogDetail.url}
        </div>

        <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
          <span>
            Status:{" "}
            <strong style={{ color: selectedLogDetail.status < 300 ? "#10b981" : "#ef4444" }}>
              {selectedLogDetail.status}
            </strong>
          </span>
          <span>
            Latency: <strong>{selectedLogDetail.duration}ms</strong>
          </span>
          {selectedLogDetail.isMocked && <strong style={{ color: "#f59e0b" }}>[MOCKED]</strong>}
        </div>

        {/* Modal Tabs */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            paddingBottom: "6px",
          }}
        >
          <button
            type="button"
            onClick={() => s.setActiveDetailTab("response")}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              backgroundColor: s.activeDetailTab === "response" ? "rgba(59, 130, 246, 0.3)" : "transparent",
              border: s.activeDetailTab === "response" ? "1px solid #3b82f6" : "none",
              color: s.activeDetailTab === "response" ? "#60a5fa" : "rgba(255,255,255,0.6)",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            ⚡ Response Body
          </button>
          <button
            type="button"
            onClick={() => s.setActiveDetailTab("request")}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              backgroundColor: s.activeDetailTab === "request" ? "rgba(59, 130, 246, 0.3)" : "transparent",
              border: s.activeDetailTab === "request" ? "1px solid #3b82f6" : "none",
              color: s.activeDetailTab === "request" ? "#60a5fa" : "rgba(255,255,255,0.6)",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            📤 Request Body {selectedLogDetail.requestBody ? "•" : ""}
          </button>
          <button
            type="button"
            onClick={() => s.setActiveDetailTab("headers")}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              backgroundColor: s.activeDetailTab === "headers" ? "rgba(59, 130, 246, 0.3)" : "transparent",
              border: s.activeDetailTab === "headers" ? "1px solid #3b82f6" : "none",
              color: s.activeDetailTab === "headers" ? "#60a5fa" : "rgba(255,255,255,0.6)",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            📋 Headers
          </button>
        </div>

        {/* Tab Body Contents */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
          {s.activeDetailTab === "response" &&
            (selectedLogDetail.responseBody ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minHeight: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
                    Response Data (Foldable Tree)
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(selectedLogDetail.responseBody || "")}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.1)",
                      border: "none",
                      color: "#38bdf8",
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    📋 Response 복사
                  </button>
                </div>
                <JsonViewer src={selectedLogDetail.responseBody} />
              </div>
            ) : (
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                Response Body가 비어있거나 스트리밍 바이너리 데이터입니다.
              </div>
            ))}

          {s.activeDetailTab === "request" &&
            (selectedLogDetail.requestBody ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minHeight: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>Request Data</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(selectedLogDetail.requestBody || "")}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.1)",
                      border: "none",
                      color: "#38bdf8",
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    📋 Request 복사
                  </button>
                </div>
                <JsonViewer src={selectedLogDetail.requestBody} />
              </div>
            ) : (
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                Request Body (전송된 데이터)가 존재하지 않습니다 (GET 또는 Body 없음).
              </div>
            ))}

          {s.activeDetailTab === "headers" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#38bdf8", marginBottom: "4px" }}>
                  Request Headers
                </div>
                <HeadersViewer headers={selectedLogDetail.requestHeaders} />
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#10b981", marginBottom: "4px" }}>
                  Response Headers
                </div>
                <HeadersViewer headers={selectedLogDetail.responseHeaders} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(selectedLogDetail.url)}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            📋 URL 복사
          </button>
          <button
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(`curl -X ${selectedLogDetail.method} "${selectedLogDetail.url}"`)
            }
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            📋 cURL 복사
          </button>
          <button
            type="button"
            onClick={() => {
              const cleanUrl = selectedLogDetail.url.split("?")[0];
              s.setEditingMockRule({
                name: `Mock for ${cleanUrl.split("/").pop() || "API"}`,
                method: selectedLogDetail.method,
                url_pattern: cleanUrl,
                response_status: selectedLogDetail.status || 200,
                response_body: selectedLogDetail.responseBody || '{\n  "mocked": true\n}',
                enabled: true,
              });
              s.setSelectedLogDetail(null);
              s.closeAllPopovers();
            }}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              backgroundColor: "#f59e0b",
              border: "none",
              color: "black",
              fontSize: "11px",
              fontWeight: "800",
              cursor: "pointer",
            }}
          >
            ⚡ 이 API 모킹 규칙 생성
          </button>
        </div>
      </div>
    </div>
  );
}
