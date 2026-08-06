import type { InjectionAppState } from "../hooks/useInjectionAppState";
import { StatusDot } from "./StatusDot";

type State = Pick<
  InjectionAppState,
  | "dragOffset"
  | "setDragOffset"
  | "status"
  | "mockedRequests"
  | "apiTrafficLogs"
  | "currentPagePolicies"
  | "isInspectMode"
  | "isDocked"
  | "setIsDocked"
  | "isHovered"
  | "isDragging"
  | "isCompact"
  | "setIsCompact"
  | "handleMouseEnter"
  | "handleMouseLeave"
  | "handleDragStart"
  | "hasMoved"
  | "editingElement"
  | "isPrxPopoverOpen"
  | "setIsPrxPopoverOpen"
  | "isMockListOpen"
  | "setIsMockListOpen"
  | "isLogPopoverOpen"
  | "setIsLogPopoverOpen"
  | "isGuideModalOpen"
  | "setIsGuideModalOpen"
  | "closeAllPopovers"
>;

export function Toolbar({ s }: { s: State }) {
  return (
    <>
      {s.isDocked && !s.isHovered && !s.editingElement && (
        <div
          style={{
            position: "fixed",
            bottom: `${s.dragOffset.y}px`,
            right: "0px",
            zIndex: 2147483647,
            pointerEvents: "auto",
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(12px)",
            padding: "8px 12px",
            borderRadius: "100px 0 0 100px",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRight: "none",
            boxShadow: "0 10px 30px -5px rgba(0,0,0,0.6)",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontFamily: "sans-serif",
            userSelect: "none",
            transition: "all 0.2s ease-in-out",
          }}
          onMouseEnter={s.handleMouseEnter}
          onMouseDown={s.handleDragStart}
          onClick={(e) => {
            if (!s.hasMoved.current) {
              e.stopPropagation();
              s.setIsDocked(false);
              s.setDragOffset({ x: 24, y: s.dragOffset.y });
            }
          }}
          title="클릭/호버하여 툴바 펼치기"
        >
          <span style={{ fontSize: "12px", fontWeight: "900", color: "#f59e0b" }}>⟨</span>
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: s.mockedRequests.length > 0 ? "#f59e0b" : s.status.proxy ? "#10b981" : "#6b7280",
              boxShadow: s.mockedRequests.length > 0 ? "0 0 8px #f59e0b" : "none",
            }}
          />
        </div>
      )}

      {/* Full Status Bar */}
      {!s.editingElement && (!s.isDocked || s.isHovered) && (
        <div
          style={{
            position: "fixed",
            bottom: `${s.dragOffset.y}px`,
            right: s.isDocked ? "0px" : `${s.dragOffset.x}px`,
            zIndex: 2147483647,
            pointerEvents: "auto",
            transition: s.isDragging ? "none" : "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          onMouseEnter={s.handleMouseEnter}
          onMouseLeave={s.handleMouseLeave}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(12px)",
              padding: "4px 8px",
              borderRadius: s.isDocked ? "100px 0 0 100px" : "100px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRight: s.isDocked ? "none" : "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
              color: "white",
              fontFamily: "sans-serif",
              cursor: s.isDragging ? "grabbing" : "grab",
            }}
            onMouseDown={s.handleDragStart}
          >
            {s.isCompact ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  s.setIsCompact(false);
                }}
                title="클릭하여 툴바 펼치기"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "2px 4px",
                }}
              >
                <img
                  src="/.horizon-gateway/logo.svg"
                  alt="Watchtower Logo"
                  style={{ width: "18px", height: "18px", display: "block" }}
                />
              </div>
            ) : (
              <div
                style={{ display: "flex", gap: "8px", padding: "2px 4px", userSelect: "none", alignItems: "center" }}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !s.isPrxPopoverOpen;
                    s.closeAllPopovers();
                    s.setIsPrxPopoverOpen(next);
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="클릭하여 로컬 프록시 상태 보기"
                >
                  <StatusDot
                    active={s.status.proxy}
                    color="#10b981"
                    label={s.status.proxy && (s.status.proxyCount ?? 0) > 0 ? `PRX (${s.status.proxyCount})` : "PRX"}
                  />
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !s.isMockListOpen;
                    s.closeAllPopovers();
                    s.setIsMockListOpen(next);
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="클릭하여 모킹된 API 목록 보기"
                >
                  <StatusDot
                    active={s.mockedRequests.length > 0}
                    color="#f59e0b"
                    label={s.mockedRequests.length > 0 ? `MCK (${s.mockedRequests.length})` : "MCK"}
                  />
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !s.isLogPopoverOpen;
                    s.closeAllPopovers();
                    s.setIsLogPopoverOpen(next);
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="클릭하여 실시간 API 통신 로그 보기"
                >
                  <StatusDot
                    active={s.apiTrafficLogs.length > 0}
                    color="#3b82f6"
                    label={s.apiTrafficLogs.length > 0 ? `LOG (${s.apiTrafficLogs.length})` : "LOG"}
                  />
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !s.isGuideModalOpen;
                    s.closeAllPopovers();
                    s.setIsGuideModalOpen(next);
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="클릭하여 가이드 관리 및 탐색기 열기"
                >
                  <StatusDot
                    active={s.currentPagePolicies.length > 0 || s.isInspectMode}
                    color="#ec4899"
                    label={s.currentPagePolicies.length > 0 ? `GUIDE (${s.currentPagePolicies.length})` : "GUIDE"}
                  />
                </div>

                {/* Dock & Compact Quick Controls */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    borderLeft: "1px solid rgba(255,255,255,0.15)",
                    paddingLeft: "6px",
                    marginLeft: "2px",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      s.setIsDocked(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.5)",
                      cursor: "pointer",
                      fontSize: "11px",
                      padding: "2px",
                    }}
                    title="화면 오른쪽 가장자리에 숨기기 ( ( | )"
                  >
                    📌
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      s.setIsCompact(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.5)",
                      cursor: "pointer",
                      fontSize: "11px",
                      padding: "2px",
                    }}
                    title="미니 아이콘 모드로 접기"
                  >
                    ↔
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
