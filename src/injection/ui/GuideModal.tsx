import { Copy, Edit3, Eye, FileText, Pin, Search, Target, Trash2, X } from "lucide-react";
import { MarkdownRenderer } from "@/shared/lib/MarkdownRenderer";
import type { InjectionAppState } from "../hooks/useInjectionAppState";

type State = Pick<
  InjectionAppState,
  | "dragOffset"
  | "currentPagePolicies"
  | "isInspectMode"
  | "setIsInspectMode"
  | "showPolicyBadges"
  | "setShowPolicyBadges"
  | "setEditingAnnotation"
  | "copyDescription"
  | "copySelector"
  | "copySummary"
  | "deleteAnnotation"
  | "closeAllPopovers"
>;

export function GuideModal({ s }: { s: State }) {
  return (
    <div
      style={{
        position: "fixed",
        right: `${s.dragOffset.x}px`,
        bottom: `${s.dragOffset.y + 48}px`,
        minWidth: "320px",
        width: "max-content",
        maxWidth: "min(440px, calc(100vw - 32px))",
        maxHeight: "65vh",
        backgroundColor: "rgba(15, 23, 42, 0.98)",
        borderRadius: "16px",
        border: "1px solid rgba(236, 72, 153, 0.4)",
        boxShadow: "0 20px 50px -10px rgba(0,0,0,0.7), 0 0 20px rgba(236, 72, 153, 0.15)",
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
          backgroundColor: "rgba(236, 72, 153, 0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Pin style={{ width: "15px", height: "15px", color: "#ec4899" }} />
          <span style={{ fontWeight: "700", fontSize: "13px", color: "#ec4899" }}>
            가이드 관리 ({s.currentPagePolicies.length})
          </span>
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
            padding: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="닫기"
        >
          <X style={{ width: "16px", height: "16px" }} />
        </button>
      </div>

      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.03)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            s.setIsInspectMode(!s.isInspectMode);
            s.closeAllPopovers();
          }}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: "8px",
            backgroundColor: s.isInspectMode ? "rgba(59, 130, 246, 0.3)" : "rgba(255,255,255,0.08)",
            border: s.isInspectMode ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
            color: "white",
            fontSize: "11px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <Search
            style={{ width: "13px", height: "13px", color: s.isInspectMode ? "#60a5fa" : "rgba(255,255,255,0.7)" }}
          />
          <span>{s.isInspectMode ? "선택 중..." : "요소 선택 (인스펙터)"}</span>
        </button>
        <button
          type="button"
          onClick={() => s.setShowPolicyBadges(!s.showPolicyBadges)}
          style={{
            padding: "6px 10px",
            borderRadius: "8px",
            backgroundColor: s.showPolicyBadges ? "rgba(236, 72, 153, 0.2)" : "rgba(255,255,255,0.08)",
            border: s.showPolicyBadges ? "1px solid #ec4899" : "1px solid rgba(255,255,255,0.12)",
            color: "white",
            fontSize: "11px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Eye
            style={{ width: "13px", height: "13px", color: s.showPolicyBadges ? "#f472b6" : "rgba(255,255,255,0.7)" }}
          />
          <span>배지 {s.showPolicyBadges ? "ON" : "OFF"}</span>
        </button>
      </div>

      {s.currentPagePolicies.length === 0 ? (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>
          현재 페이지에 등록된 가이드가 없습니다.
          <br />
          <span style={{ fontSize: "11px", opacity: 0.8, marginTop: "6px", display: "block" }}>
            '요소 선택' 버튼을 눌러 화면 요소를 지정하세요.
          </span>
        </div>
      ) : (
        <div
          style={{
            overflowY: "auto",
            overflowX: "hidden",
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {s.currentPagePolicies.map((ann, idx) => (
            <div
              key={ann.id}
              style={{
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.7) 100%)",
                borderRadius: "12px",
                padding: "10px 12px",
                fontSize: "11px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                maxWidth: "100%",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      backgroundColor: "rgba(236, 72, 153, 0.2)",
                      color: "#ec4899",
                      fontSize: "9px",
                      fontWeight: "900",
                      padding: "2px 6px",
                      borderRadius: "6px",
                      border: "1px solid rgba(236, 72, 153, 0.3)",
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <span style={{ fontWeight: "700", color: "#f8fafc", fontSize: "12px" }}>{ann.role}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => s.setEditingAnnotation(ann)}
                    style={{
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "4px",
                      color: "#f472b6",
                      cursor: "pointer",
                      padding: "3px 6px",
                      fontSize: "10px",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                    title="수정"
                  >
                    <Edit3 style={{ width: "11px", height: "11px" }} />
                    <span>수정</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => s.deleteAnnotation(ann.id, e)}
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      borderRadius: "4px",
                      color: "#f87171",
                      cursor: "pointer",
                      padding: "3px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="삭제"
                  >
                    <Trash2 style={{ width: "11px", height: "11px" }} />
                  </button>
                </div>
              </div>

              {ann.description && (
                <MarkdownRenderer
                  content={ann.description}
                  style={{ fontSize: "11px", color: "rgba(241, 245, 249, 0.88)" }}
                  codeStyle={{
                    backgroundColor: "rgba(99, 102, 241, 0.15)",
                    color: "#a5b4fc",
                    border: "1px solid rgba(165, 180, 252, 0.25)",
                  }}
                />
              )}

              <div
                style={{
                  fontSize: "9.5px",
                  fontFamily: "monospace",
                  color: "rgba(148, 163, 184, 0.6)",
                  wordBreak: "break-all",
                }}
              >
                {ann.selector}
              </div>

              {/* Action Toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  paddingTop: "6px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => s.copyDescription(ann, e)}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "4px",
                    color: "rgba(255, 255, 255, 0.75)",
                    cursor: "pointer",
                    padding: "3px 6px",
                    fontSize: "9.5px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                  title="설명 복사"
                >
                  <Copy style={{ width: "10px", height: "10px", color: "#60a5fa" }} />
                  <span>설명 복사</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => s.copySelector(ann, e)}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "4px",
                    color: "rgba(255, 255, 255, 0.75)",
                    cursor: "pointer",
                    padding: "3px 6px",
                    fontSize: "9.5px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                  title="Selector 복사"
                >
                  <Target style={{ width: "10px", height: "10px", color: "#34d399" }} />
                  <span>Selector</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => s.copySummary(ann, e)}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "4px",
                    color: "rgba(255, 255, 255, 0.75)",
                    cursor: "pointer",
                    padding: "3px 6px",
                    fontSize: "9.5px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                  title="요약 복사"
                >
                  <FileText style={{ width: "10px", height: "10px", color: "#fbbf24" }} />
                  <span>요약 복사</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
