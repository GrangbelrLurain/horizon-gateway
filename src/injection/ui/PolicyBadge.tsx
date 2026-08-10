import { ArrowUpCircle, Copy, Edit3, FileText, Pin, Target, Trash2 } from "lucide-react";
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

const persistThrottleMs = 30_000;
const lastPersistedAt = new Map<string, number>();

export function PolicyBadge({
  annotation,
  index,
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
  annotation: Annotation;
  index: number;
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
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [validation, setValidation] = useState<LocatorValidation | null>(annotation.lastValidation ?? null);
  const lastStatusRef = useRef<string | null>(null);

  const updatePosition = useCallback(() => {
    const { el, validation: nextValidation } = resolveAnnotation(annotation);
    setValidation(nextValidation);

    if (onValidation && lastStatusRef.current !== nextValidation.status) {
      lastStatusRef.current = nextValidation.status;
      const prev = lastPersistedAt.get(annotation.id) ?? 0;
      if (Date.now() - prev > persistThrottleMs) {
        lastPersistedAt.set(annotation.id, Date.now());
        onValidation(annotation, nextValidation);
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
  }, [annotation, onValidation, rect]);

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

  const status = validation?.status ?? "broken";
  const statusMeta = STATUS_COLOR[status] ?? STATUS_COLOR.broken;
  const locators = ensureLocators(annotation);
  const suggestIdx = validation?.suggestPromoteTo ?? null;
  const canPromote = status === "weak" && suggestIdx != null && onPromote;

  // broken / ambiguous with no unique element: no floating badge
  if (!rect || rect.width === 0 || rect.height === 0) {
    return null;
  }
  if (rect.top === 0 && rect.left === 0) {
    return null;
  }

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

  return (
    <div
      style={{
        position: "fixed",
        top: rect.top - 12,
        left: rect.left - 12,
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
        title={`locator: ${statusMeta.label}`}
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          backgroundImage: badgeBg,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: "900",
          cursor: "pointer",
          boxShadow: isActive ? "0 0 16px rgba(239, 68, 68, 0.6)" : "0 4px 14px rgba(59, 130, 246, 0.5)",
          border: `2px solid ${statusMeta.border}`,
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          transform: isActive ? "scale(1.15)" : "scale(1)",
        }}
      >
        {index}
      </div>
      {isActive && (
        <div
          style={{
            position: "absolute",
            top: "32px",
            left: "0",
            width: "320px",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "380px",
            overflowY: "auto",
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.96) 100%)",
            color: "white",
            padding: "16px",
            borderRadius: "16px",
            boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            zIndex: 2147483645,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Pin style={{ width: "14px", height: "14px", color: "#60a5fa" }} />
              <h4
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "800",
                  background: "linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.01em",
                }}
              >
                {annotation.role}
              </h4>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="수정"
                >
                  <Edit3 style={{ width: "12px", height: "12px" }} />
                  <span>수정</span>
                </button>
              )}
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

          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
            primary: {locators[0]?.strategy ?? "—"}
            {validation?.resolvedBy != null && validation.resolvedBy > 0
              ? ` · resolved via #${validation.resolvedBy} (${locators[validation.resolvedBy]?.strategy})`
              : ""}
          </div>

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
