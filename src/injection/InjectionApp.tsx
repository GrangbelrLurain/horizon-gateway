import html2canvas from "html2canvas";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Annotation } from "@/entities/inspector";

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
    const url = new URL(urlStr.split("/.horizon-gateway")[0]);
    return {
      host: url.host,
      path: url.pathname.replace(/\/$/, "") || "/",
    };
  } catch (_e) {
    return { host: "", path: "" };
  }
}

function isInternalWatchtowerUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr, window.location.href);
    return url.pathname.startsWith("/.horizon-gateway/");
  } catch (_e) {
    return false;
  }
}

interface MockedApiEntry {
  id: string;
  url: string;
  method: string;
  ruleName?: string;
  ruleId?: string;
  timestamp: number;
}

interface ApiTrafficLog {
  id: string;
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
  isMocked: boolean;
}

export function InjectionApp() {
  const [isInspectMode, setIsInspectMode] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [showPolicyBadges, setShowPolicyBadges] = useState(true);

  // Drag State
  const [dragOffset, setDragOffset] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const hasMoved = React.useRef(false);

  const [editingElement, setEditingElement] = useState<EditingElement | null>(null);
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [allAnnotations, setAnnotations] = useState<Annotation[]>([]);
  const [status, setStatus] = useState<{
    proxy: boolean;
    proxyCount?: number;
    mocking: boolean;
    mockCount?: number;
    logging: boolean;
    inspector?: boolean;
  }>({ proxy: false, proxyCount: 0, mocking: false, mockCount: 0, logging: true, inspector: false });
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);
  const [mockedRequests, setMockedRequests] = useState<MockedApiEntry[]>([]);
  const [apiTrafficLogs, setApiTrafficLogs] = useState<ApiTrafficLog[]>([]);

  // Popovers State
  const [isPrxPopoverOpen, setIsPrxPopoverOpen] = useState(false);
  const [isMockListOpen, setIsMockListOpen] = useState(false);
  const [isLogPopoverOpen, setIsLogPopoverOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  const closeAllPopovers = () => {
    setIsPrxPopoverOpen(false);
    setIsMockListOpen(false);
    setIsLogPopoverOpen(false);
    setIsGuideModalOpen(false);
  };

  const [isDocked, setIsDocked] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 400);
  };

  const fetchAnnotations = useCallback(() => {
    fetch("/.horizon-gateway/api/annotations")
      .then((res) => res.json())
      .then((data) => {
        setAnnotations(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  const fetchStatus = useCallback(() => {
    fetch("/.horizon-gateway/api/status")
      .then((res) => res.json())
      .then((data) => {
        setStatus((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 2500);
    return () => clearInterval(statusInterval);
  }, [fetchStatus]);

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

  useEffect(() => {
    // Sync from early interceptor script array
    const existing = (window as unknown as { __wt_mocked_requests?: MockedApiEntry[] }).__wt_mocked_requests;
    if (Array.isArray(existing) && existing.length > 0) {
      setMockedRequests((prev) => {
        const merged = [...prev];
        for (const item of existing) {
          if (!merged.some((m) => m.url === item.url && m.method === item.method)) {
            merged.push(item);
          }
        }
        return merged;
      });
    }

    // Listen to custom events dispatched by early interceptor
    const handleMockedEvent = (e: Event) => {
      const detail = (e as CustomEvent<MockedApiEntry>).detail;
      if (detail) {
        setMockedRequests((prev) => {
          if (prev.some((m) => m.id === detail.id || (m.url === detail.url && m.method === detail.method))) {
            return prev;
          }
          return [detail, ...prev];
        });
      }
    };
    window.addEventListener("wt:mocked-request", handleMockedEvent);

    const originalFetch = window.fetch.bind(window);
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    const markMockedResponse = (urlStr: string, method: string, headers: Headers | XMLHttpRequest) => {
      try {
        if (isInternalWatchtowerUrl(urlStr)) {
          return;
        }

        const mockedBy =
          headers instanceof Headers ? headers.get("x-mocked-by") : headers.getResponseHeader("x-mocked-by");

        if (!mockedBy) {
          return;
        }

        const ruleName =
          headers instanceof Headers ? headers.get("x-mock-rule-name") : headers.getResponseHeader("x-mock-rule-name");
        const ruleId =
          headers instanceof Headers ? headers.get("x-mock-rule-id") : headers.getResponseHeader("x-mock-rule-id");

        const entry: MockedApiEntry = {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).substring(2) + Date.now().toString(36),
          url: urlStr,
          method: (method || "GET").toUpperCase(),
          ruleName: ruleName || undefined,
          ruleId: ruleId || undefined,
          timestamp: Date.now(),
        };

        setMockedRequests((prev) => {
          if (prev.some((m) => m.url === entry.url && m.method === entry.method)) {
            return prev;
          }
          return [entry, ...prev];
        });
      } catch (_err) {}
    };

    const logTraffic = (urlStr: string, method: string, httpStatus: number, duration: number, isMocked: boolean) => {
      try {
        if (isInternalWatchtowerUrl(urlStr)) {
          return;
        }
        const logEntry: ApiTrafficLog = {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).substring(2) + Date.now().toString(36),
          url: urlStr,
          method: (method || "GET").toUpperCase(),
          status: httpStatus || 200,
          duration: Math.round(duration),
          timestamp: Date.now(),
          isMocked,
        };
        setApiTrafficLogs((prev) => [logEntry, ...prev].slice(0, 50));
      } catch (_e) {}
    };

    const patchedFetch = (async (...args: Parameters<typeof window.fetch>) => {
      const startTime = performance.now();
      const response = await originalFetch(...args);
      const endTime = performance.now();
      try {
        const request = args[0];
        const urlStr = request instanceof Request ? request.url : String(request);
        const method = request instanceof Request ? request.method : args[1]?.method || "GET";
        const mockedBy = response.headers.get("x-mocked-by");
        markMockedResponse(urlStr, method, response.headers);
        logTraffic(urlStr, method, response.status, endTime - startTime, !!mockedBy);
      } catch (_err) {}
      return response;
    }) as typeof window.fetch;
    Object.assign(patchedFetch, originalFetch);
    window.fetch = patchedFetch;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
      (this as XMLHttpRequest & { __wtRequestUrl?: string; __wtRequestMethod?: string }).__wtRequestUrl = String(url);
      (this as XMLHttpRequest & { __wtRequestUrl?: string; __wtRequestMethod?: string }).__wtRequestMethod =
        String(method);
      return originalOpen.apply(this, [method, url, ...rest] as Parameters<typeof originalOpen>);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const startTime = performance.now();
      this.addEventListener(
        "loadend",
        () => {
          const endTime = performance.now();
          const urlStr =
            (this as XMLHttpRequest & { __wtRequestUrl?: string; __wtRequestMethod?: string }).__wtRequestUrl ??
            this.responseURL;
          const method =
            (this as XMLHttpRequest & { __wtRequestUrl?: string; __wtRequestMethod?: string }).__wtRequestMethod ??
            "GET";
          if (!urlStr) {
            return;
          }
          const mockedBy = this.getResponseHeader("x-mocked-by");
          markMockedResponse(urlStr, method, this);
          logTraffic(urlStr, method, this.status || 200, endTime - startTime, !!mockedBy);
        },
        { once: true },
      );
      return originalSend.call(this, body);
    };

    return () => {
      window.removeEventListener("wt:mocked-request", handleMockedEvent);
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalOpen;
      XMLHttpRequest.prototype.send = originalSend;
    };
  }, []);

  // --- Strict Matching Logic (Host + Pathname) ---
  const currentPagePolicies = useMemo(() => {
    const current = normalizeUrl(window.location.href);
    return allAnnotations.filter((ann) => {
      if (!ann.url) {
        return false;
      }
      const target = normalizeUrl(ann.url);
      return target.host === current.host && target.path === current.path;
    });
  }, [allAnnotations]);

  const deleteAnnotation = async (id: string) => {
    if (!confirm("Delete this policy?")) {
      return;
    }
    const res = await fetch("/.horizon-gateway/api/annotation", {
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
      if (target && !target.closest("#horizon-gateway-injection-container") && target !== hoveredElement) {
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
      if (target.closest("#horizon-gateway-injection-container")) {
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

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setIsDocked(false);
    hasMoved.current = false;
    setDragStart({
      x: e.clientX + dragOffset.x,
      y: window.innerHeight - e.clientY - dragOffset.y,
    });
    e.stopPropagation();
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging) {
        return;
      }
      const newX = dragStart.x - e.clientX;
      const newY = window.innerHeight - e.clientY - dragStart.y;

      if (Math.abs(newX - dragOffset.x) > 3 || Math.abs(newY - dragOffset.y) > 3) {
        hasMoved.current = true;
      }

      setDragOffset({
        x: Math.max(0, Math.min(window.innerWidth - 50, newX)),
        y: Math.max(10, Math.min(window.innerHeight - 50, newY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (dragOffset.x <= 20) {
        setIsDocked(true);
        setDragOffset((prev) => ({ ...prev, x: 0 }));
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, dragOffset]);

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

    const cleanUrl = window.location.href.split("/.horizon-gateway")[0];

    const payload = {
      id: crypto.randomUUID(),
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

    const res = await fetch("/.horizon-gateway/api/annotation", {
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

      {/* Edge Docked Semicircle Handle ( | */}
      {isDocked && !isHovered && !editingElement && (
        <div
          style={{
            position: "fixed",
            bottom: `${dragOffset.y}px`,
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
          onMouseEnter={handleMouseEnter}
          onMouseDown={handleDragStart}
          onClick={(e) => {
            if (!hasMoved.current) {
              e.stopPropagation();
              setIsDocked(false);
              setDragOffset({ x: 24, y: dragOffset.y });
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
              backgroundColor: mockedRequests.length > 0 ? "#f59e0b" : status.proxy ? "#10b981" : "#6b7280",
              boxShadow: mockedRequests.length > 0 ? "0 0 8px #f59e0b" : "none",
            }}
          />
        </div>
      )}

      {/* Full Status Bar */}
      {!editingElement && (!isDocked || isHovered) && (
        <div
          style={{
            position: "fixed",
            bottom: `${dragOffset.y}px`,
            right: isDocked ? "0px" : `${dragOffset.x}px`,
            zIndex: 2147483647,
            pointerEvents: "auto",
            transition: isDragging ? "none" : "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(12px)",
              padding: "4px 8px",
              borderRadius: isDocked ? "100px 0 0 100px" : "100px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRight: isDocked ? "none" : "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
              color: "white",
              fontFamily: "sans-serif",
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onMouseDown={handleDragStart}
          >
            {isCompact ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCompact(false);
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
                    const next = !isPrxPopoverOpen;
                    closeAllPopovers();
                    setIsPrxPopoverOpen(next);
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="클릭하여 로컬 프록시 상태 보기"
                >
                  <StatusDot
                    active={status.proxy}
                    color="#10b981"
                    label={status.proxy && (status.proxyCount ?? 0) > 0 ? `PRX (${status.proxyCount})` : "PRX"}
                  />
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !isMockListOpen;
                    closeAllPopovers();
                    setIsMockListOpen(next);
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="클릭하여 모킹된 API 목록 보기"
                >
                  <StatusDot
                    active={mockedRequests.length > 0}
                    color="#f59e0b"
                    label={mockedRequests.length > 0 ? `MCK (${mockedRequests.length})` : "MCK"}
                  />
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !isLogPopoverOpen;
                    closeAllPopovers();
                    setIsLogPopoverOpen(next);
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="클릭하여 실시간 API 통신 로그 보기"
                >
                  <StatusDot
                    active={apiTrafficLogs.length > 0}
                    color="#3b82f6"
                    label={apiTrafficLogs.length > 0 ? `LOG (${apiTrafficLogs.length})` : "LOG"}
                  />
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !isGuideModalOpen;
                    closeAllPopovers();
                    setIsGuideModalOpen(next);
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="클릭하여 UX 정책 관리 및 탐색기 열기"
                >
                  <StatusDot
                    active={currentPagePolicies.length > 0 || isInspectMode}
                    color="#ec4899"
                    label={currentPagePolicies.length > 0 ? `GUIDE (${currentPagePolicies.length})` : "GUIDE"}
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
                      setIsDocked(true);
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
                      setIsCompact(true);
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

      {/* 1. PRX Local Proxy Status Popover */}
      {isPrxPopoverOpen && (
        <div
          style={{
            position: "fixed",
            right: `${dragOffset.x}px`,
            bottom: `${dragOffset.y + 48}px`,
            width: "360px",
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(16px)",
            borderRadius: "16px",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            boxShadow: "0 20px 50px -10px rgba(0,0,0,0.7), 0 0 20px rgba(16, 185, 129, 0.15)",
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
              backgroundColor: "rgba(16, 185, 129, 0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#10b981", fontSize: "14px" }}>🟢</span>
              <span style={{ fontWeight: "700", fontSize: "13px", color: "#10b981" }}>로컬 프록시 상태</span>
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
                closeAllPopovers();
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
          <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.7)" }}>프록시 연결 상태</span>
              <span style={{ fontWeight: "700", color: status.proxy ? "#10b981" : "#ef4444" }}>
                {status.proxy ? "● ACTIVE (정상)" : "○ INACTIVE (비활성)"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.7)" }}>중계된 총 트래픽 수</span>
              <span style={{ fontWeight: "700", color: "#f3f4f6" }}>{status.proxyCount ?? 0}건</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.7)" }}>인스펙터 스크립트 주입</span>
              <span style={{ fontWeight: "700", color: "#10b981" }}>활성화됨</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. MCK Mocked API List Popover */}
      {isMockListOpen && (
        <div
          style={{
            position: "fixed",
            right: `${dragOffset.x}px`,
            bottom: `${dragOffset.y + 48}px`,
            width: "360px",
            maxHeight: "60vh",
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(16px)",
            borderRadius: "16px",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            boxShadow: "0 20px 50px -10px rgba(0,0,0,0.7), 0 0 20px rgba(245, 158, 11, 0.15)",
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
              backgroundColor: "rgba(245, 158, 11, 0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#f59e0b", fontSize: "14px" }}>⚡</span>
              <span style={{ fontWeight: "700", fontSize: "13px", color: "#f59e0b" }}>
                모킹된 API 목록 ({mockedRequests.length})
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
                closeAllPopovers();
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
          {mockedRequests.length === 0 ? (
            <div
              style={{ padding: "24px 16px", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "12px" }}
            >
              이 페이지에서 발생한 API 중 모킹된 요청이 없습니다.
            </div>
          ) : (
            <div style={{ overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {mockedRequests.map((req) => (
                <div
                  key={req.id}
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
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        backgroundColor: req.method === "GET" ? "#3b82f6" : "#10b981",
                        color: "white",
                        fontSize: "9px",
                        fontWeight: "900",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        flexShrink: 0,
                      }}
                    >
                      {req.method}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "11px",
                        wordBreak: "break-all",
                        color: "#f3f4f6",
                        fontWeight: "600",
                      }}
                    >
                      {req.url}
                    </span>
                  </div>
                  {req.ruleName && (
                    <div
                      style={{ fontSize: "10px", color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <span style={{ opacity: 0.8 }}>Rule:</span>
                      <span style={{ fontWeight: "700" }}>{req.ruleName}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. LOG Real-time API Traffic Log Popover */}
      {isLogPopoverOpen && (
        <div
          style={{
            position: "fixed",
            right: `${dragOffset.x}px`,
            bottom: `${dragOffset.y + 48}px`,
            width: "400px",
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
                실시간 API 통신 로그 ({apiTrafficLogs.length})
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {apiTrafficLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setApiTrafficLogs([])}
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
                  closeAllPopovers();
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
          {apiTrafficLogs.length === 0 ? (
            <div
              style={{ padding: "24px 16px", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "12px" }}
            >
              현재 페이지에서 감지된 API 요청이 없습니다.
            </div>
          ) : (
            <div style={{ overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {apiTrafficLogs.map((log) => (
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
                            log.status >= 200 && log.status < 300
                              ? "rgba(16, 185, 129, 0.2)"
                              : "rgba(239, 68, 68, 0.2)",
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
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{log.duration}ms</span>
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
      )}

      {/* 4. GUIDE UX Policy Management Modal */}
      {isGuideModalOpen && (
        <div
          style={{
            position: "fixed",
            right: `${dragOffset.x}px`,
            bottom: `${dragOffset.y + 48}px`,
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
                UX 정책 관리 ({currentPagePolicies.length})
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
                closeAllPopovers();
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
                setIsInspectMode(!isInspectMode);
                closeAllPopovers();
              }}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: "8px",
                backgroundColor: isInspectMode ? "rgba(59, 130, 246, 0.3)" : "rgba(255,255,255,0.08)",
                border: isInspectMode ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
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
              🔍 {isInspectMode ? "선택 중..." : "요소 선택 (인스펙터)"}
            </button>
            <button
              type="button"
              onClick={() => setShowPolicyBadges(!showPolicyBadges)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                backgroundColor: showPolicyBadges ? "rgba(236, 72, 153, 0.2)" : "rgba(255,255,255,0.08)",
                border: showPolicyBadges ? "1px solid #ec4899" : "1px solid rgba(255,255,255,0.12)",
                color: "white",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              👁️ 배지 {showPolicyBadges ? "ON" : "OFF"}
            </button>
          </div>

          {currentPagePolicies.length === 0 ? (
            <div
              style={{ padding: "24px 16px", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "12px" }}
            >
              현재 페이지에 등록된 UX 정책이 없습니다.
              <br />
              <span style={{ fontSize: "11px", opacity: 0.8, marginTop: "6px", display: "block" }}>
                '🔍 요소 선택' 버튼을 눌러 화면 요소를 지정하세요.
              </span>
            </div>
          ) : (
            <div style={{ overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {currentPagePolicies.map((ann, idx) => (
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
                      onClick={() => deleteAnnotation(ann.id)}
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        opacity: active ? 1 : 0.3,
        transition: "opacity 0.2s ease-in-out",
        whiteSpace: "nowrap",
      }}
      title={label}
    >
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: active ? `0 0 8px ${color}` : "none",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: "9px", fontWeight: "800", color: "white", letterSpacing: "0.2px" }}>{label}</span>
    </div>
  );
}
