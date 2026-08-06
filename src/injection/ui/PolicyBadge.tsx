import { useCallback, useEffect, useState } from "react";
import type { Annotation } from "@/entities/inspector";

export function PolicyBadge({
  annotation,
  index,
  isActive,
  onToggle,
}: {
  annotation: Annotation;
  index: number;
  isActive: boolean;
  onToggle: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const updatePosition = useCallback(() => {
    let el: HTMLElement | null = null;
    try {
      // 1. Strict Match
      el = document.querySelector(annotation.selector);

      // 2. ID-only Match (if selector has an ID)
      if (!el && annotation.selector.includes("#")) {
        const idMatch = annotation.selector.match(/#([a-zA-Z0-9_-]+)/);
        if (idMatch) {
          el = document.getElementById(idMatch[1]);
        }
      }

      // 3. Fuzzy Match (Tag + Text + Attributes)
      if (!el && annotation.content) {
        const elements = document.getElementsByTagName(annotation.tagName);
        const searchTxt = annotation.content.trim().substring(0, 20);

        let bestMatch: HTMLElement | null = null;
        let highestScore = 0;

        for (const candidate of Array.from(elements)) {
          let score = 0;
          const text = candidate.textContent || "";

          // Weighted similarity check
          if (text.includes(searchTxt)) {
            score += 10;
          }
          if (text === annotation.content) {
            score += 20;
          }

          // Check for attribute matches
          if (annotation.selector.includes("[data-testid")) {
            const tid = annotation.selector.match(/data-testid="([^"]+)"/);
            if (tid && candidate.getAttribute("data-testid") === tid[1]) {
              score += 50;
            }
          }

          if (score > highestScore) {
            highestScore = score;
            bestMatch = candidate as HTMLElement;
          }
        }

        if (highestScore > 5) {
          el = bestMatch;
        }
      }
    } catch (_e) {}

    if (el) {
      const newRect = el.getBoundingClientRect();
      if (!rect || Math.abs(newRect.top - rect.top) > 0.5 || Math.abs(newRect.left - rect.left) > 0.5) {
        setRect(newRect);
      }
    } else {
      if (rect) {
        setRect(null);
      }
    }
  }, [annotation, rect]);

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

  if (!rect) {
    return null;
  }

  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  // Skip rendering if the element is at (0,0) - likely a top-level wrapper or misplaced match
  if (rect.top === 0 && rect.left === 0) {
    return null;
  }

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
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          backgroundColor: isActive ? "#ef4444" : "#3b82f6",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: "900",
          cursor: "pointer",
          boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
          border: "2px solid white",
          transition: "all 0.2s",
          transform: isActive ? "scale(1.1)" : "scale(1)",
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
            width: "240px",
            backgroundColor: "rgba(30, 41, 59, 0.95)",
            backdropFilter: "blur(8px)",
            color: "white",
            padding: "16px",
            borderRadius: "16px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.15)",
            zIndex: 2147483645,
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "800", color: "#3b82f6" }}>
            {annotation.role}
          </h4>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.8)", lineHeight: "1.5" }}>
            {annotation.description}
          </p>
        </div>
      )}
    </div>
  );
}
