import { createFileRoute } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { usePromiseModal } from "@/entities/app/hooks/usePromiseModal";
import { languageAtom } from "@/entities/app/i18n/store";
import { apiLoggingCountAtom, domainCountAtom, proxyRunningAtom } from "@/entities/app/status/store";
import { ProxyServerWarning } from "@/entities/proxy/ui/ProxyServerWarning";
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

function ApiLogs() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [date, setDate] = useAtom(apiLogsDateAtom);
  const [, setAvailableDates] = useState<string[]>([]);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
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

  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(localSearch), 400);
    return () => clearTimeout(timer);
  }, [localSearch, setSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setHostFilter(localHostFilter), 400);
    return () => clearTimeout(timer);
  }, [localHostFilter, setHostFilter]);

  const domainCount = useAtomValue(domainCountAtom);
  const apiLoggingCount = useAtomValue(apiLoggingCountAtom);
  const isProxyRunning = useAtomValue(proxyRunningAtom);

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

  // 로그 목록 조회
  const fetchLogs = useCallback(
    async (targetDate: string) => {
      setLoading(true);
      try {
        const res = await commands
          .getApiLogs({
            date: targetDate,
            domainFilter: search.trim() || null,
            methodFilter: methodFilter || null,
            hostFilter: hostFilter.trim() || null,
            exactMatch: null,
          })
          .then(unwrap);
        if (res.success && res.data) {
          setLogs(res.data);
        } else {
          setLogs([]);
        }
      } catch (e) {
        console.error("get_api_logs:", e);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [search, methodFilter, hostFilter],
  );

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  useEffect(() => {
    fetchLogs(date);
    // 폴링 대신 수동 새로고침 버튼을 두거나, 필요시 5초 주기 폴링 추가 가능
    const interval = setInterval(() => fetchLogs(date), 5000);
    return () => clearInterval(interval);
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
    estimateSize: () => 52, // Height of the row (py-3 approx + content)
    overscan: 10,
  });

  const formatBody = useCallback((body: string | null): string => {
    if (!body) {
      return "";
    }
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
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
        {loading && logs.length === 0 && <LoadingScreen key="logs-loader" onCancel={() => setLoading(false)} />}
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
              variant="secondary"
              size="sm"
              onClick={() => fetchLogs(date)}
              disabled={loading}
              className="flex items-center gap-2 h-9 tablet:h-10 px-3 tablet:px-4 whitespace-nowrap shrink-0"
            >
              <History className={clsx("w-3.5 h-3.5 tablet:w-4 tablet:h-4", loading && "animate-spin")} />
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
                    {loading ? t.loadingLogs : t.noLogsFound}
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
                    return (
                      <button
                        type="button"
                        key={log.id}
                        className="w-full grid grid-cols-[60px_50px_1fr] tablet:grid-cols-[80px_60px_1fr_120px] gap-2 tablet:gap-4 items-center px-4 tablet:px-6 hover:bg-base-200/50 transition-all text-left group border-l-4 border-l-transparent hover:border-l-primary border-b border-base-300/50"
                        onClick={() => setSelectedLog(log)}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="flex shrink-0">
                          <Badge
                            variant={{
                              color:
                                (log.status_code ?? 0) >= 500
                                  ? "red"
                                  : (log.status_code ?? 0) >= 400
                                    ? "amber"
                                    : (log.status_code ?? 0) >= 300
                                      ? "blue"
                                      : "green",
                              size: "sm",
                            }}
                            className="font-black w-[40px] tablet:w-[50px] text-[10px] tablet:text-xs justify-center tracking-tighter"
                          >
                            {log.status_code ?? "-"}
                          </Badge>
                        </div>
                        <span
                          className={`font-black text-[9px] tablet:text-[10px] uppercase tracking-tighter shrink-0 ${
                            log.method === "GET"
                              ? "text-success"
                              : log.method === "POST"
                                ? "text-info"
                                : log.method === "PUT"
                                  ? "text-warning"
                                  : log.method === "DELETE"
                                    ? "text-error"
                                    : "text-base-content/60"
                          }`}
                        >
                          {log.method}
                        </span>

                        <div className="min-w-0 flex flex-col gap-0.5">
                          <span
                            className="text-xs tablet:text-sm font-bold text-base-content/80 truncate font-mono tracking-tight"
                            title={log.url}
                          >
                            {log.path}
                          </span>
                          <span className="text-[9px] tablet:text-[10px] text-base-content/40 font-bold uppercase truncate tracking-wider">
                            {log.host}
                          </span>
                        </div>

                        <span className="hidden tablet:block text-xs text-base-content/40 font-mono text-right tabular-nums group-hover:text-base-content/80 transition-colors shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour12: false,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Log Detail Modal */}
      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)}>
        <Modal.Header title={t.logDetails} description={selectedLog?.id} />
        <Modal.Body className="flex flex-col gap-6 py-4 max-h-[70vh] overflow-y-auto px-6">
          {selectedLog && (
            <>
              {/* Summary */}
              <div className="flex flex-col gap-3 p-5 bg-base-200/50 rounded-2xl border border-base-300 shadow-inner relative">
                <div className="absolute top-4 right-4 flex gap-2">
                  {/* Copy Dropdown */}
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
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={{ color: "slate", size: "sm" }}
                    className="font-black bg-base-300 text-base-content/80"
                  >
                    {selectedLog.method}
                  </Badge>
                  <span className="font-mono text-sm font-bold text-base-content break-all leading-tight pr-56">
                    {selectedLog.url}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-base-content/40 mt-1">
                  <span className="flex items-center gap-1.5">
                    {t.status}:{" "}
                    <b className={(selectedLog.status_code ?? 0) >= 400 ? "text-error" : "text-success"}>
                      {selectedLog.status_code ?? "-"}
                    </b>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {t.time}:{" "}
                    <span className="text-base-content/80">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                  </span>
                </div>
              </div>

              {/* Request Headers */}
              {selectedLog.request_headers && Object.keys(selectedLog.request_headers).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
                    {t.requestHeaders}
                  </h3>
                  <div className="bg-base-200/50 rounded-xl border border-base-300 p-4 shadow-inner">
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(selectedLog.request_headers).map(([k, v]) => (
                        <div key={k} className="text-xs font-mono flex items-start gap-1">
                          <span className="text-base-content/50 font-semibold shrink-0 select-all">{k}:</span>
                          <span className="text-base-content/85 select-all break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Request Body */}
              {selectedLog.request_body && (
                <div>
                  <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
                    {t.requestBody}
                  </h3>
                  <div className="bg-base-200/50 rounded-xl border border-base-300 p-4 overflow-x-auto max-h-48 relative shadow-inner">
                    <pre className="text-xs font-mono text-base-content/85 whitespace-pre-wrap break-all">
                      {formatBody(selectedLog.request_body)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Response Headers */}
              {selectedLog.response_headers && Object.keys(selectedLog.response_headers).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2 mt-2">
                    {t.responseHeaders}
                  </h3>
                  <div className="bg-base-200/50 rounded-xl border border-base-300 p-4 shadow-inner">
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(selectedLog.response_headers).map(([k, v]) => (
                        <div key={k} className="text-xs font-mono flex items-start gap-1">
                          <span className="text-base-content/50 font-semibold shrink-0 select-all">{k}:</span>
                          <span className="text-base-content/85 select-all break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Response Body */}
              {selectedLog.response_body && (
                <div>
                  <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
                    {t.responseBody}
                  </h3>
                  <div className="bg-base-200/50 rounded-xl border border-base-300 p-4 overflow-x-auto max-h-60 shadow-inner">
                    <pre className="text-xs font-mono text-base-content/85 whitespace-pre-wrap break-all">
                      {formatBody(selectedLog.response_body)}
                    </pre>
                  </div>
                </div>
              )}
            </>
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
