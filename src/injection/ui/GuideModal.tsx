import type { InjectionAppState } from "../hooks/useInjectionAppState";

type State = Pick<
  InjectionAppState,
  | "dragOffset"
  | "currentPagePolicies"
  | "isInspectMode"
  | "setIsInspectMode"
  | "showPolicyBadges"
  | "setShowPolicyBadges"
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
        width: "360px",
        maxHeight: "65vh",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(16px)",
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
          <span style={{ color: "#ec4899", fontSize: "14px" }}>📌</span>
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
          🔍 {s.isInspectMode ? "선택 중..." : "요소 선택 (인스펙터)"}
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
          👁️ 배지 {s.showPolicyBadges ? "ON" : "OFF"}
        </button>
      </div>

      {s.currentPagePolicies.length === 0 ? (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>
          현재 페이지에 등록된 가이드가 없습니다.
          <br />
          <span style={{ fontSize: "11px", opacity: 0.8, marginTop: "6px", display: "block" }}>
            '🔍 요소 선택' 버튼을 눌러 화면 요소를 지정하세요.
          </span>
        </div>
      ) : (
        <div style={{ overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {s.currentPagePolicies.map((ann, idx) => (
            <div
              key={ann.id}
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
                      backgroundColor: "#ec4899",
                      color: "white",
                      fontSize: "9px",
                      fontWeight: "900",
                      padding: "1px 5px",
                      borderRadius: "4px",
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <span style={{ fontWeight: "700", color: "#f3f4f6" }}>{ann.role}</span>
                </div>
                <button
                  type="button"
                  onClick={() => s.deleteAnnotation(ann.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: "2px",
                  }}
                  title="삭제"
                >
                  🗑️
                </button>
              </div>
              {ann.description && (
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>{ann.description}</div>
              )}
              <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>
                {ann.selector}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
