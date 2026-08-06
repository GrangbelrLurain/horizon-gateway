import html2canvas from "html2canvas";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}

interface MockRule {
  id: string;
  name: string;
  scenario_id?: string;
  host?: string;
  method: string;
  url_pattern: string;
  response_status: number;
  response_headers?: Record<string, string>;
  response_body?: string;
  delay_ms?: number;
  enabled: boolean;
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

  // Phase 2 State
  interface LocalRoute {
    id: number;
    domain_id: number;
    domain: string;
    target_host: string;
    target_port: number;
    enabled: boolean;
  }

  const [backendMockRules, setBackendMockRules] = useState<MockRule[]>([]);
  const [proxyRoutes, setProxyRoutes] = useState<LocalRoute[]>([]);
  const [showAllProxyRoutes, setShowAllProxyRoutes] = useState(false);
  const [editingMockRule, setEditingMockRule] = useState<Partial<MockRule> | null>(null);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [selectedLogDetail, setSelectedLogDetail] = useState<ApiTrafficLog | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"response" | "request" | "headers">("response");
  const [mockTab, setMockTab] = useState<"edit" | "preview">("edit");

  const [loggingDomains, setLoggingDomains] = useState<string[]>([]);
  const loggingDomainsRef = useRef<string[]>([]);
  useEffect(() => {
    loggingDomainsRef.current = loggingDomains;

    // Re-sync early interceptor logs whenever loggingDomains loads/changes
    if (loggingDomains.length === 0) {
      return;
    }
    const earlyLogs = (window as unknown as { __wt_api_traffic_logs?: ApiTrafficLog[] }).__wt_api_traffic_logs;
    if (!Array.isArray(earlyLogs) || earlyLogs.length === 0) {
      return;
    }
    setApiTrafficLogs((prev) => {
      const merged = [...prev];
      for (const item of earlyLogs) {
        try {
          const host = new URL(item.url, window.location.href).hostname.toLowerCase();
          const matched = loggingDomains.some((d) => {
            const dl = d.toLowerCase();
            return host === dl || host.endsWith(`.${dl}`);
          });
          if (
            matched &&
            !merged.some((m) => m.id === item.id || (m.url === item.url && m.timestamp === item.timestamp))
          ) {
            merged.push(item);
          }
        } catch (_e) {}
      }
      return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 1000);
    });
  }, [loggingDomains]);

  const matchedProxyRoutes = useMemo(() => {
    if (showAllProxyRoutes) {
      return proxyRoutes;
    }
    const currentHost = window.location.hostname.toLowerCase();
    return proxyRoutes.filter((r) => {
      const d = (r.domain || "").toLowerCase();
      return d === currentHost;
    });
  }, [proxyRoutes, showAllProxyRoutes]);

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

  const fetchProxyRoutes = useCallback(() => {
    fetch("/.horizon-gateway/api/proxy-routes")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProxyRoutes(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleProxyRoute = async (id: number, enabled: boolean) => {
    await fetch("/.horizon-gateway/api/proxy-route/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    fetchProxyRoutes();
    fetchStatus();
  };

  const fetchMockRules = useCallback(() => {
    fetch("/.horizon-gateway/api/mock-rules")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBackendMockRules(data);
        }
      })
      .catch(() => {});
  }, []);

  const fetchLoggingDomains = useCallback(() => {
    fetch("/.horizon-gateway/api/logging-domains")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLoggingDomains(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleMockRule = async (target: string | MockRule | MockedApiEntry, enabledState?: boolean) => {
    if (typeof target === "string") {
      await fetch("/.horizon-gateway/api/mock-rule/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target, enabled: enabledState }),
      });
    } else {
      const isBackendRule = "url_pattern" in target;
      if (isBackendRule) {
        const nextState = enabledState !== undefined ? enabledState : !(target as MockRule).enabled;
        await fetch("/.horizon-gateway/api/mock-rule/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: (target as MockRule).id, enabled: nextState }),
        });
      } else {
        const req = target as MockedApiEntry;
        const nextState = enabledState !== undefined ? enabledState : true;
        await fetch("/.horizon-gateway/api/mock-rule/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Mock for ${req.ruleName || req.url.split("/").pop() || "API"}`,
            method: req.method,
            url_pattern: req.url.split("?")[0],
            response_status: 200,
            response_body: '{\n  "mocked": true\n}',
            enabled: nextState,
          }),
        });
      }
    }
    fetchMockRules();
  };

  const handleToggleAllMockRules = async (enabled: boolean) => {
    await fetch("/.horizon-gateway/api/mock-rule/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true, enabled }),
    });
    fetchMockRules();
  };

  const handleSaveMockRule = async (rule: Partial<MockRule>) => {
    await fetch("/.horizon-gateway/api/mock-rule/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });
    setEditingMockRule(null);
    fetchMockRules();
  };

  const handleDeleteMockRule = async (id: string) => {
    await fetch("/.horizon-gateway/api/mock-rule/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchMockRules();
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
    fetchProxyRoutes();
    fetchMockRules();
    fetchLoggingDomains();
    const statusInterval = setInterval(() => {
      fetchStatus();
      fetchProxyRoutes();
      fetchLoggingDomains();
    }, 2500);
    return () => clearInterval(statusInterval);
  }, [fetchStatus, fetchProxyRoutes, fetchMockRules, fetchLoggingDomains]);

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

    // NOTE: Early interceptor logs are re-synced in a separate useEffect
    // when loggingDomains loads (see below), so we skip here to avoid timing issues.

    const handleTrafficLogEvent = (e: Event) => {
      const detail = (e as CustomEvent<ApiTrafficLog>).detail;
      if (detail) {
        // Use ref so it's always fresh even though this listener was registered once
        const domains = loggingDomainsRef.current;
        if (domains.length === 0) {
          return;
        }
        try {
          const host = new URL(detail.url, window.location.href).hostname.toLowerCase();
          const matched = domains.some((d) => {
            const dl = d.toLowerCase();
            return host === dl || host.endsWith(`.${dl}`);
          });
          if (!matched) {
            return;
          }
        } catch (_e) {
          return;
        }
        setApiTrafficLogs((prev) => {
          if (prev.some((m) => m.id === detail.id)) {
            return prev;
          }
          return [detail, ...prev].slice(0, 1000);
        });
      }
    };
    window.addEventListener("wt:traffic-log", handleTrafficLogEvent);

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

    const logTraffic = (
      urlStr: string,
      method: string,
      httpStatus: number,
      duration: number,
      isMocked: boolean,
      reqBody?: string,
      respBody?: string,
    ) => {
      try {
        if (isInternalWatchtowerUrl(urlStr) || isStaticAssetUrl(urlStr)) {
          return;
        }
        if (!loggingDomainsRef.current || loggingDomainsRef.current.length === 0) {
          return;
        }
        try {
          const host = new URL(urlStr, window.location.href).hostname.toLowerCase();
          const match = loggingDomainsRef.current.some((d) => {
            const dLower = d.toLowerCase();
            return host === dLower || host.endsWith(`.${dLower}`);
          });
          if (!match) {
            return;
          }
        } catch (_e) {
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
          requestBody: reqBody,
          responseBody: respBody,
        };
        setApiTrafficLogs((prev) => [logEntry, ...prev].slice(0, 1000));
      } catch (_e) {}
    };

    const patchedFetch = (async (...args: Parameters<typeof window.fetch>) => {
      const startTime = performance.now();
      const request = args[0];
      const urlStr = request instanceof Request ? request.url : String(request);
      const method = request instanceof Request ? request.method : args[1]?.method || "GET";
      const reqBodyStr = args[1]?.body ? String(args[1].body) : undefined;

      const response = await originalFetch(...args);
      const endTime = performance.now();
      try {
        const mockedBy = response.headers.get("x-mocked-by");
        markMockedResponse(urlStr, method, response.headers);

        if (!isStaticAssetUrl(urlStr) && !isInternalWatchtowerUrl(urlStr)) {
          const cloned = response.clone();
          cloned
            .text()
            .then((respText) => {
              const truncated =
                respText.length > 1000000 ? `${respText.substring(0, 1000000)}\n...(truncated)` : respText;
              logTraffic(urlStr, method, response.status, endTime - startTime, !!mockedBy, reqBodyStr, truncated);
            })
            .catch(() => {
              logTraffic(urlStr, method, response.status, endTime - startTime, !!mockedBy, reqBodyStr, undefined);
            });
        }
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
      const reqBodyStr = typeof body === "string" ? body : undefined;
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
          if (!urlStr || isStaticAssetUrl(urlStr) || isInternalWatchtowerUrl(urlStr)) {
            return;
          }
          const mockedBy = this.getResponseHeader("x-mocked-by");
          markMockedResponse(urlStr, method, this);
          let respBodyStr: string | undefined;
          try {
            if (typeof this.responseText === "string") {
              respBodyStr =
                this.responseText.length > 1000000
                  ? `${this.responseText.substring(0, 1000000)}\n...(truncated)`
                  : this.responseText;
            }
          } catch (_e) {}
          logTraffic(urlStr, method, this.status || 200, endTime - startTime, !!mockedBy, reqBodyStr, respBodyStr);
        },
        { once: true },
      );
      return originalSend.call(this, body);
    };

    return () => {
      window.removeEventListener("wt:traffic-log", handleTrafficLogEvent);
      window.removeEventListener("wt:mocked-request", handleMockedEvent);
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalOpen;
      XMLHttpRequest.prototype.send = originalSend;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: isStaticAssetUrl is a stable inline function; adding it would cause infinite fetch/XHR re-patching
  }, [isStaticAssetUrl]);

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

  function isStaticAssetUrl(urlStr: string): boolean {
    try {
      const path = new URL(urlStr, window.location.href).pathname.toLowerCase();
      return (
        path.endsWith(".png") ||
        path.endsWith(".jpg") ||
        path.endsWith(".jpeg") ||
        path.endsWith(".gif") ||
        path.endsWith(".svg") ||
        path.endsWith(".webp") ||
        path.endsWith(".ico") ||
        path.endsWith(".css") ||
        path.endsWith(".js") ||
        path.endsWith(".woff") ||
        path.endsWith(".woff2") ||
        path.endsWith(".ttf") ||
        path.endsWith(".otf") ||
        path.endsWith(".mp4") ||
        path.endsWith(".webm") ||
        path.endsWith(".mp3")
      );
    } catch (_e) {
      return false;
    }
  }

  const deleteAnnotation = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
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
                  title="클릭하여 가이드 관리 및 탐색기 열기"
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

      {/* 1. PRX Local Proxy Status & Routes Popover */}
      {isPrxPopoverOpen && (
        <div
          style={{
            position: "fixed",
            right: `${dragOffset.x}px`,
            bottom: `${dragOffset.y + 48}px`,
            width: "380px",
            maxHeight: "65vh",
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span style={{ fontWeight: "700", fontSize: "13px", color: "#10b981" }}>로컬 프록시 상태 & 라우트</span>
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
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              fontSize: "12px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: "8px 12px",
                borderRadius: "8px",
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
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.7)" }}>중계된 총 트래픽 수</span>
              <span style={{ fontWeight: "700", color: "#f3f4f6" }}>{status.proxyCount ?? 0}건</span>
            </div>

            <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#10b981" }}>
                  {showAllProxyRoutes
                    ? `전체 로컬 프록시 라우트 (${proxyRoutes.length})`
                    : `현재 도메인 라우트 (${matchedProxyRoutes.length})`}
                </span>
                {proxyRoutes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllProxyRoutes(!showAllProxyRoutes)}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#38bdf8",
                      fontSize: "9px",
                      fontWeight: "700",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    {showAllProxyRoutes ? "🎯 현재 도메인만" : `🌐 전체 보기 (${proxyRoutes.length})`}
                  </button>
                )}
              </div>

              {matchedProxyRoutes.length === 0 ? (
                <div style={{ padding: "12px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>
                  {showAllProxyRoutes
                    ? "등록된 로컬 프록시 라우트가 없습니다."
                    : `현재 도메인(${window.location.hostname})에 매칭되는 라우트가 없습니다.`}
                </div>
              ) : (
                matchedProxyRoutes.map((route) => (
                  <div
                    key={route.id}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontWeight: "700",
                          fontSize: "11px",
                          color: "#f3f4f6",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {route.domain}
                      </span>
                      <span style={{ fontSize: "10px", color: "#38bdf8", fontFamily: "monospace" }}>
                        ➔ {route.target_host}:{route.target_port}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleProxyRoute(route.id, !route.enabled)}
                      style={{
                        backgroundColor: route.enabled ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.1)",
                        border: `1px solid ${route.enabled ? "#10b981" : "rgba(255,255,255,0.2)"}`,
                        color: route.enabled ? "#10b981" : "rgba(255,255,255,0.5)",
                        fontSize: "10px",
                        fontWeight: "800",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginLeft: "8px",
                        flexShrink: 0,
                      }}
                    >
                      {route.enabled ? "ON" : "OFF"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. MCK Mocked API List & Editor Popover */}
      {isMockListOpen && (
        <div
          style={{
            position: "fixed",
            right: `${dragOffset.x}px`,
            bottom: `${dragOffset.y + 48}px`,
            width: "380px",
            maxHeight: "65vh",
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span style={{ fontWeight: "700", fontSize: "13px", color: "#f59e0b" }}>
                모킹 API 목록 ({backendMockRules.length > 0 ? backendMockRules.length : mockedRequests.length})
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={() =>
                  setEditingMockRule({
                    name: `New Mock Rule`,
                    method: "GET",
                    url_pattern: `${window.location.origin}/api/*`,
                    response_status: 200,
                    response_body: '{\n  "mocked": true\n}',
                    enabled: true,
                  })
                }
                style={{
                  backgroundColor: "rgba(245, 158, 11, 0.2)",
                  border: "1px solid rgba(245, 158, 11, 0.5)",
                  color: "#f59e0b",
                  borderRadius: "6px",
                  padding: "3px 8px",
                  fontSize: "10px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  추가
                </span>
              </button>
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

          <div
            style={{
              padding: "6px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.02)",
              fontSize: "11px",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.6)" }}>전체 모킹 상태</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => handleToggleAllMockRules(true)}
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid #10b981",
                  color: "#10b981",
                  fontSize: "9px",
                  fontWeight: "800",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                전체 ON
              </button>
              <button
                type="button"
                onClick={() => handleToggleAllMockRules(false)}
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid #ef4444",
                  color: "#ef4444",
                  fontSize: "9px",
                  fontWeight: "800",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                전체 OFF
              </button>
            </div>
          </div>

          {backendMockRules.length === 0 && mockedRequests.length === 0 ? (
            <div
              style={{ padding: "24px 16px", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "12px" }}
            >
              이 페이지에서 발생한 API 중 모킹된 요청이 없습니다.
            </div>
          ) : (
            <div style={{ overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {(backendMockRules.length > 0 ? backendMockRules : mockedRequests).map((ruleOrReq) => {
                const isBackendRule = "url_pattern" in ruleOrReq;
                const rule = ruleOrReq as MockRule;
                const req = ruleOrReq as MockedApiEntry;

                const ruleId = isBackendRule ? rule.id : req.id;
                const method = isBackendRule ? rule.method : req.method;
                const url = isBackendRule ? rule.url_pattern : req.url;
                const enabled = isBackendRule ? rule.enabled : false;

                return (
                  <div
                    key={ruleId}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      fontSize: "11px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            backgroundColor: method === "GET" ? "#3b82f6" : "#10b981",
                            color: "white",
                            fontSize: "9px",
                            fontWeight: "900",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            flexShrink: 0,
                          }}
                        >
                          {method}
                        </span>
                        {isBackendRule && (
                          <span
                            style={{
                              backgroundColor: enabled ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                              color: enabled ? "#10b981" : "#ef4444",
                              fontSize: "9px",
                              fontWeight: "800",
                              padding: "1px 5px",
                              borderRadius: "4px",
                            }}
                          >
                            {rule.response_status || 200}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isBackendRule) {
                              setEditingMockRule(rule);
                            } else {
                              setEditingMockRule({
                                name: `Mock for ${req.ruleName || req.url.split("/").pop() || "API"}`,
                                method: req.method,
                                url_pattern: req.url.split("?")[0],
                                response_status: 200,
                                response_body: '{\n  "mocked": true\n}',
                                enabled: true,
                              });
                            }
                          }}
                          style={{
                            backgroundColor: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "white",
                            fontSize: "9px",
                            fontWeight: "800",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                          title="상세 및 편집"
                        >
                          상세/편집
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleMockRule(ruleOrReq, !enabled)}
                          style={{
                            backgroundColor: enabled ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.1)",
                            border: `1px solid ${enabled ? "#10b981" : "rgba(255,255,255,0.2)"}`,
                            color: enabled ? "#10b981" : "rgba(255,255,255,0.6)",
                            fontSize: "9px",
                            fontWeight: "800",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          {enabled ? "ON" : "OFF"}
                        </button>
                        {isBackendRule && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMockRule(rule.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              padding: "2px",
                              display: "inline-flex",
                              alignItems: "center",
                              marginLeft: "2px",
                            }}
                            title="삭제"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
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
                      {url}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. LOG Real-time API Traffic Log Popover with Search & 1-Click Mock */}
      {isLogPopoverOpen && (
        <div
          style={{
            position: "fixed",
            right: `${dragOffset.x}px`,
            bottom: `${dragOffset.y + 48}px`,
            width: "420px",
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

          {/* Log Search Input */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <input
              type="text"
              placeholder="🔍 URL 또는 Method로 검색..."
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: "8px",
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
                fontSize: "11px",
                outline: "none",
              }}
            />
          </div>

          {apiTrafficLogs.length === 0 ? (
            <div
              style={{ padding: "24px 16px", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "12px" }}
            >
              현재 페이지에서 감지된 API 요청이 없습니다.
            </div>
          ) : (
            <div style={{ overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {apiTrafficLogs
                .filter(
                  (log) =>
                    !logSearchQuery ||
                    log.url.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                    log.method.toLowerCase().includes(logSearchQuery.toLowerCase()),
                )
                .map((log) => (
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
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{log.duration}ms</span>
                        <button
                          type="button"
                          onClick={() => {
                            const cleanUrl = log.url.split("?")[0];
                            setEditingMockRule({
                              name: `Mock for ${cleanUrl.split("/").pop() || "API"}`,
                              method: log.method,
                              url_pattern: cleanUrl,
                              response_status: log.status || 200,
                              response_body: '{\n  "mocked": true\n}',
                              enabled: true,
                            });
                            closeAllPopovers();
                          }}
                          style={{
                            backgroundColor: "rgba(245, 158, 11, 0.2)",
                            border: "1px solid #f59e0b",
                            color: "#f59e0b",
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
                          onClick={() => setSelectedLogDetail(log)}
                          style={{
                            backgroundColor: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "white",
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

      {/* Unified Mock API Detail & Editor Modal */}
      {editingMockRule && (
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
              width: "600px",
              maxHeight: "88vh",
              backgroundColor: "rgba(15, 23, 42, 0.98)",
              borderRadius: "16px",
              border: "1px solid rgba(245, 158, 11, 0.5)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.9)",
              padding: "20px",
              color: "white",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#f59e0b" }}>
                  {editingMockRule.id ? "모킹 API 상세 및 편집" : "신규 모킹 규칙 작성"}
                </h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !(editingMockRule.enabled ?? true);
                    setEditingMockRule({ ...editingMockRule, enabled: nextState });
                    if (editingMockRule.id) {
                      handleToggleMockRule(editingMockRule.id, nextState);
                    }
                  }}
                  style={{
                    backgroundColor:
                      (editingMockRule.enabled ?? true) ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    border: `1px solid ${(editingMockRule.enabled ?? true) ? "#10b981" : "#ef4444"}`,
                    color: (editingMockRule.enabled ?? true) ? "#10b981" : "#ef4444",
                    fontSize: "11px",
                    fontWeight: "800",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  {(editingMockRule.enabled ?? true) ? "● 활성화 (ON)" : "○ 비활성화 (OFF)"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMockRule(null)}
                  style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "16px" }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>규칙 이름</label>
              <input
                type="text"
                value={editingMockRule.name || ""}
                onChange={(e) => setEditingMockRule({ ...editingMockRule, name: e.target.value })}
                placeholder="규칙 이름 입력"
                style={{
                  padding: "7px 10px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "white",
                  fontSize: "12px",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100px" }}>
                <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>Method</label>
                <select
                  value={editingMockRule.method || "GET"}
                  onChange={(e) => setEditingMockRule({ ...editingMockRule, method: e.target.value })}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "white",
                    fontSize: "12px",
                  }}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                  <option value="*">* (ANY)</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "110px" }}>
                <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>상태 코드</label>
                <input
                  type="number"
                  value={editingMockRule.response_status || 200}
                  onChange={(e) =>
                    setEditingMockRule({ ...editingMockRule, response_status: Number.parseInt(e.target.value, 10) })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "white",
                    fontSize: "12px",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>지연 시간 (ms)</label>
                <input
                  type="number"
                  value={editingMockRule.delay_ms || 0}
                  onChange={(e) =>
                    setEditingMockRule({ ...editingMockRule, delay_ms: Number.parseInt(e.target.value, 10) || 0 })
                  }
                  placeholder="0"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "white",
                    fontSize: "12px",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>URL Pattern (Wildcard * 가능)</label>
              <input
                type="text"
                value={editingMockRule.url_pattern || ""}
                onChange={(e) => setEditingMockRule({ ...editingMockRule, url_pattern: e.target.value })}
                placeholder="예: */Common/GetGnb*"
                style={{
                  padding: "7px 10px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "white",
                  fontSize: "12px",
                  fontFamily: "monospace",
                }}
              />
            </div>

            {/* Response Body Tabs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minHeight: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>
                  Response Body (모킹 응답 데이터)
                </label>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setMockTab("edit")}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: mockTab === "edit" ? "rgba(245, 158, 11, 0.3)" : "rgba(255,255,255,0.06)",
                      border: mockTab === "edit" ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.1)",
                      color: mockTab === "edit" ? "#f59e0b" : "rgba(255,255,255,0.6)",
                      fontSize: "10px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    ✏️ 직접 편집
                  </button>
                  <button
                    type="button"
                    onClick={() => setMockTab("preview")}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: mockTab === "preview" ? "rgba(245, 158, 11, 0.3)" : "rgba(255,255,255,0.06)",
                      border: mockTab === "preview" ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.1)",
                      color: mockTab === "preview" ? "#f59e0b" : "rgba(255,255,255,0.6)",
                      fontSize: "10px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    🌳 Foldable 텍스트 뷰
                  </button>
                </div>
              </div>

              {mockTab === "edit" ? (
                <textarea
                  value={editingMockRule.response_body || ""}
                  onChange={(e) => setEditingMockRule({ ...editingMockRule, response_body: e.target.value })}
                  rows={8}
                  placeholder="응답 데이터 작성 (JSON 또는 일반 텍스트)..."
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#38bdf8",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    resize: "vertical",
                    lineHeight: "1.5",
                  }}
                />
              ) : (
                <JsonViewer src={editingMockRule.response_body || "{}"} />
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "space-between",
                marginTop: "8px",
                alignItems: "center",
              }}
            >
              {editingMockRule.id ? (
                <button
                  type="button"
                  onClick={() => {
                    if (editingMockRule.id) {
                      handleDeleteMockRule(editingMockRule.id);
                      setEditingMockRule(null);
                    }
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                    border: "1px solid #ef4444",
                    color: "#ef4444",
                    fontSize: "12px",
                    fontWeight: "800",
                    cursor: "pointer",
                  }}
                >
                  🗑️ 모킹 규칙 삭제
                </button>
              ) : (
                <div />
              )}

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setEditingMockRule(null)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(255,255,255,0.1)",
                    border: "none",
                    color: "white",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveMockRule(editingMockRule);
                    setEditingMockRule(null);
                  }}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "6px",
                    backgroundColor: "#f59e0b",
                    border: "none",
                    color: "black",
                    fontSize: "12px",
                    fontWeight: "800",
                    cursor: "pointer",
                  }}
                >
                  💾 모킹 규칙 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Detail Drawer Modal */}
      {selectedLogDetail && (
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
                onClick={() => setSelectedLogDetail(null)}
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
                onClick={() => setActiveDetailTab("response")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: activeDetailTab === "response" ? "rgba(59, 130, 246, 0.3)" : "transparent",
                  border: activeDetailTab === "response" ? "1px solid #3b82f6" : "none",
                  color: activeDetailTab === "response" ? "#60a5fa" : "rgba(255,255,255,0.6)",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                ⚡ Response Body
              </button>
              <button
                type="button"
                onClick={() => setActiveDetailTab("request")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: activeDetailTab === "request" ? "rgba(59, 130, 246, 0.3)" : "transparent",
                  border: activeDetailTab === "request" ? "1px solid #3b82f6" : "none",
                  color: activeDetailTab === "request" ? "#60a5fa" : "rgba(255,255,255,0.6)",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                📤 Request Body {selectedLogDetail.requestBody ? "•" : ""}
              </button>
              <button
                type="button"
                onClick={() => setActiveDetailTab("headers")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: activeDetailTab === "headers" ? "rgba(59, 130, 246, 0.3)" : "transparent",
                  border: activeDetailTab === "headers" ? "1px solid #3b82f6" : "none",
                  color: activeDetailTab === "headers" ? "#60a5fa" : "rgba(255,255,255,0.6)",
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
              {activeDetailTab === "response" &&
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

              {activeDetailTab === "request" &&
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

              {activeDetailTab === "headers" && (
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
                  setEditingMockRule({
                    name: `Mock for ${cleanUrl.split("/").pop() || "API"}`,
                    method: selectedLogDetail.method,
                    url_pattern: cleanUrl,
                    response_status: selectedLogDetail.status || 200,
                    response_body: selectedLogDetail.responseBody || '{\n  "mocked": true\n}',
                    enabled: true,
                  });
                  setSelectedLogDetail(null);
                  closeAllPopovers();
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
                가이드 관리 ({currentPagePolicies.length})
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
              현재 페이지에 등록된 가이드가 없습니다.
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

function parsePartialJson(src: string): { data: unknown | null; truncated: boolean } {
  let clean = src.trim();
  let truncated = false;

  const truncIndex = clean.lastIndexOf("...(truncated)");
  if (truncIndex !== -1) {
    clean = clean.substring(0, truncIndex).trim();
    truncated = true;
  }

  try {
    return { data: JSON.parse(clean), truncated };
  } catch (_e) {}

  let s = clean;
  for (let attempt = 0; attempt < 25; attempt++) {
    const lastComma = s.lastIndexOf(",");
    const lastBrace = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    const cutPos = Math.max(lastComma, lastBrace);
    if (cutPos <= 0) {
      break;
    }

    s = s.substring(0, cutPos).trim();
    if (s.endsWith(",")) {
      s = s.slice(0, -1).trim();
    }

    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"' && s[i - 1] !== "\\") {
        inString = !inString;
      }
      if (!inString) {
        if (ch === "{") {
          openBraces++;
        } else if (ch === "}") {
          openBraces--;
        } else if (ch === "[") {
          openBrackets++;
        } else if (ch === "]") {
          openBrackets--;
        }
      }
    }

    let closing = "";
    for (let b = 0; b < Math.max(0, openBrackets); b++) {
      closing += "]";
    }
    for (let b = 0; b < Math.max(0, openBraces); b++) {
      closing += "}";
    }

    try {
      return { data: JSON.parse(s + closing), truncated: true };
    } catch (_e2) {}
  }

  return { data: null, truncated };
}

function JsonViewer({ src }: { src: string }) {
  const [parsed, setParsed] = useState<unknown | null>(null);
  const [isError, setIsError] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const res = parsePartialJson(src);
    if (res.data !== null) {
      setParsed(res.data);
      setIsTruncated(res.truncated);
      setIsError(false);
    } else {
      setIsError(true);
      setIsTruncated(res.truncated);
    }
  }, [src]);

  const formattedRawJson = useMemo(() => {
    if (parsed !== null) {
      try {
        return JSON.stringify(parsed, null, 2);
      } catch (_e) {
        return src;
      }
    }
    return src;
  }, [parsed, src]);

  if (isError || parsed === null) {
    return (
      <pre
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#38bdf8",
          fontSize: "11px",
          fontFamily: "monospace",
          overflowY: "auto",
          maxHeight: "340px",
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          userSelect: "text",
        }}
      >
        {src}
      </pre>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", fontWeight: "600" }}>
          💡 ▼/▶ 클릭하여 접기 · 마우스 드래그로 원하는 텍스트 부분 복사 가능
          {isTruncated && <span style={{ color: "#f59e0b", marginLeft: "6px" }}>(⚠️ 데이터 일부 생략됨)</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(formattedRawJson);
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 1500);
          }}
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            border: "none",
            color: copiedAll ? "#10b981" : "#38bdf8",
            fontSize: "10px",
            padding: "2px 8px",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "700",
          }}
        >
          {copiedAll ? "✓ 전체 복사됨!" : "📋 전체 JSON 복사"}
        </button>
      </div>

      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.1)",
          overflowY: "auto",
          maxHeight: "340px",
          fontFamily: "monospace",
          fontSize: "11px",
          lineHeight: "1.6",
          color: "#f3f4f6",
          userSelect: "text",
        }}
      >
        <TextJsonNode value={parsed} isLast={true} depth={0} />
      </div>
    </div>
  );
}

function TextJsonNode({
  keyName,
  value,
  isLast = true,
  depth = 0,
}: {
  keyName?: string;
  value: unknown;
  isLast?: boolean;
  depth?: number;
}) {
  const [folded, setFolded] = useState(depth >= 2);
  const [copiedNode, setCopiedNode] = useState(false);
  const comma = isLast ? "" : ",";
  const indentStr = "  ".repeat(depth);

  const renderKey =
    keyName !== undefined ? <span style={{ color: "#38bdf8", fontWeight: "600" }}>"{keyName}": </span> : null;

  const handleCopyThisNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const textToCopy = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      navigator.clipboard.writeText(textToCopy);
      setCopiedNode(true);
      setTimeout(() => setCopiedNode(false), 1200);
    } catch (_e) {}
  };

  if (value === null) {
    return (
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        {renderKey}
        <span style={{ color: "#ef4444", fontWeight: "700" }}>null</span>
        {comma}
      </div>
    );
  }
  if (typeof value === "boolean") {
    return (
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        {renderKey}
        <span style={{ color: "#f59e0b", fontWeight: "700" }}>{value ? "true" : "false"}</span>
        {comma}
      </div>
    );
  }
  if (typeof value === "number") {
    return (
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        {renderKey}
        <span style={{ color: "#f59e0b" }}>{value}</span>
        {comma}
      </div>
    );
  }
  if (typeof value === "string") {
    return (
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        {renderKey}
        <span style={{ color: "#a3e635" }}>"{value}"</span>
        {comma}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as object);
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  if (entries.length === 0) {
    return (
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        {renderKey}
        <span style={{ color: "#94a3b8" }}>
          {openBracket}
          {closeBracket}
        </span>
        {comma}
      </div>
    );
  }

  return (
    <div style={{ display: "block", userSelect: "text" }}>
      {/* Object Header Line */}
      <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
        <button
          type="button"
          onClick={() => setFolded(!folded)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            userSelect: "none",
            color: "#cbd5e1",
            fontWeight: "700",
            fontSize: "10px",
            marginRight: "4px",
            width: "12px",
            display: "inline-block",
            textAlign: "center",
          }}
        >
          {folded ? "▶" : "▼"}
        </button>
        {renderKey}
        <span style={{ color: "#cbd5e1", fontWeight: "700" }}>{openBracket}</span>

        {/* Node Level Copy Button */}
        <button
          type="button"
          onClick={handleCopyThisNode}
          style={{
            background: "none",
            border: "none",
            padding: "0 4px",
            fontSize: "9px",
            color: copiedNode ? "#10b981" : "rgba(255,255,255,0.4)",
            cursor: "pointer",
            fontWeight: "600",
            marginLeft: "4px",
            userSelect: "none",
          }}
          title="이 노드 데이터 복사"
        >
          {copiedNode ? "✓ 복사됨" : "📋"}
        </button>

        {folded && (
          <span
            onClick={() => setFolded(false)}
            style={{
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "600",
              marginLeft: "4px",
              userSelect: "text",
            }}
          >
            ... {closeBracket}
            {comma}
          </span>
        )}
      </div>

      {/* Children lines with distinct vertical guide line */}
      {!folded && (
        <div
          style={{
            paddingLeft: "16px",
            borderLeft: "1px dashed rgba(255, 255, 255, 0.15)",
            marginLeft: "5px",
            marginTop: "1px",
            marginBottom: "1px",
            display: "block",
            userSelect: "text",
          }}
        >
          {entries.map(([k, v], idx) => (
            <TextJsonNode
              key={k}
              keyName={isArray ? undefined : k}
              value={v}
              isLast={idx === entries.length - 1}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {!folded && (
        <div style={{ display: "block", userSelect: "text", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
          <span style={{ whiteSpace: "pre", userSelect: "text" }}>{indentStr}</span>
          <span style={{ color: "#cbd5e1", fontWeight: "700" }}>{closeBracket}</span>
          {comma}
        </div>
      )}
    </div>
  );
}

function HeadersViewer({ headers }: { headers?: Record<string, string> }) {
  if (!headers || Object.keys(headers).length === 0) {
    return (
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>헤더 정보가 없습니다.</div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.1)",
        overflowY: "auto",
        maxHeight: "220px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontFamily: "monospace",
        fontSize: "11px",
      }}
    >
      {Object.entries(headers).map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: "8px", wordBreak: "break-all" }}>
          <span style={{ color: "#38bdf8", fontWeight: "700", minWidth: "120px", flexShrink: 0 }}>{k}:</span>
          <span style={{ color: "rgba(255,255,255,0.85)" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
