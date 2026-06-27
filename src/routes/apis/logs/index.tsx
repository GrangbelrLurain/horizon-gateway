import { createFileRoute } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { listen } from "@tauri-apps/api/event";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  FlaskConical,
  GlobeIcon,
  History,
  Search,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiLoggingCountAtom, domainCountAtom, languageAtom, proxyRunningAtom, usePromiseModal } from "@/entities/app";
import { ProxyServerWarning } from "@/entities/proxy";
import { ApiLogExchangeDetail, formatHttpBody, savedJsonSchemasAtom, validateJsonSchema } from "@/entities/sandbox";
import type { ApiLogEntry } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { createMockModalAtom } from "@/shared/store/modals";
import { Badge } from "@/shared/ui/badge/badge";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { EmptyState } from "@/shared/ui/empty-state/EmptyState";
import { LoadingScreen } from "@/shared/ui/loader/LoadingScreen";
import { Modal } from "@/shared/ui/modal/Modal";
import { en } from "./en";
import { ko } from "./ko";
import { apiLogsDateAtom, apiLogsHostFilterAtom, apiLogsMethodFilterAtom, apiLogsSearchAtom } from "./store";

export const Route = createFileRoute("/apis/logs/")({
  component: ApiLogs,
});

// ─── LogRow: memoized row to avoid full-list re-renders on updates ────────────
interface LogRowProps {
  entry: ApiLogEntry;
  formattedTime: string;
  onClick: (entry: ApiLogEntry) => void;
}

const LogRow = React.memo(function LogRowItem({ entry, formattedTime, onClick }: LogRowProps) {
  return (
    <button
      type="button"
      className="w-full grid grid-cols-[60px_50px_1fr] tablet:grid-cols-[80px_60px_1fr_120px] gap-2 tablet:gap-4 items-center px-4 tablet:px-6 hover:bg-base-200/50 transition-all text-left group border-l-4 border-l-transparent hover:border-l-primary border-b border-base-300/50"
      onClick={() => onClick(entry)}
    >
      <div className="flex shrink-0">
        <Badge
          variant={{
            color:
              (entry.status_code ?? 0) >= 500
                ? "red"
                : (entry.status_code ?? 0) >= 400
                  ? "amber"
                  : (entry.status_code ?? 0) >= 300
                    ? "blue"
                    : "green",
            size: "sm",
          }}
          className="font-black w-[40px] tablet:w-[50px] text-[10px] tablet:text-xs justify-center tracking-tighter"
        >
          {entry.status_code ?? "-"}
        </Badge>
      </div>
      <span
        className={`font-black text-[9px] tablet:text-[10px] uppercase tracking-tighter shrink-0 ${
          entry.method === "GET"
            ? "text-success"
            : entry.method === "POST"
              ? "text-info"
              : entry.method === "PUT"
                ? "text-warning"
                : entry.method === "DELETE"
                  ? "text-error"
                  : "text-base-content/60"
        }`}
      >
        {entry.method}
      </span>

      <div className="min-w-0 flex flex-col gap-0.5">
        <span
          className="text-xs tablet:text-sm font-bold text-base-content/80 truncate font-mono tracking-tight"
          title={entry.url}
        >
          {entry.path}
        </span>
        <span className="text-[9px] tablet:text-[10px] text-base-content/40 font-bold uppercase truncate tracking-wider">
          {entry.host}
        </span>
      </div>

      <span className="hidden tablet:block text-xs text-base-content/40 font-mono text-right tabular-nums group-hover:text-base-content/80 transition-colors shrink-0">
        {formattedTime}
      </span>
    </button>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────
function ApiLogs() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [date, setDate] = useAtom(apiLogsDateAtom);
  const [, setAvailableDates] = useState<string[]>([]);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [hasPendingUpdates, setHasPendingUpdates] = useState(false);
  const [search, setSearch] = useAtom(apiLogsSearchAtom);
  const [localSearch, setLocalSearch] = useState(search);
  const [hostFilter, setHostFilter] = useAtom(apiLogsHostFilterAtom);
  const [localHostFilter, setLocalHostFilter] = useState(hostFilter);
  const [methodFilter, setMethodFilter] = useAtom(apiLogsMethodFilterAtom);
  const [selectedLog, setSelectedLog] = useState<ApiLogEntry | null>(null);
  const [clearing, setClearing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, setCreateMockModal] = useAtom(createMockModalAtom);
  const { alert: promiseAlert } = usePromiseModal();
  const savedJsonSchemas = useAtomValue(savedJsonSchemasAtom);

  // Schema validation state for log detail modal
  const [logSchemaEnabled, setLogSchemaEnabled] = useState(false);
  const [logSchemaText, setLogSchemaText] = useState("");
  const [logSchemaResult, setLogSchemaResult] = useState<{ valid: boolean; errors: string | null } | null>(null);

  // Run schema validation when enabled/response/schema changes in modal
  // Guards: payload size limit (500 KB) + debounce 600ms to prevent hammering
  // the Rust backend on every keystroke or large log body.
  useEffect(() => {
    if (!logSchemaEnabled || !selectedLog?.response_body) {
      setLogSchemaResult(null);
      return;
    }
    const body = selectedLog.response_body ?? "";
    if (body.length > 500_000) {
      setLogSchemaResult({
        valid: false,
        errors: `Payload too large for validation (${(body.length / 1024).toFixed(0)} KB). Limit: 500 KB.`,
      });
      return;
    }
    if (!logSchemaText.trim()) {
      setLogSchemaResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await validateJsonSchema(body, logSchemaText);
        setLogSchemaResult(result);
      } catch (err: any) {
        setLogSchemaResult({ valid: false, errors: err.message || "Validation failed" });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [logSchemaEnabled, selectedLog, logSchemaText]);

  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(localSearch), 600);
    return () => clearTimeout(timer);
  }, [localSearch, setSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setHostFilter(localHostFilter), 600);
    return () => clearTimeout(timer);
  }, [localHostFilter, setHostFilter]);

  const domainCount = useAtomValue(domainCountAtom);
  const apiLoggingCount = useAtomValue(apiLoggingCountAtom);
  const isProxyRunning = useAtomValue(proxyRunningAtom);

  // ── Filter refs: always up-to-date inside the polling interval without ──────
  // ── recreating fetchLogs (and therefore the interval) on every change. ──────
  const searchRef = useRef(search);
  const methodFilterRef = useRef(methodFilter);
  const hostFilterRef = useRef(hostFilter);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);
  useEffect(() => {
    methodFilterRef.current = methodFilter;
  }, [methodFilter]);
  useEffect(() => {
    hostFilterRef.current = hostFilter;
  }, [hostFilter]);

  // 날짜 목록 조회
  const fetchDates = useCallback(async () => {
    try {
      const res = await commands.listApiLogDates().then(unwrap);
      if (res.success && res.data) {
        setAvailableDates(res.data);
      }
    } catch (e) {
      console.error("list_api_log_dates:", e);
    }
  }, []);

  // Abort ref: cancels stale in-flight data writes — does NOT gate loading state
  const fetchAbortRef = useRef<AbortController | null>(null);
  const activeRequestRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const logMatchesCurrentFilters = useCallback((entry: ApiLogEntry) => {
    const domainFilter = searchRef.current.trim();
    const method = methodFilterRef.current;
    const host = hostFilterRef.current.trim();
    if (method && entry.method !== method) {
      return false;
    }
    if (host && !entry.host.includes(host)) {
      return false;
    }
    if (domainFilter && !entry.url.includes(domainFilter)) {
      return false;
    }
    return true;
  }, []);

  // 로그 목록 조회 — stable function reference; reads filters from refs
  type FetchMode = "initial" | "silent" | "refresh";

  const fetchLogs = useCallback(async (targetDate: string, mode: FetchMode = "silent") => {
    const requestId = ++activeRequestRef.current;

    // Abort the previous request so its result doesn't overwrite ours
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    if (mode === "initial") {
      setInitialLoading(true);
    }
    if (mode === "refresh") {
      setRefreshing(true);
    }
    if (mode === "silent") {
      setIsFetching(true);
    }

    try {
      const res = await commands
        .getApiLogs({
          date: targetDate,
          domainFilter: searchRef.current.trim() || null,
          methodFilter: methodFilterRef.current || null,
          hostFilter: hostFilterRef.current.trim() || null,
          exactMatch: null,
        })
        .then(unwrap);

      // Don't update state with a stale response
      if (controller.signal.aborted || requestId !== activeRequestRef.current) {
        return;
      }

      if (res.success && res.data) {
        setLogs(res.data);
      } else {
        setLogs([]);
      }
    } catch (e: unknown) {
      if (controller.signal.aborted || requestId !== activeRequestRef.current) {
        return;
      }
      console.error("get_api_logs:", e);
      setLogs([]);
    } finally {
      if (requestId === activeRequestRef.current) {
        if (mode === "initial") {
          setInitialLoading(false);
        }
        if (mode === "refresh") {
          setRefreshing(false);
        }
        if (mode === "silent") {
          setIsFetching(false);
        }
      }
    }
  }, []);

  // Guard: prevent the filter effect from firing on the very first mount.
  // The date effect below already does the initial fetch.
  const isMountedRef = useRef(false);
  const dateRef = useRef(date);
  useEffect(() => {
    dateRef.current = date;
  }, [date]);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    setHasPendingUpdates(false);
    fetchLogs(dateRef.current, "silent");
  }, [fetchLogs]);

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  useEffect(() => {
    setHasPendingUpdates(false);
    if (hasLoadedOnceRef.current) {
      setLogs([]);
    }
    const mode: FetchMode = hasLoadedOnceRef.current ? "silent" : "initial";
    void fetchLogs(date, mode).finally(() => {
      hasLoadedOnceRef.current = true;
    });
  }, [date, fetchLogs]);

  // Proxy captures a log → notify when it matches the selected date + filters
  useEffect(() => {
    const unlisten = listen<ApiLogEntry>("api-log-captured", (event) => {
      const entry = event.payload;
      const logDate = entry.timestamp.length >= 10 ? entry.timestamp.slice(0, 10) : "";
      if (logDate !== dateRef.current) {
        return;
      }
      if (!logMatchesCurrentFilters(entry)) {
        return;
      }
      setHasPendingUpdates(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [logMatchesCurrentFilters]);

  const handleRefresh = useCallback(() => {
    setHasPendingUpdates(false);
    void fetchLogs(date, "refresh");
  }, [date, fetchLogs]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const changeDate = (days: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    setDate(newDate.toISOString().split("T")[0]);
  };

  const handleClearLogs = async (clearAll: boolean) => {
    if (!confirm(clearAll ? t.clearAllConfirm : t.clearConfirm(date))) {
      return;
    }
    setClearing(true);
    try {
      await commands
        .clearApiLogs({
          date: clearAll ? null : date,
        })
        .then(unwrap);
      setLogs([]);
      await fetchDates();
    } catch (e) {
      console.error("clear_api_logs:", e);
    } finally {
      setClearing(false);
    }
  };

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
  });

  // Pre-format all timestamps once when logs change — avoids calling new Date() per virtualised row render
  const formattedTimestamps = useMemo(() => {
    return logs.map((log) =>
      new Date(log.timestamp).toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  }, [logs]);

  // Stable row click handler — does not change between renders
  const handleRowClick = useCallback((log: ApiLogEntry) => {
    setSelectedLog(log);
  }, []);

  const formatBody = useCallback((body: string | null): string => {
    return formatHttpBody(body);
  }, []);

  const handleCopyHtml = useCallback(async () => {
    setIsDropdownOpen(false);
    if (!selectedLog) {
      return;
    }

    const getMethodBgColor = (method: string) => {
      const m = method.toUpperCase();
      if (m === "GET") {
        return "#0078d4";
      }
      if (m === "POST") {
        return "#107c41";
      }
      if (m === "PUT" || m === "PATCH") {
        return "#d83b01";
      }
      if (m === "DELETE") {
        return "#a80000";
      }
      return "#605e5c";
    };

    const getStatusColor = (status: number | null) => {
      if (!status) {
        return "#605e5c";
      }
      if (status >= 500) {
        return "#a80000";
      }
      if (status >= 400) {
        return "#d83b01";
      }
      if (status >= 300) {
        return "#0078d4";
      }
      return "#107c41";
    };

    const formattedReqBody = formatBody(selectedLog.request_body);
    const formattedResBody = formatBody(selectedLog.response_body);

    const methodColor = getMethodBgColor(selectedLog.method);
    const statusColor = getStatusColor(selectedLog.status_code);

    let reqHeadersHtml = "";
    if (selectedLog.request_headers && Object.keys(selectedLog.request_headers).length > 0) {
      reqHeadersHtml = Object.entries(selectedLog.request_headers)
        .map(
          ([k, v]) => `
        <div style="margin-bottom: 4px; font-family: monospace; font-size: 11px;">
          <strong style="color: #605e5c;">${k}:</strong> <span style="color: #323130; word-break: break-all;">${v}</span>
        </div>`,
        )
        .join("");
    } else {
      reqHeadersHtml = '<div style="font-size: 11px; color: #a19f9d; font-style: italic;">No headers</div>';
    }

    let resHeadersHtml = "";
    if (selectedLog.response_headers && Object.keys(selectedLog.response_headers).length > 0) {
      resHeadersHtml = Object.entries(selectedLog.response_headers)
        .map(
          ([k, v]) => `
        <div style="margin-bottom: 4px; font-family: monospace; font-size: 11px;">
          <strong style="color: #605e5c;">${k}:</strong> <span style="color: #323130; word-break: break-all;">${v}</span>
        </div>`,
        )
        .join("");
    } else {
      resHeadersHtml = '<div style="font-size: 11px; color: #a19f9d; font-style: italic;">No headers</div>';
    }

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #323130; max-width: 800px; border: 1px solid #edebe9; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
  <div style="padding: 12px 16px; background-color: #f3f2f1; border-bottom: 1px solid #edebe9;">
    <span style="display: inline-block; font-weight: bold; background-color: ${methodColor}; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-family: monospace; margin-right: 8px;">${selectedLog.method}</span>
    <strong style="font-family: monospace; font-size: 12px; word-break: break-all;">${selectedLog.url}</strong>
  </div>
  
  <div style="padding: 8px 16px; background-color: #faf9f8; border-bottom: 1px solid #edebe9; font-size: 11px; color: #605e5c;">
    <strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold; font-family: monospace;">${selectedLog.status_code ?? "-"}</span>
    <span style="margin: 0 10px; color: #edebe9;">|</span>
    <strong>Time:</strong> <span style="font-family: monospace;">${new Date(selectedLog.timestamp).toLocaleString()}</span>
  </div>

  <div style="padding: 16px;">
    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">${t.requestHeaders}</h4>
    <div style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px;">
      ${reqHeadersHtml}
    </div>

    ${
      formattedReqBody
        ? `
    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">${t.requestBody}</h4>
    <pre style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #323130; margin-top: 0;">${formattedReqBody}</pre>
    `
        : ""
    }

    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">${t.responseHeaders}</h4>
    <div style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px;">
      ${resHeadersHtml}
    </div>

    ${
      formattedResBody
        ? `
    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">${t.responseBody}</h4>
    <pre style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #323130; margin-top: 0;">${formattedResBody}</pre>
    `
        : ""
    }
  </div>
</div>
`;

    const plainHeaders = (headers: Record<string, string> | null) => {
      if (!headers) {
        return "No headers";
      }
      return Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
    };

    const plain = `METHOD: ${selectedLog.method}
URL: ${selectedLog.url}
Status: ${selectedLog.status_code ?? "-"}
Time: ${new Date(selectedLog.timestamp).toLocaleString()}

[${t.requestHeaders}]
${plainHeaders(selectedLog.request_headers)}
${formattedReqBody ? `\n[${t.requestBody}]\n${formattedReqBody}\n` : ""}
[${t.responseHeaders}]
${plainHeaders(selectedLog.response_headers)}
${formattedResBody ? `\n[${t.responseBody}]\n${formattedResBody}\n` : ""}
`;

    try {
      const blobHtml = new Blob([html], { type: "text/html" });
      const blobText = new Blob([plain], { type: "text/plain" });
      const data = [
        new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        }),
      ];
      await navigator.clipboard.write(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      promiseAlert(t.copied, t.copiedDesc);
    } catch (err) {
      console.error("Failed to copy HTML, falling back to text:", err);
      try {
        await navigator.clipboard.writeText(plain);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        promiseAlert(t.copied, t.copiedDesc);
      } catch (err2) {
        console.error("Failed to copy text:", err2);
      }
    }
  }, [
    selectedLog,
    t.requestHeaders,
    t.requestBody,
    t.responseHeaders,
    t.responseBody,
    formatBody,
    promiseAlert,
    t.copied,
    t.copiedDesc,
  ]);

  const handleCopyMarkdown = useCallback(async () => {
    setIsDropdownOpen(false);
    if (!selectedLog) {
      return;
    }

    const formattedReqBody = formatBody(selectedLog.request_body);
    const formattedResBody = formatBody(selectedLog.response_body);

    const plainHeaders = (headers: Record<string, string> | null) => {
      if (!headers || Object.keys(headers).length === 0) {
        return "No headers";
      }
      return Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
    };

    const reqHeadersStr = plainHeaders(selectedLog.request_headers);
    const resHeadersStr = plainHeaders(selectedLog.response_headers);

    const md = `### **[${selectedLog.method.toUpperCase()}]** \`${selectedLog.url}\`
**Status:** \`${selectedLog.status_code ?? "-"}\` | **Time:** \`${new Date(selectedLog.timestamp).toLocaleString()}\`

#### **${t.requestHeaders}**
\`\`\`http
${reqHeadersStr}
\`\`\`
${
  formattedReqBody
    ? `
#### **${t.requestBody}**
\`\`\`json
${formattedReqBody}
\`\`\`
`
    : ""
}
#### **${t.responseHeaders}**
\`\`\`http
${resHeadersStr}
\`\`\`
${
  formattedResBody
    ? `
#### **${t.responseBody}**
\`\`\`json
${formattedResBody}
\`\`\`
`
    : ""
}
`;

    const methodColor =
      selectedLog.method.toUpperCase() === "GET"
        ? "#0078d4"
        : selectedLog.method.toUpperCase() === "POST"
          ? "#107c41"
          : ["PUT", "PATCH"].includes(selectedLog.method.toUpperCase())
            ? "#d83b01"
            : selectedLog.method.toUpperCase() === "DELETE"
              ? "#a80000"
              : "#605e5c";

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #242424; max-width: 800px;">
  <div style="margin-bottom: 8px;">
    <span style="font-weight: bold; font-family: monospace; font-size: 12px; color: ${methodColor};">[${selectedLog.method.toUpperCase()}]</span> 
    <code style="font-family: Consolas, monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px; font-size: 12px;">${selectedLog.url}</code>
  </div>
  <div style="font-size: 12px; color: #616161; margin-bottom: 16px;">
    <strong>Status:</strong> <code style="font-family: Consolas, monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px; font-size: 11px;">${selectedLog.status_code ?? "-"}</code>
    <span style="margin: 0 8px; color: #d2d2d2;">|</span>
    <strong>Time:</strong> <code style="font-family: Consolas, monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px; font-size: 11px;">${new Date(selectedLog.timestamp).toLocaleString()}</code>
  </div>

  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">${t.requestHeaders}</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${reqHeadersStr}</pre>
  </div>

  ${
    formattedReqBody
      ? `
  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">${t.requestBody}</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${formattedReqBody}</pre>
  </div>
  `
      : ""
  }

  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">${t.responseHeaders}</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${resHeadersStr}</pre>
  </div>

  ${
    formattedResBody
      ? `
  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">${t.responseBody}</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${formattedResBody}</pre>
  </div>
  `
      : ""
  }
</div>
`;

    try {
      const blobHtml = new Blob([html], { type: "text/html" });
      const blobText = new Blob([md], { type: "text/plain" });
      const data = [
        new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        }),
      ];
      await navigator.clipboard.write(data);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
      promiseAlert(t.copied, t.copiedDesc);
    } catch (err) {
      console.error("Failed to copy Markdown HTML, falling back to plain text:", err);
      try {
        await navigator.clipboard.writeText(md);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
        promiseAlert(t.copied, t.copiedDesc);
      } catch (err2) {
        console.error("Failed to copy text:", err2);
      }
    }
  }, [
    selectedLog,
    t.requestHeaders,
    t.requestBody,
    t.responseHeaders,
    t.responseBody,
    formatBody,
    promiseAlert,
    t.copied,
    t.copiedDesc,
  ]);

  const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

  return (
    <div className="flex flex-col gap-6 pb-20 h-[calc(100vh-6rem)] overflow-hidden">
      <AnimatePresence>
        {initialLoading && logs.length === 0 && (
          <LoadingScreen key="logs-loader" onCancel={() => setInitialLoading(false)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex flex-col tablet:flex-row justify-between items-start tablet:items-center gap-4 shrink-0 px-1">
        <div>
          <div className="flex items-center gap-3 mb-1 tablet:mb-2">
            <div className="p-1.5 tablet:p-2 bg-secondary/10 text-secondary rounded-lg">
              <History className="w-4 h-4 tablet:w-5 tablet:h-5" />
            </div>
            <h1 className="text-2xl tablet:text-3xl font-black tracking-tight text-base-content">{t.title}</h1>
          </div>
          <p className="text-base-content/60 text-xs tablet:text-sm font-medium">{t.subtitle}</p>
        </div>

        {isProxyRunning && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={hasPendingUpdates ? "primary" : "secondary"}
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 h-9 tablet:h-10 px-3 tablet:px-4 whitespace-nowrap shrink-0"
            >
              <History className={clsx("w-3.5 h-3.5 tablet:w-4 tablet:h-4", refreshing && "animate-spin")} />
              <span className="text-xs tablet:text-sm">{t.refresh}</span>
            </Button>

            {/* Date Navigator */}
            <div className="flex items-center gap-1 tablet:gap-2 bg-base-100 p-0.5 tablet:p-1 rounded-xl border border-base-300 shadow-sm h-9 tablet:h-10">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => changeDate(-1)}
                className="h-7 w-7 tablet:h-8 tablet:w-8"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1 tablet:gap-2 px-1 tablet:px-3">
                <Calendar className="w-3.5 h-3.5 tablet:w-4 tablet:h-4 text-base-content/40" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-[11px] tablet:text-sm font-bold text-base-content outline-none bg-transparent w-[100px] tablet:w-[110px]"
                />
              </div>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => changeDate(1)}
                disabled={date === new Date().toISOString().split("T")[0]}
                className="h-7 w-7 tablet:h-8 tablet:w-8"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </header>

      <ProxyServerWarning />

      {isProxyRunning && (
        <>
          {hasPendingUpdates && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-info/10 border border-info/30 rounded-xl shrink-0">
              <p className="text-xs tablet:text-sm font-bold text-info">{t.newLogsAvailable}</p>
              <Button variant="primary" size="sm" onClick={handleRefresh} disabled={refreshing}>
                {t.refreshNow}
              </Button>
            </div>
          )}

          {/* Filters & Actions */}
          <div className="flex flex-col tablet:flex-row gap-3 shrink-0">
            <div className="flex flex-1 gap-3">
              <Card className="p-2 bg-base-100 border-base-300 flex-1 flex items-center gap-3 px-3 tablet:px-4 shadow-sm h-10 tablet:h-auto">
                <Search className="w-3.5 h-3.5 tablet:w-4 tablet:h-4 text-base-content/40 shrink-0" />
                <input
                  type="text"
                  placeholder={t.filterPath}
                  className="bg-transparent border-none outline-none text-xs tablet:text-sm w-full font-bold min-w-0 placeholder:text-base-content/30 text-base-content"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                />
                {localSearch && (
                  <button
                    type="button"
                    onClick={() => setLocalSearch("")}
                    className="text-base-content/40 hover:text-base-content/80 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </Card>

              <Card className="p-2 bg-base-100 border-base-300 flex-1 flex items-center gap-3 px-3 tablet:px-4 shadow-sm h-10 tablet:h-auto">
                <GlobeIcon className="w-3.5 h-3.5 tablet:w-4 tablet:h-4 text-base-content/40 shrink-0" />
                <input
                  type="text"
                  placeholder={t.filterHost}
                  className="bg-transparent border-none outline-none text-xs tablet:text-sm w-full font-bold min-w-0 placeholder:text-base-content/30 text-base-content"
                  value={localHostFilter}
                  onChange={(e) => setLocalHostFilter(e.target.value)}
                />
                {localHostFilter && (
                  <button
                    type="button"
                    onClick={() => setLocalHostFilter("")}
                    className="text-base-content/40 hover:text-base-content/80 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </Card>
            </div>

            <div className="flex items-center gap-1 tablet:gap-2 bg-base-100 rounded-xl border border-base-300 p-0.5 tablet:p-1 shadow-sm overflow-x-auto [scrollbar-width:none]">
              <Button
                variant={methodFilter === "" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setMethodFilter("")}
                className="font-black text-[9px] tablet:text-[10px] uppercase tracking-tighter h-8 px-2 tablet:px-3"
              >
                {t.allMethods}
              </Button>
              <div className="w-px h-4 bg-base-300 mx-0.5 tablet:mx-1 shrink-0" />
              {METHODS.map((m) => (
                <Button
                  key={m}
                  variant={methodFilter === m ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setMethodFilter(methodFilter === m ? "" : m)}
                  className="font-black text-[9px] tablet:text-[10px] h-8 px-2 tablet:px-3 uppercase tracking-tighter shrink-0"
                >
                  {m}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex items-center gap-2 h-9 tablet:h-auto whitespace-nowrap shrink-0 flex-1 tablet:flex-initial"
                onClick={() => handleClearLogs(false)}
                disabled={clearing || logs.length === 0}
              >
                <Trash2 className="w-3.5 h-3.5 tablet:w-4 tablet:h-4" />
                <span className="text-xs tablet:text-sm">{t.clearDate(date)}</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex items-center gap-1.5 tablet:gap-2 h-9 tablet:h-auto whitespace-nowrap shrink-0 flex-1 tablet:flex-initial"
                onClick={() => handleClearLogs(true)}
                disabled={clearing}
              >
                <Trash2 className="w-3.5 h-3.5 tablet:w-4 tablet:h-4" />
                <span className="text-xs tablet:text-sm">{t.clearAll}</span>
              </Button>
            </div>
          </div>

          {/* Log List */}
          <div className="bg-base-100 rounded-2xl border border-base-300 shadow-xl overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="grid grid-cols-[60px_50px_1fr] tablet:grid-cols-[80px_60px_1fr_120px] gap-2 tablet:gap-4 px-4 tablet:px-6 py-3 bg-base-200/50 border-b border-base-300 text-[9px] tablet:text-[10px] font-black text-base-content/40 uppercase tracking-widest shrink-0">
              <div>{t.status}</div>
              <div>{t.method}</div>
              <div>{t.urlPath}</div>
              <div className="hidden tablet:block text-right">{t.time}</div>
            </div>

            <div ref={parentRef} className="overflow-y-auto flex-1 p-0 relative">
              {domainCount === 0 ? (
                <div className="p-4">
                  <EmptyState tier={1} lang={lang} />
                </div>
              ) : apiLoggingCount === 0 ? (
                <div className="p-4">
                  <EmptyState
                    tier={2}
                    icon={History}
                    title={t.noApiLoggingTitle}
                    description={t.noApiLoggingDesc}
                    actionLabel={t.noApiLoggingAction}
                    actionHref="/apis/settings"
                  />
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-30 grayscale">
                  <FileText className="w-12 h-12 text-base-content" />
                  <p className="text-sm font-black uppercase tracking-widest text-base-content">
                    {initialLoading || refreshing || isFetching ? t.loadingLogs : t.noLogsFound}
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const log = logs[virtualRow.index];
                    if (!log) {
                      return null;
                    }
                    return (
                      <div
                        key={log.id}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <LogRow
                          entry={log}
                          formattedTime={formattedTimestamps[virtualRow.index] ?? ""}
                          onClick={handleRowClick}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Log Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => {
          setSelectedLog(null);
          setLogSchemaEnabled(false);
          setLogSchemaResult(null);
        }}
        size="4xl"
      >
        <Modal.Header title={t.logDetails} description={selectedLog?.id} />
        <Modal.Body className="flex flex-col gap-6 py-4 max-h-[70vh] overflow-y-auto px-6">
          {selectedLog && (
            <ApiLogExchangeDetail
              log={selectedLog}
              labels={{
                request: t.request,
                requestBody: t.requestBody,
                requestHeaders: t.requestHeaders,
                status: t.status,
                time: t.time,
                empty: t.empty,
              }}
              actions={
                <>
                  <div className="relative inline-block text-left" ref={dropdownRef}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsDropdownOpen((prev) => !prev)}
                      className="flex items-center gap-1.5 h-8 font-bold"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-success" />
                          <span className="text-success">{t.copied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t.btnCopy}</span>
                          <ChevronDown className="w-3 h-3 text-base-content/40" />
                        </>
                      )}
                    </Button>

                    {isDropdownOpen && (
                      <div className="absolute right-0 mt-1 w-44 bg-base-100 border border-base-300 rounded-xl shadow-xl z-50 py-1 overflow-hidden backdrop-blur-md bg-base-100/95">
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-xs hover:bg-base-200 text-base-content font-bold transition-colors cursor-pointer"
                          onClick={handleCopyHtml}
                        >
                          {t.copyHtml}
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 text-xs hover:bg-base-200 border-t border-base-200 text-base-content font-bold transition-colors cursor-pointer"
                          onClick={handleCopyMarkdown}
                        >
                          {t.copyMarkdown}
                        </button>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-1.5 h-8 font-bold"
                    onClick={() => {
                      setCreateMockModal({
                        isOpen: true,
                        logData: selectedLog,
                      });
                    }}
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>Save as Mock</span>
                  </Button>
                </>
              }
              responseViewerProps={{
                t,
                showSchemaTab: true,
                enableSchemaValidation: logSchemaEnabled,
                onToggleSchemaValidation: setLogSchemaEnabled,
                schemaText: logSchemaText,
                onChangeSchemaText: setLogSchemaText,
                schemaValidationResult: logSchemaResult,
                savedJsonSchemas,
                heightClass: "",
                bodyPanelHeightClass: "min-h-[280px] max-h-[50vh]",
                hideOnEmpty: false,
              }}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSelectedLog(null)} className="w-full sm:w-auto">
            {t.close}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
