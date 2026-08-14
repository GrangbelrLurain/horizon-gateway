import { ArrowUpCircle, Copy, Edit3, FileText, Pin, Target, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Annotation, LocatorValidation } from "@/entities/inspector";
import { MarkdownRenderer } from "@/shared/lib/MarkdownRenderer";
import { ensureLocators, resolveAnnotation } from "../lib/locator";

const STATUS_COLOR: Record<string, { bg: string; border: string; label: string }> = {
  ok: { bg: "#22c55e", border: "#86efac", label: "ok" },
  weak: { bg: "#f59e0b", border: "#fcd34d", label: "weak" },
  broken: { bg: "#ef4444", border: "#fca5a5", label: "broken" },
  ambiguous: { bg: "#a855f7", border: "#d8b4fe", label: "ambiguous" },
};

function isSameValidation(a: LocatorValidation | null, b: LocatorValidation | null): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (a.status !== b.status) {
    return false;
  }
  if (a.primaryMatches !== b.primaryMatches) {
    return false;
  }
  if (a.resolvedBy !== b.resolvedBy) {
    return false;
  }
  if (a.suggestPromoteTo !== b.suggestPromoteTo) {
    return false;
  }
  if (a.fallbackMatches.length !== b.fallbackMatches.length) {
    return false;
  }
  for (let i = 0; i < a.fallbackMatches.length; i++) {
    if (a.fallbackMatches[i] !== b.fallbackMatches[i]) {
      return false;
    }
  }
  return true;
}

export interface PolicyBadgeGroupItem {
  annotation: Annotation;
  index: number;
}

export function PolicyBadge({
  annotation: singleAnnotation,
  index,
  items,
  isActive,
  onToggle,
  onEdit,
  onCopyDescription,
  onCopySelector,
  onCopySummary,
  onDelete,
  onPromote,
  onValidation,
}: {
  annotation?: Annotation;
  index?: number;
  items?: PolicyBadgeGroupItem[];
  isActive: boolean;
  onToggle: () => void;
  onEdit?: (ann: Annotation) => void;
  onCopyDescription?: (ann: Annotation) => void;
  onCopySelector?: (ann: Annotation) => void;
  onCopySummary?: (ann: Annotation) => void;
  onDelete?: (id: string) => void;
  onPromote?: (ann: Annotation, promoteIndex: number) => void;
  onValidation?: (ann: Annotation, validation: LocatorValidation) => void;
}) {
  const badgeItems: PolicyBadgeGroupItem[] =
    items && items.length > 0
      ? items
      : singleAnnotation && index != null
        ? [{ annotation: singleAnnotation, index }]
        : [];

  const [activeSubIndex, setActiveSubIndex] = useState(0);
  const currentItem = badgeItems[activeSubIndex] || badgeItems[0];
  const targetAnnotation = currentItem?.annotation;
  const primaryAnnotation = badgeItems[0]?.annotation;

  const [rect, setRect] = useState<DOMRect | null>(null);
  const [validation, setValidation] = useState<LocatorValidation | null>(targetAnnotation?.lastValidation ?? null);
  const lastValidationRef = useRef<LocatorValidation | null>(targetAnnotation?.lastValidation ?? null);

  const updatePosition = useCallback(() => {
    if (!primaryAnnotation) {
      return;
    }
    const { el, validation: nextValidation } = resolveAnnotation(primaryAnnotation);

    if (!isSameValidation(lastValidationRef.current, nextValidation)) {
      lastValidationRef.current = nextValidation;
      setValidation(nextValidation);
      if (onValidation) {
        onValidation(primaryAnnotation, nextValidation);
      }
    }

    if (el) {
      const newRect = el.getBoundingClientRect();
      if (!rect || Math.abs(newRect.top - rect.top) > 0.5 || Math.abs(newRect.left - rect.left) > 0.5) {
        setRect(newRect);
      }
    } else if (rect) {
      setRect(null);
    }
  }, [primaryAnnotation, onValidation, rect]);

  useEffect(() => {
    updatePosition();
    const t = setInterval(updatePosition, 1000);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      clearInterval(t);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [updatePosition]);

  // broken / ambiguous with no unique element: no floating badge
  if (!targetAnnotation || !rect || rect.width === 0 || rect.height === 0) {
    return null;
  }
  if (rect.top === 0 && rect.left === 0) {
    return null;
  }

  const annotation = targetAnnotation;
  const status = validation?.status ?? "broken";
  const statusMeta = STATUS_COLOR[status] ?? STATUS_COLOR.broken;
  const locators = ensureLocators(annotation);
  const suggestIdx = validation?.suggestPromoteTo ?? null;
  const canPromote = status === "weak" && suggestIdx != null && onPromote;

  const isCluster = badgeItems.length > 1;
  const badgeLabel = isCluster ? `${badgeItems[0].index}+` : `${badgeItems[0]?.index ?? 1}`;

  const badgeBg =
    status === "ok"
      ? isActive
        ? "linear-gradient(135deg, #f87171 0%, #dc2626 100%)"
        : "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)"
      : status === "weak"
        ? "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)"
        : status === "ambiguous"
          ? "linear-gradient(135deg, #c084fc 0%, #7e22ce 100%)"
          : "linear-gradient(135deg, #f87171 0%, #b91c1c 100%)";

  const dotLeft = Math.max(4, Math.min((rect?.left ?? 16) - 12, window.innerWidth - 32));
  const dotTop = Math.max(4, Math.min((rect?.top ?? 16) - 12, window.innerHeight - 32));

  return (
    <div
      style={{
        position: "fixed",
        top: `${dotTop}px`,
        left: `${dotLeft}px`,
        zIndex: 2147483640,
        pointerEvents: "auto",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            onToggle();
          }
        }}
        title={`locator: ${statusMeta.label}${isCluster ? ` (${badgeItems.length} policies)` : ""}`}
        style={{
          width: isCluster ? "28px" : "24px",
          height: isCluster ? "28px" : "24px",
          borderRadius: "50%",
          backgroundImage: badgeBg,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: isCluster ? "10px" : "11px",
          fontWeight: "900",
          cursor: "pointer",
          boxShadow: isCluster
            ? "0 0 16px rgba(96, 165, 250, 0.7), 3px 3px 0 rgba(236, 72, 153, 0.5)"
            : isActive
              ? "0 0 16px rgba(239, 68, 68, 0.6)"
              : "0 4px 14px rgba(59, 130, 246, 0.5)",
          border: `2px solid ${statusMeta.border}`,
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          transform: isActive ? "scale(1.15)" : "scale(1)",
        }}
      >
        {badgeLabel}
      </div>
      {isActive && (
        <div
          style={{
            position: "fixed",
            top:
              rect && rect.bottom + 280 > window.innerHeight
                ? "auto"
                : `${Math.max(16, Math.min(dotTop + 28, window.innerHeight - 200))}px`,
            bottom:
              rect && rect.bottom + 280 > window.innerHeight
                ? `${Math.max(16, window.innerHeight - dotTop + 4)}px`
                : "auto",
            left: `${Math.max(16, Math.min(dotLeft, window.innerWidth - 456))}px`,
            minWidth: "280px",
            width: "max-content",
            maxWidth: "min(440px, calc(100vw - 32px))",
            maxHeight:
              rect && rect.bottom + 280 > window.innerHeight
                ? `${Math.max(160, Math.min(420, dotTop - 20))}px`
                : `${Math.max(160, Math.min(420, window.innerHeight - dotTop - 44))}px`,
            overflowY: "auto",
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.96) 100%)",
            color: "white",
            padding: "16px",
            borderRadius: "16px",
            boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
            border: "1px solid rgba(59, 130, 246, 0.35)",
            zIndex: 2147483645,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {isCluster && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                backgroundColor: "rgba(0, 0, 0, 0.35)",
                padding: "4px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                overflowX: "auto",
              }}
            >
              {badgeItems.map((item, idx) => {
                const isTabActive = activeSubIndex === idx;
                return (
                  <button
                    key={item.annotation.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSubIndex(idx);
                    }}
                    style={{
                      background: isTabActive
                        ? "linear-gradient(135deg, #ec4899 0%, #3b82f6 100%)"
                        : "rgba(255, 255, 255, 0.05)",
                      border: isTabActive ? "1px solid rgba(255, 255, 255, 0.3)" : "none",
                      borderRadius: "7px",
                      color: isTabActive ? "white" : "rgba(255, 255, 255, 0.6)",
                      fontSize: "10px",
                      fontWeight: "800",
                      padding: "4px 9px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>#{item.index}</span>
                    <span
                      style={{ maxWidth: "85px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {item.annotation.role}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
              <Pin style={{ width: "14px", height: "14px", color: "#60a5fa", flexShrink: 0 }} />
              <h4
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "800",
                  background: "linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.01em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {annotation.role}
              </h4>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: "999px",
                  background: `${statusMeta.bg}33`,
                  color: statusMeta.border,
                  border: `1px solid ${statusMeta.border}55`,
                }}
              >
                {statusMeta.label}
              </span>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(annotation)}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "6px",
                    color: "#f472b6",
                    cursor: "pointer",
                    padding: "3px 7px",
                    fontSize: "11px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="수정"
                >
                  <Edit3 style={{ width: "11px", height: "11px" }} />
                  <span>수정</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.5)",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                }}
                title="닫기"
              >
                <X style={{ width: "15px", height: "15px" }} />
              </button>
            </div>
          </div>

          <MarkdownRenderer
            content={annotation.description}
            style={{ fontSize: "12px", color: "rgba(241, 245, 249, 0.9)" }}
            codeStyle={{
              backgroundColor: "rgba(99, 102, 241, 0.15)",
              color: "#a5b4fc",
              border: "1px solid rgba(165, 180, 252, 0.25)",
            }}
          />

          {locators.length > 1 && (
            <div style={{ fontSize: "9.5px", color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
              primary: {locators[0]?.strategy ?? "—"}
              {validation?.resolvedBy != null && validation.resolvedBy > 0
                ? ` · resolved via #${validation.resolvedBy} (${locators[validation.resolvedBy]?.strategy})`
                : ""}
            </div>
          )}

          {canPromote && suggestIdx != null && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPromote?.(annotation, suggestIdx);
              }}
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                border: "none",
                borderRadius: "8px",
                color: "white",
                cursor: "pointer",
                padding: "8px 10px",
                fontSize: "11px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <ArrowUpCircle style={{ width: "14px", height: "14px" }} />
              fallback #{suggestIdx} ({locators[suggestIdx]?.strategy})를 primary로 승격
            </button>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              paddingTop: "8px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              overflowX: "auto",
            }}
          >
            {onCopyDescription && (
              <button
                type="button"
                onClick={() => onCopyDescription(annotation)}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  color: "rgba(255, 255, 255, 0.8)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontSize: "10px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                }}
                title="설명 복사"
              >
                <Copy style={{ width: "11px", height: "11px", color: "#60a5fa" }} />
                <span>설명 복사</span>
              </button>
            )}

            {onCopySelector && (
              <button
                type="button"
                onClick={() => onCopySelector(annotation)}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  color: "rgba(255, 255, 255, 0.8)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontSize: "10px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                }}
                title="Selector 복사"
              >
                <Target style={{ width: "11px", height: "11px", color: "#34d399" }} />
                <span>Selector</span>
              </button>
            )}

            {onCopySummary && (
              <button
                type="button"
                onClick={() => onCopySummary(annotation)}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  color: "rgba(255, 255, 255, 0.8)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontSize: "10px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                }}
                title="요약 복사"
              >
                <FileText style={{ width: "11px", height: "11px", color: "#fbbf24" }} />
                <span>요약 복사</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(annotation.id)}
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "6px",
                  color: "#f87171",
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontSize: "10px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  marginLeft: "auto",
                  whiteSpace: "nowrap",
                }}
                title="삭제"
              >
                <Trash2 style={{ width: "11px", height: "11px" }} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
