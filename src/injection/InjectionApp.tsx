import html2canvas from "html2canvas";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Annotation } from "@/entities/domain/types/inspector";

type Position = "bottom-right" | "bottom-left" | "bottom-center" | "top-right" | "top-left" | "top-center";

interface EditingElement {
  tagName: string;
  selector: string;
  target: HTMLElement;
}

/**
 * Enhanced CSS Selector Generator
 * Prioritizes IDs, stable attributes, and relative paths for maximum reliability.
 */
function generateRobustSelector(el: HTMLElement): string {
  if (el.id && /^[a-zA-Z]/.test(el.id) && !/\d{5,}/.test(el.id)) {
    return `#${CSS.escape(el.id)}`;
  }

  const path: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.nodeName.toLowerCase();

    // 1. Check for stable ID
    if (current.id && /^[a-zA-Z]/.test(current.id) && !/\d{5,}/.test(current.id)) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break; // Found a stable anchor
    }

    // 2. Check for stable attributes
    const stableAttrs = ["data-testid", "data-qa", "name", "aria-label", "role"];
    let foundAttr = false;
    for (const attr of stableAttrs) {
      const val = current.getAttribute(attr);
      if (val) {
        selector += `[${attr}="${CSS.escape(val)}"]`;
        foundAttr = true;
        break;
      }
    }

    // 3. Fallback to nth-child if no stable attributes
    if (!foundAttr) {
      let index = 1;
      let sib = current.previousElementSibling;
      while (sib) {
        if (sib.nodeName === current.nodeName) {
          index++;
        }
        sib = sib.previousElementSibling;
      }
      if (index > 1 || current.nextElementSibling) {
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    if (current.nodeName.toLowerCase() === "html") {
      break;
    }
    current = current.parentElement;
  }

  return path.join(" > ");
}

/**
 * URL Normalizer to ensure consistent pathname matching
 */
function normalizeUrl(urlStr: string): { host: string; path: string } {
  try {
    const url = new URL(urlStr.split("/.watchtower")[0]);
    return {
      host: url.host,
      path: url.pathname.replace(/\/$/, "") || "/",
    };
  } catch (_e) {
    return { host: "", path: "" };
  }
}

export function InjectionApp() {
  const [isInspectMode, setIsInspectMode] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [position, setPosition] = useState<Position>("bottom-right");
  const [showPolicyBadges, setShowPolicyBadges] = useState(true);

  const [editingElement, setEditingElement] = useState<EditingElement | null>(null);
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [allAnnotations, setAnnotations] = useState<Annotation[]>([]);
  const [status, setStatus] = useState({ proxy: true, mocking: false, logging: true });
  const [isListOpen, setIsListOpen] = useState(false);
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);

  const fetchAnnotations = useCallback(() => {
    // console.log("🔍 [Watchtower] Fetching annotations from server...");
    fetch("/.watchtower/api/annotations")
      .then((res) => res.json())
      .then((data) => {
        // console.log("📥 [Watchtower] Received data:", data);
        setAnnotations(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WT_SET_INSPECT_MODE") {
        setIsInspectMode(event.data.enabled);
      }
      if (event.data.type === "WT_UPDATE_STATUS") {
        setStatus((prev) => ({ ...prev, ...event.data.payload }));
      }
      if (event.data.type === "WT_POLICY_SAVED") {
        fetchAnnotations();
      }
    };
    window.addEventListener("message", handleMessage);
    fetchAnnotations();
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchAnnotations]);

  // --- Strict Matching Logic (Host + Pathname) ---
  const currentPagePolicies = useMemo(() => {
    const current = normalizeUrl(window.location.href);

    const filtered = allAnnotations.filter((ann) => {
      const target = normalizeUrl(ann.url);
      return target.host === current.host && target.path === current.path;
    });

    // console.log("✅ [Watchtower] Total policies loaded:", filtered.length);
    return filtered;
  }, [allAnnotations]);

  const deleteAnnotation = async (id: string) => {
    if (!confirm("Delete this policy?")) {
      return;
    }
    const res = await fetch("/.watchtower/api/annotation", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      fetchAnnotations();
    }
  };
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isInspectMode || editingElement) {
        return;
      }
      const target = e.target as HTMLElement;
      if (target && !target.closest("#watchtower-injection-container") && target !== hoveredElement) {
        setHoveredElement(target);
      }
    },
    [isInspectMode, editingElement, hoveredElement],
  );

  const handleClick = useCallback(
    async (e: MouseEvent) => {
      if (!isInspectMode || editingElement) {
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest("#watchtower-injection-container")) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setHoveredElement(null);
      setIsInspectMode(false);

      setEditingElement({
        tagName: target.tagName,
        selector: generateRobustSelector(target),
        target: target,
      });
      setRole("");
      setDescription("");
    },
    [isInspectMode, editingElement],
  );

  useEffect(() => {
    if (isInspectMode) {
      document.addEventListener("mousemove", handleMouseMove, true);
      document.addEventListener("click", handleClick, true);
    } else {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isInspectMode, handleMouseMove, handleClick]);

  const saveAnnotation = async () => {
    if (!editingElement || !role) {
      return;
    }
    setIsSaving(true);
    let thumbnail = "";
    try {
      const canvas = await html2canvas(editingElement.target, { useCORS: true, scale: 1, logging: false });
      thumbnail = canvas.toDataURL("image/webp", 0.3);
    } catch (_err) {}

    const cleanUrl = window.location.href.split("/.watchtower")[0];

    const payload = {
      id: Math.random().toString(36).substring(2, 9),
      role,
      description,
      tagName: editingElement.tagName,
      selector: editingElement.selector,
      content: (editingElement.target.innerText || "").substring(0, 100),
      url: cleanUrl,
      domain: window.location.host,
      timestamp: Date.now(),
      thumbnail,
    };

    const res = await fetch("/.watchtower/api/annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setEditingElement(null);
      fetchAnnotations();
      window.parent.postMessage({ type: "WT_POLICY_SAVED" }, "*");
    }
    setIsSaving(false);
  };

  const getPositionStyles = (): React.CSSProperties => {
    const styles: React.CSSProperties = {
      position: "fixed",
      zIndex: 2147483647,
      pointerEvents: "auto",
      transition: "all 0.5s",
    };
    const offset = "24px";
    if (position.includes("bottom")) {
      styles.bottom = offset;
    } else {
      styles.top = offset;
    }
    if (position.includes("right")) {
      styles.right = offset;
    } else if (position.includes("left")) {
      styles.left = offset;
    } else {
      styles.left = "50%";
      styles.transform = "translateX(-50%)";
    }
    return styles;
  };

  return (
    <div style={{ display: "block" }}>
      {hoveredElement && (
        <div
          style={{
            position: "fixed",
            zIndex: 2147483646,
            border: "2px solid #3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.2)",
            pointerEvents: "none",
            top: hoveredElement.getBoundingClientRect().top,
            left: hoveredElement.getBoundingClientRect().left,
            width: hoveredElement.getBoundingClientRect().width,
            height: hoveredElement.getBoundingClientRect().height,
            transition: "all 0.05s ease-out",
            borderRadius: "4px",
          }}
        />
      )}

      {/* Policy Visual Badges */}
      {showPolicyBadges &&
        !editingElement &&
        currentPagePolicies.map((ann, i) => (
          <PolicyBadge
            key={ann.id}
            annotation={ann}
            index={i + 1}
            isActive={activeBadgeId === ann.id}
            onToggle={() => setActiveBadgeId(activeBadgeId === ann.id ? null : ann.id)}
          />
        ))}

      {!editingElement && (
        <div style={getPositionStyles()}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(12px)",
              padding: "4px",
              borderRadius: "100px",
              border: "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
              color: "white",
              fontFamily: "sans-serif",
            }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              onKeyDown={(e) => {
                // biome-ignore lint/style/useBlockStatements: Concise single-line toggle
                if (e.key === "Enter" || e.key === " ") setIsMenuOpen(!isMenuOpen);
              }}
              style={{
                cursor: "pointer",
                width: "32px",
                height: "32px",
                backgroundColor: isInspectMode ? "#3b82f6" : "rgba(255,255,255,0.1)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "900",
              }}
            >
              {isMenuOpen ? "⋮" : "W"}
            </div>
            {!isMenuOpen && (
              <div style={{ display: "flex", gap: "4px", padding: "0 8px" }}>
                <StatusDot active={status.proxy} color="#10b981" label="PRX" />
                <StatusDot active={status.mocking} color="#f59e0b" label="MCK" />
                <StatusDot active={showPolicyBadges} color="#ec4899" label="GUIDE" />
              </div>
            )}
            {isMenuOpen && (
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  paddingLeft: "8px",
                  borderLeft: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <ActionButton onClick={() => setIsListOpen(!isListOpen)} icon="📋" active={isListOpen} />
                <ActionButton
                  onClick={() => {
                    setIsInspectMode(!isInspectMode);
                    setIsMenuOpen(false);
                  }}
                  icon="🔍"
                  active={isInspectMode}
                />
                <ActionButton
                  onClick={() => setShowPolicyBadges(!showPolicyBadges)}
                  icon="👁️"
                  active={showPolicyBadges}
                />
                <ActionButton
                  onClick={() => {
                    const ps: Position[] = [
                      "bottom-right",
                      "bottom-center",
                      "bottom-left",
                      "top-left",
                      "top-center",
                      "top-right",
                    ];
                    setPosition((prev) => ps[(ps.indexOf(prev) + 1) % ps.length]);
                  }}
                  icon="📍"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Policy List Sidebar */}
      {isListOpen && (
        <div
          style={{
            position: "fixed",
            right: "24px",
            bottom: "80px",
            width: "320px",
            maxHeight: "70vh",
            backgroundColor: "#1e293b",
            borderRadius: "24px",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
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
              padding: "20px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800" }}>
              Page Policies ({currentPagePolicies.length})
            </h3>
            <button
              type="button"
              onClick={() => setIsListOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ×
            </button>
          </div>
          <div style={{ overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {currentPagePolicies.length === 0 && (
              <div
                style={{ padding: "40px 20px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}
              >
                No policies found for this page.
              </div>
            )}
            {currentPagePolicies.map((ann, i) => (
              <div
                key={ann.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveBadgeId(activeBadgeId === ann.id ? null : ann.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setActiveBadgeId(activeBadgeId === ann.id ? null : ann.id);
                  }
                }}
                style={{
                  padding: "12px",
                  borderRadius: "16px",
                  backgroundColor: activeBadgeId === ann.id ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${activeBadgeId === ann.id ? "#3b82f6" : "transparent"}`,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "4px" }}
                >
                  <span style={{ fontSize: "10px", fontWeight: "900", color: "#3b82f6", textTransform: "uppercase" }}>
                    Policy #{i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAnnotation(ann.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(239, 68, 68, 0.5)",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>{ann.role}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", lineHeight: "1.4" }}>
                  {ann.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingElement && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            backgroundColor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "sans-serif",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              width: "400px",
              padding: "24px",
              borderRadius: "24px",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800" }}>New Policy</h3>
              <button
                type="button"
                onClick={() => setEditingElement(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  fontSize: "20px",
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: "12px",
                borderRadius: "12px",
                fontSize: "10px",
                color: "rgba(255,255,255,0.5)",
                overflow: "hidden",
              }}
            >
              Selector: <code style={{ color: "#3b82f6", wordBreak: "break-all" }}>{editingElement.selector}</code>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                htmlFor="wt-role-input"
                style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                }}
              >
                Role / Title
              </label>
              <input
                id="wt-role-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Primary Login Button"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  padding: "10px",
                  color: "white",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                htmlFor="wt-desc-input"
                style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                }}
              >
                Requirements
              </label>
              <textarea
                id="wt-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe behavior..."
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  padding: "10px",
                  color: "white",
                  outline: "none",
                  minHeight: "80px",
                  resize: "none",
                }}
              />
            </div>
            <button
              type="button"
              onClick={saveAnnotation}
              disabled={!role || isSaving}
              style={{
                backgroundColor: isSaving ? "#475569" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "14px",
                fontWeight: "800",
                cursor: "pointer",
              }}
            >
              {isSaving ? "Saving..." : "Save Policy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PolicyBadge({
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
    // console.log(`[Watchtower] No rect for ${annotation.id} (Selector: ${annotation.selector})`);
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

function StatusDot({ active, color, label }: { active: boolean; color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", opacity: active ? 1 : 0.25 }}>
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: active ? `0 0 8px ${color}` : "none",
        }}
      />
      <span style={{ fontSize: "9px", fontWeight: "800", color: "white" }}>{label}</span>
    </div>
  );
}

function ActionButton({ onClick, icon, active }: { onClick: () => void; icon: string; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        background: active ? "rgba(59, 130, 246, 0.3)" : "rgba(255,255,255,0.1)",
        color: "white",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: "2px",
      }}
    >
      {icon}
    </button>
  );
}
