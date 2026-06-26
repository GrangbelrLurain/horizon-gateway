import { createFileRoute } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import { BookOpen, Check, ChevronDown, ChevronRight, Clock, Copy, Globe, Loader2, Play, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { languageAtom, usePromiseModal } from "@/entities/app";
import type { ApiLogEntry, Domain, DomainApiLoggingLink } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { type OpenApiSpec, type ParsedEndpoint, parseOpenApiSpec, type TagGroup } from "@/shared/lib/openapi-parser";
import { Badge } from "@/shared/ui/badge/badge";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";
import { H1, P } from "@/shared/ui/typography/typography";
import { en } from "./en";
import { ko } from "./ko";
import {
  apiSchemaFormsAtom,
  apiSchemaSearchAtom,
  apiSchemaSelectedDomainIdAtom,
  apiSchemaSelectedEndpointAtom,
  type EndpointFormState,
} from "./store";

export const Route = createFileRoute("/apis/schema/")({
  component: ApiSchemaPage,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, { color: "green" | "blue" | "amber" | "red" | "slate"; bg: string }> = {
  get: { color: "green", bg: "bg-success/10 border-success/20" },
  post: { color: "blue", bg: "bg-info/10 border-info/20" },
  put: { color: "amber", bg: "bg-warning/10 border-warning/20" },
  delete: { color: "red", bg: "bg-error/10 border-error/20" },
  patch: { color: "amber", bg: "bg-warning/10 border-warning/20" },
};

function methodStyle(m: string) {
  return METHOD_COLORS[m.toLowerCase()] ?? { color: "slate" as const, bg: "bg-base-200 border-base-300" };
}

function getTextStatusColor(code: number): "green" | "red" | "amber" | "blue" | "slate" {
  if (code < 300) {
    return "green";
  }
  if (code < 400) {
    return "blue";
  }
  if (code < 500) {
    return "amber";
  }
  return "red";
}

// ── Tag group (collapsible) ─────────────────────────────────────────────────

function TagSection({
  group,
  selected,
  onSelect,
  search,
}: {
  group: TagGroup;
  selected: ParsedEndpoint | null;
  onSelect: (ep: ParsedEndpoint) => void;
  search: string;
}) {
  const [open, setOpen] = useState(true);
  const lowerSearch = search.toLowerCase();

  const filtered = useMemo(() => {
    if (!lowerSearch) {
      return group.endpoints;
    }
    return group.endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(lowerSearch) ||
        ep.summary?.toLowerCase().includes(lowerSearch) ||
        ep.operationId?.toLowerCase().includes(lowerSearch) ||
        ep.method.toLowerCase().includes(lowerSearch),
    );
  }, [group.endpoints, lowerSearch]);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div className="mb-1">
      <button
        type="button"
        className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 text-[10px] font-black text-base-content/40 hover:text-base-content/80 uppercase tracking-widest transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {group.tag} ({filtered.length})
      </button>
      {open && (
        <ul>
          {filtered.map((ep) => {
            const key = `${ep.method}-${ep.path}`;
            const isSelected = selected && selected.method === ep.method && selected.path === ep.path;
            const ms = methodStyle(ep.method);
            return (
              <li key={key}>
                <button
                  type="button"
                  className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 text-xs transition-all border ${
                    isSelected ? "bg-primary/10 border-primary/30 shadow-sm" : "hover:bg-base-200 border-transparent"
                  }`}
                  onClick={() => onSelect(ep)}
                >
                  <Badge
                    variant={{ color: ms.color, size: "sm" }}
                    className="w-14 text-center shrink-0 font-black tracking-tighter"
                  >
                    {ep.method.toUpperCase()}
                  </Badge>
                  <span
                    className={`font-mono truncate ${isSelected ? "text-primary font-bold" : "text-base-content/80 font-medium"}`}
                  >
                    {ep.path}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── History Modal ───────────────────────────────────────────────────────────

function LogHistoryModal({
  method,
  path,
  host,
  onSelect,
  onClose,
}: {
  method: string;
  path: string;
  host: string;
  onSelect: (log: ApiLogEntry) => void;
  onClose: () => void;
}) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const res = await commands
          .getApiLogs({
            date: today,
            domainFilter: path,
            methodFilter: method.toUpperCase(),
            hostFilter: host,
            exactMatch: true,
          })
          .then(unwrap);
        if (res.success) {
          setLogs(res.data ?? []);
        }
      } catch (e) {
        console.error("fetch history logs:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [method, path, host]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl bg-base-100 max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-base-300">
        <div className="p-5 border-b border-base-300 flex items-center justify-between">
          <h3 className="font-black text-base-content flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            {t.requestHistoryToday}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-base-content/40 hover:text-base-content/80 hover:bg-base-200 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-base-content/30 font-bold uppercase tracking-widest text-xs">
              {t.noLogsFound}
            </div>
          ) : (
            <ul className="space-y-3 p-3">
              {logs.map((log) => (
                <li key={log.id}>
                  <button
                    type="button"
                    className="w-full text-left p-4 rounded-xl border border-base-300 hover:border-primary/50 hover:bg-primary/5 transition-all group shadow-sm hover:shadow-md"
                    onClick={() => onSelect(log)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={{ color: getTextStatusColor(log.status_code ?? 0), size: "sm" }}
                          className="font-black tabular-nums"
                        >
                          {log.status_code ?? "ERR"}
                        </Badge>
                        <span className="text-[10px] text-base-content/40 font-black uppercase tracking-widest">
                          {log.timestamp.replace("T", " ").split(".")[0]}
                        </span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        {t.load}
                      </span>
                    </div>
                    {(log.request_body || log.request_headers) && (
                      <div className="text-[10px] text-base-content/30 font-mono truncate bg-base-200/50 p-1.5 rounded border border-base-300/50 group-hover:border-primary/20 transition-colors">
                        {log.request_body ? t.hasBody : t.noBody} ·{" "}
                        {log.request_headers ? t.headersCount(Object.keys(log.request_headers).length) : t.noHeaders}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function EndpointDetail({
  endpoint,
  baseUrl,
  host,
  domainId,
}: {
  endpoint: ParsedEndpoint;
  baseUrl: string;
  host: string;
  domainId: number;
}) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const ms = methodStyle(endpoint.method);

  const [allForms, setAllForms] = useAtom(apiSchemaFormsAtom);
  const endpointKey = `${domainId}:${endpoint.method}:${endpoint.path}`;

  // Current state helper
  const formState = useMemo<EndpointFormState>(() => {
    const saved = allForms[endpointKey];
    if (saved) {
      return saved;
    }
    return {
      paramValues: {},
      bodyText: endpoint.requestBody?.example ? JSON.stringify(endpoint.requestBody.example, null, 2) : "",
      headerText: "",
      response: null,
      error: null,
    };
  }, [allForms, endpointKey, endpoint.requestBody]);

  const updateForm = useCallback(
    (updates: Partial<EndpointFormState>) => {
      setAllForms((prev) => ({
        ...prev,
        [endpointKey]: {
          ...formState,
          ...updates,
        },
      }));
    },
    [endpointKey, formState, setAllForms],
  );

  const { paramValues, bodyText, headerText, response, error } = formState;

  // Loading state (not persisted)
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { alert: promiseAlert } = usePromiseModal();

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

  const buildUrl = useCallback(() => {
    let path = endpoint.path;
    for (const p of endpoint.parameters.filter((param) => param.in === "path")) {
      const val = paramValues[p.name] ?? "";
      path = path.replace(`{${p.name}}`, encodeURIComponent(val));
    }
    const queryParams = endpoint.parameters.filter((p) => p.in === "query");
    const qs = queryParams
      .map((p) => {
        const val = paramValues[p.name];
        if (val === undefined || val === "") {
          return null;
        }
        return `${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`;
      })
      .filter(Boolean)
      .join("&");

    const base = baseUrl.replace(/\/+$/, "");
    return qs ? `${base}${path}?${qs}` : `${base}${path}`;
  }, [endpoint, paramValues, baseUrl]);

  const handleSend = async () => {
    setSending(true);
    updateForm({ response: null, error: null });
    try {
      const url = buildUrl();
      const headers: Record<string, string> = {};

      if (headerText.trim()) {
        for (const line of headerText.split("\n")) {
          const idx = line.indexOf(":");
          if (idx > 0) {
            headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          }
        }
      }

      for (const p of endpoint.parameters.filter((param) => param.in === "header")) {
        const val = paramValues[p.name];
        if (val) {
          headers[p.name] = val;
        }
      }

      const res = await commands
        .sendApiRequest({
          method: endpoint.method.toUpperCase(),
          url,
          headers,
          body: bodyText.trim() || null,
        })
        .then(unwrap);

      if (!res.success) {
        updateForm({ error: res.message, response: res.data ?? null });
      } else if (res.data) {
        updateForm({ response: res.data, error: null });
      }
    } catch (e) {
      updateForm({ error: String(e), response: null });
    } finally {
      setSending(false);
    }
  };

  const handleLoadLog = (log: ApiLogEntry) => {
    setHistoryOpen(false);

    let newBodyText = "";
    if (log.request_body) {
      newBodyText = log.request_body;
    }

    let newHeaderText = "";
    if (log.request_headers) {
      const lines = [];
      for (const [k, v] of Object.entries(log.request_headers)) {
        if (["host", "content-length", "connection"].includes(k.toLowerCase())) {
          continue;
        }
        lines.push(`${k}: ${v}`);
      }
      newHeaderText = lines.join("\n");
    }

    updateForm({ bodyText: newBodyText, headerText: newHeaderText });
  };

  const formattedBody = useMemo(() => {
    if (!response?.body) {
      return "";
    }
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      return response.body;
    }
  }, [response?.body]);

  const formatBodyText = useCallback((body: string | null): string => {
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

  const getRequestHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (headerText.trim()) {
      for (const line of headerText.split("\n")) {
        const idx = line.indexOf(":");
        if (idx > 0) {
          headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
    }
    for (const p of endpoint.parameters.filter((param) => param.in === "header")) {
      const val = paramValues[p.name];
      if (val) {
        headers[p.name] = val;
      }
    }
    return headers;
  }, [headerText, endpoint.parameters, paramValues]);

  const handleCopyHtml = useCallback(async () => {
    setIsDropdownOpen(false);
    if (!response) {
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

    const reqHeaders = getRequestHeaders();
    const formattedReqBody = formatBodyText(bodyText);
    const formattedResBody = formatBodyText(response.body);

    const methodColor = getMethodBgColor(endpoint.method);
    const statusColor = getStatusColor(response.statusCode);

    let reqHeadersHtml = "";
    if (Object.keys(reqHeaders).length > 0) {
      reqHeadersHtml = Object.entries(reqHeaders)
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
    if (response.headers && Object.keys(response.headers).length > 0) {
      resHeadersHtml = Object.entries(response.headers)
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
    <span style="display: inline-block; font-weight: bold; background-color: ${methodColor}; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-family: monospace; margin-right: 8px;">${endpoint.method.toUpperCase()}</span>
    <strong style="font-family: monospace; font-size: 12px; word-break: break-all;">${buildUrl()}</strong>
  </div>
  
  <div style="padding: 8px 16px; background-color: #faf9f8; border-bottom: 1px solid #edebe9; font-size: 11px; color: #605e5c;">
    <strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold; font-family: monospace;">${response.statusCode}</span>
    <span style="margin: 0 10px; color: #edebe9;">|</span>
    <strong>Time:</strong> <span style="font-family: monospace;">${response.elapsedMs}ms</span>
    <span style="margin: 0 10px; color: #edebe9;">|</span>
    <strong>Time Copied:</strong> <span style="font-family: monospace;">${new Date().toLocaleString()}</span>
  </div>

  <div style="padding: 16px;">
    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">Request Headers</h4>
    <div style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px;">
      ${reqHeadersHtml}
    </div>

    ${
      formattedReqBody
        ? `
    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">Request Body</h4>
    <pre style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #323130; margin-top: 0;">${formattedReqBody}</pre>
    `
        : ""
    }

    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">Response Headers</h4>
    <div style="background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; padding: 10px; margin-bottom: 16px;">
      ${resHeadersHtml}
    </div>

    ${
      formattedResBody
        ? `
    <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #605e5c; letter-spacing: 0.5px;">Response Body</h4>
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

    const plain = `METHOD: ${endpoint.method.toUpperCase()}
URL: ${buildUrl()}
Status: ${response.statusCode}
Time: ${response.elapsedMs}ms

[Request Headers]
${plainHeaders(reqHeaders)}
${formattedReqBody ? `\n[Request Body]\n${formattedReqBody}\n` : ""}
[Response Headers]
${plainHeaders(response.headers)}
${formattedResBody ? `\n[Response Body]\n${formattedResBody}\n` : ""}
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
  }, [response, bodyText, endpoint, buildUrl, getRequestHeaders, formatBodyText, promiseAlert, t.copied, t.copiedDesc]);

  const handleCopyMarkdown = useCallback(async () => {
    setIsDropdownOpen(false);
    if (!response) {
      return;
    }

    const reqHeaders = getRequestHeaders();
    const formattedReqBody = formatBodyText(bodyText);
    const formattedResBody = formatBodyText(response.body);

    const plainHeaders = (headers: Record<string, string> | null) => {
      if (!headers || Object.keys(headers).length === 0) {
        return "No headers";
      }
      return Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
    };

    const reqHeadersStr = plainHeaders(reqHeaders);
    const resHeadersStr = plainHeaders(response.headers);

    const md = [
      `### **[${endpoint.method.toUpperCase()}]** \`${buildUrl()}\``,
      `**Status:** \`${response.statusCode}\` | **Time:** \`${response.elapsedMs}ms\``,
      "",
      "#### **Request Headers**",
      "```http",
      reqHeadersStr,
      "```",
      ...(formattedReqBody ? ["", "#### **Request Body**", "```json", formattedReqBody, "```"] : []),
      "",
      "#### **Response Headers**",
      "```http",
      resHeadersStr,
      "```",
      ...(formattedResBody ? ["", "#### **Response Body**", "```json", formattedResBody, "```"] : []),
      "",
    ].join("\n");

    const methodColor =
      endpoint.method.toUpperCase() === "GET"
        ? "#0078d4"
        : endpoint.method.toUpperCase() === "POST"
          ? "#107c41"
          : ["PUT", "PATCH"].includes(endpoint.method.toUpperCase())
            ? "#d83b01"
            : endpoint.method.toUpperCase() === "DELETE"
              ? "#a80000"
              : "#605e5c";

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #242424; max-width: 800px;">
  <div style="margin-bottom: 8px;">
    <span style="font-weight: bold; font-family: monospace; font-size: 12px; color: ${methodColor};">[${endpoint.method.toUpperCase()}]</span> 
    <code style="font-family: Consolas, monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px; font-size: 12px;">${buildUrl()}</code>
  </div>
  <div style="font-size: 12px; color: #616161; margin-bottom: 16px;">
    <strong>Status:</strong> <code style="font-family: Consolas, monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px; font-size: 11px;">${response.statusCode}</code>
    <span style="margin: 0 8px; color: #d2d2d2;">|</span>
    <strong>Time:</strong> <code style="font-family: Consolas, monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px; font-size: 11px;">${response.elapsedMs}ms</code>
  </div>

  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">Request Headers</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${reqHeadersStr}</pre>
  </div>

  ${
    formattedReqBody
      ? `
  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">Request Body</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${formattedReqBody}</pre>
  </div>
  `
      : ""
  }

  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">Response Headers</div>
    <pre style="background-color: #f3f2f1; border-left: 3px solid #605e5c; padding: 8px 12px; font-family: Consolas, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #242424; margin: 0;">${resHeadersStr}</pre>
  </div>

  ${
    formattedResBody
      ? `
  <div style="margin-bottom: 12px;">
    <div style="font-weight: bold; margin-bottom: 4px; font-size: 12px; color: #242424;">Response Body</div>
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
  }, [response, bodyText, endpoint, buildUrl, getRequestHeaders, formatBodyText, promiseAlert, t.copied, t.copiedDesc]);

  const pathParams = endpoint.parameters.filter((p) => p.in === "path");
  const queryParams = endpoint.parameters.filter((p) => p.in === "query");
  const headerParams = endpoint.parameters.filter((p) => p.in === "header");

  const [headersOpen, setHeadersOpen] = useState(false);
  const hasParams = pathParams.length > 0 || queryParams.length > 0 || headerParams.length > 0;

  return (
    <div className="space-y-3 relative">
      {historyOpen && (
        <LogHistoryModal
          host={host}
          method={endpoint.method}
          path={endpoint.path}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleLoadLog}
        />
      )}

      <div className={`rounded-xl border p-4 shadow-sm ${ms.bg}`}>
        <div className="flex items-center gap-4">
          <Badge variant={{ color: ms.color, size: "md" }} className="font-black tracking-tight">
            {endpoint.method.toUpperCase()}
          </Badge>
          <code className="font-mono text-sm font-black text-base-content flex-1 min-w-0 truncate tracking-tight">
            {endpoint.path}
          </code>
          <div className="flex items-center gap-2">
            {/* Copy Dropdown - only when response exists */}
            {response && (
              <div className="relative inline-block text-left" ref={dropdownRef}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="gap-1.5 shrink-0 flex items-center bg-base-100 border-base-300 font-bold tracking-tight"
                  type="button"
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
            )}
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 shrink-0 flex items-center bg-base-100 border-base-300 font-bold tracking-tight"
              onClick={() => setHistoryOpen(true)}
              title={t.history}
              type="button"
            >
              <Clock className="w-3.5 h-3.5" />
              {t.history}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="gap-2 shrink-0 flex items-center font-bold tracking-tight shadow-lg shadow-primary/20"
              disabled={sending}
              onClick={handleSend}
              type="button"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {t.send}
            </Button>
          </div>
        </div>
        {endpoint.summary && (
          <p className="text-sm font-medium text-base-content/60 mt-3 border-t border-base-content/5 pt-3 leading-relaxed">
            {endpoint.summary}
          </p>
        )}
        <p className="text-[10px] text-base-content/30 mt-2 font-mono truncate bg-base-100/50 px-2 py-1 rounded border border-base-content/5">
          {buildUrl()}
        </p>
      </div>

      {hasParams && (
        <Card className="p-4 bg-base-100 border-base-300 shadow-sm rounded-2xl">
          <h3 className="text-[10px] font-black text-base-content/40 mb-4 uppercase tracking-widest">{t.parameters}</h3>
          <div className="space-y-2">
            {[...pathParams, ...queryParams, ...headerParams].map((p) => (
              <div
                key={`${p.in}-${p.name}`}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-base-200/50 transition-colors"
              >
                <span
                  className={`text-[9px] font-black uppercase w-12 text-center shrink-0 p-1 rounded border overflow-hidden ${
                    p.in === "path"
                      ? "text-warning bg-warning/10 border-warning/20"
                      : p.in === "header"
                        ? "text-info bg-info/10 border-info/20"
                        : "text-base-content/40 bg-base-200 border-base-300"
                  }`}
                >
                  {p.in}
                </span>
                <span
                  className="text-xs font-bold text-base-content w-40 shrink-0 truncate tracking-tight"
                  title={p.description ? `${p.name} — ${p.description}` : p.name}
                >
                  {p.name}
                  {p.required && <span className="text-error ml-0.5">*</span>}
                </span>
                <Input
                  className="flex-1 h-8 text-xs font-bold tracking-tight bg-base-200 border-transparent focus:bg-base-100"
                  placeholder={p.type}
                  aria-label={p.name}
                  value={paramValues[p.name] ?? ""}
                  onChange={(e) =>
                    updateForm({
                      paramValues: { ...paramValues, [p.name]: e.target.value },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {endpoint.requestBody && (
        <Card className="p-4 bg-base-100 border-base-300 shadow-sm rounded-2xl">
          <h3 className="text-[10px] font-black text-base-content/40 mb-3 uppercase tracking-widest flex items-center justify-between">
            {t.body}
            <span className="text-[9px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">
              {endpoint.requestBody.contentType}
            </span>
          </h3>
          <textarea
            className="w-full border border-base-300 rounded-xl px-4 py-3 text-xs font-mono bg-base-200/50 focus:ring-2 focus:ring-primary focus:bg-base-100 focus:border-transparent outline-none resize-y min-h-[120px] transition-all shadow-inner text-base-content"
            value={bodyText}
            onChange={(e) => updateForm({ bodyText: e.target.value })}
            spellCheck={false}
          />
        </Card>
      )}

      <div className="border border-base-300 rounded-2xl bg-base-100 overflow-hidden shadow-sm">
        <button
          type="button"
          className="flex items-center gap-3 w-full text-left px-4 py-3 text-[10px] font-black text-base-content/40 hover:text-base-content/80 hover:bg-base-200 transition-all uppercase tracking-widest"
          onClick={() => setHeadersOpen((o) => !o)}
        >
          {headersOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t.customHeaders}
          {headerText.trim() && (
            <span className="text-[9px] bg-primary text-primary-content px-2 py-0.5 rounded-full font-black animate-in zoom-in">
              {headerText.trim().split("\n").length}
            </span>
          )}
        </button>
        {headersOpen && (
          <div className="px-4 pb-4 animate-in slide-in-from-top-2">
            <textarea
              className="w-full border border-base-300 rounded-xl px-4 py-3 text-xs font-mono bg-base-200/50 focus:ring-2 focus:ring-primary focus:bg-base-100 focus:border-transparent outline-none resize-y min-h-[80px] transition-all shadow-inner text-base-content"
              placeholder={"Authorization: Bearer token\nAccept: application/json"}
              value={headerText}
              onChange={(e) => updateForm({ headerText: e.target.value })}
              spellCheck={false}
              rows={2}
            />
          </div>
        )}
      </div>

      {error && (
        <Card className="p-3 bg-red-50 border-red-200">
          <h3 className="text-xs font-bold text-red-700 mb-1">{t.error}</h3>
          <p className="text-xs text-red-600 font-mono whitespace-pre-wrap break-all">{error}</p>
        </Card>
      )}

      {response && (
        <Card className="p-5 bg-base-100 border-base-300 shadow-xl rounded-2xl animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3 mb-4 p-3 bg-base-200/50 rounded-xl border border-base-300/50">
            <Badge
              variant={{ color: getTextStatusColor(response.statusCode), size: "md" }}
              className="font-black tabular-nums scale-110"
            >
              {response.statusCode}
            </Badge>
            <span className="text-xs font-black text-base-content/40 uppercase tracking-widest tabular-nums">
              {response.elapsedMs}ms
            </span>
            <div className="flex-1" />
            <ResponseHeaders headers={response.headers} />
          </div>
          <div className="relative group/res">
            <pre className="text-xs font-mono bg-base-200/50 border border-base-300 rounded-xl p-4 overflow-auto max-h-[500px] whitespace-pre-wrap break-all shadow-inner text-base-content/90 selection:bg-primary/30">
              {formattedBody || t.empty}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}

function ResponseHeaders({ headers }: { headers: Record<string, string> }) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [open, setOpen] = useState(false);
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {t.headers(entries.length)}
      </button>
      {open && (
        <div className="mt-2 text-xs font-mono text-base-content/80 bg-base-200/80 backdrop-blur-sm rounded-xl p-3 border border-base-300 max-h-[250px] overflow-auto shadow-xl animate-in zoom-in-95 origin-top-right">
          {entries.map(([k, v]) => (
            <div key={k} className="py-1 border-b border-base-content/5 last:border-0 truncate">
              <span className="text-base-content/40 font-bold uppercase text-[9px] mr-2">{k}:</span> {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

function ApiSchemaPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [domains, setDomains] = useState<Domain[]>([]);
  const [links, setLinks] = useState<DomainApiLoggingLink[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDomainId, setSelectedDomainId] = useAtom(apiSchemaSelectedDomainIdAtom);

  const [schemaLoading, setSchemaLoading] = useState(false);
  const [parsedSpec, setParsedSpec] = useState<OpenApiSpec | null>(null);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [allEndpoints, setAllEndpoints] = useState<ParsedEndpoint[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const [search, setSearch] = useAtom(apiSchemaSearchAtom);
  const [selectedEndpoint, setSelectedEndpoint] = useAtom(apiSchemaSelectedEndpointAtom);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, lRes] = await Promise.all([
          commands.getDomains().then(unwrap),
          commands.getDomainApiLoggingLinks().then(unwrap),
        ]);
        if (dRes.success) {
          setDomains(dRes.data ?? []);
        }
        if (lRes.success) {
          setLinks(lRes.data ?? []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Domain map
  const domainMap = useMemo(() => {
    const m = new Map<number, Domain>();
    for (const d of domains) {
      m.set(d.id, d);
    }
    return m;
  }, [domains]);

  // Domains with schema URLs
  const schemaLinks = useMemo(() => links.filter((l) => l.schemaUrl), [links]);

  // Track domain change to prevent reset on remount
  const lastSelectedDomainRef = useRef<number | null>(selectedDomainId);

  // Load schema when domain selected
  useEffect(() => {
    if (selectedDomainId === null) {
      setParsedSpec(null);
      setTagGroups([]);
      setAllEndpoints([]);
      setParseError(null);
      setSelectedEndpoint(null);
      lastSelectedDomainRef.current = null;
      return;
    }

    // Reset ONLY if we're actually switching from one domain to ANOTHER
    const actuallyChanged =
      lastSelectedDomainRef.current !== null && lastSelectedDomainRef.current !== selectedDomainId;
    lastSelectedDomainRef.current = selectedDomainId;

    if (actuallyChanged) {
      setSelectedEndpoint(null);
      setSearch("");
    }

    (async () => {
      setSchemaLoading(true);
      setParseError(null);
      try {
        const res = await commands.getApiSchemaContent({ domainId: selectedDomainId }).then(unwrap);
        if (res.success && res.data) {
          const { spec, endpoints, tagGroups: tg } = parseOpenApiSpec(res.data);
          setParsedSpec(spec);
          setTagGroups(tg);
          setAllEndpoints(endpoints);
        } else {
          setParsedSpec(null);
          setTagGroups([]);
          setAllEndpoints([]);
          setParseError(t.noSchemaError);
        }
      } catch (e) {
        setParseError(t.parseFailedError(String(e)));
      } finally {
        setSchemaLoading(false);
      }
    })();
  }, [selectedDomainId, setSearch, setSelectedEndpoint, t]);

  // Derive base URL from domain
  const baseUrl = useMemo(() => {
    if (!selectedDomainId) {
      return "";
    }
    const domain = domainMap.get(selectedDomainId);
    if (!domain) {
      return "";
    }

    // domain.url may already include scheme (https://...) or be bare (api.example.com)
    const domainOrigin = domain.url.startsWith("http") ? domain.url : `https://${domain.url}`;

    // If spec has servers, use the first one
    if (parsedSpec?.servers?.[0]?.url) {
      const serverUrl = parsedSpec.servers[0].url;
      // Absolute URL → use as-is
      if (serverUrl.startsWith("http")) {
        return serverUrl;
      }
      // Relative path → prepend domain origin
      return `${domainOrigin.replace(/\/+$/, "")}${serverUrl}`;
    }
    return domainOrigin;
  }, [selectedDomainId, domainMap, parsedSpec]);

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-10rem)] overflow-hidden">
      {/* Header */}
      <header className="shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-secondary/10 text-secondary rounded-lg">
            <BookOpen className="w-5 h-5" />
          </div>
          <H1 className="text-3xl font-black tracking-tight text-base-content">{t.title}</H1>
        </div>
        <P className="text-base-content/60 text-sm font-medium">{t.subtitle}</P>
      </header>

      {/* Domain selector */}
      <Card className="p-1 items-center gap-2 flex flex-wrap bg-base-100 border-base-300 shadow-xl rounded-2xl mb-6 relative z-10">
        <div className="pl-4 pr-3 py-2 flex items-center gap-3 border-r border-base-300 shrink-0">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-xs font-black text-base-content/40 whitespace-nowrap hidden sm:inline-block uppercase tracking-widest">
            {t.targetApi}
          </span>
        </div>

        <div className="relative flex-1 min-w-[200px] group/sel">
          <select
            id="domain-select"
            className="appearance-none w-full bg-transparent border-none py-2.5 pl-3 pr-10 text-sm font-bold text-base-content focus:ring-0 cursor-pointer outline-none transition-all"
            value={selectedDomainId ?? ""}
            onChange={(e) => setSelectedDomainId(e.target.value ? Number(e.target.value) : null)}
            disabled={loading}
          >
            <option value="" className="bg-base-100">
              {t.selectDomain}
            </option>
            {schemaLinks.map((link) => {
              const domain = domainMap.get(link.domainId);
              return (
                <option key={link.domainId} value={link.domainId} className="bg-base-100">
                  {domain?.url ?? `Domain #${link.domainId}`}
                </option>
              );
            })}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30 pointer-events-none group-hover/sel:text-primary transition-colors" />
        </div>

        {schemaLoading ? (
          <div className="flex items-center gap-3 mr-5 p-2 px-4 bg-primary/5 text-primary rounded-xl text-xs font-black uppercase tracking-widest shadow-inner">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t.parsingSchema}
          </div>
        ) : (
          parsedSpec && (
            <div className="hidden md:flex items-center gap-4 mr-4 p-2 px-4 bg-primary/10 text-primary rounded-xl text-xs font-bold border border-primary/20 animate-in fade-in slide-in-from-right-4 shrink-0 shadow-sm">
              <span className="font-black uppercase tracking-tight">{parsedSpec.info.title}</span>
              <span className="w-px h-3 bg-primary/20" />
              <span className="font-mono tabular-nums">v{parsedSpec.info.version}</span>
              <span className="w-px h-3 bg-primary/20" />
              <span className="font-black uppercase tracking-tighter">{t.endpointsCount(allEndpoints.length)}</span>
            </div>
          )
        )}
      </Card>

      {/* Parse error */}
      {parseError && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">{parseError}</p>
        </Card>
      )}

      {/* Main content: 2 panel */}
      {parsedSpec && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left: endpoint list */}
          <Card className="w-80 shrink-0 bg-base-100 border-base-300 flex flex-col shadow-xl overflow-hidden min-h-0 rounded-2xl transition-all">
            <div className="p-4 border-b border-base-300 bg-base-200/50">
              <div className="relative group/sch">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within/sch:text-primary transition-colors" />
                <Input
                  className="pl-10 h-10 text-xs w-full bg-base-100 border-base-300 focus:border-primary/50 font-bold tracking-tight"
                  placeholder={t.searchEndpoints}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
              {tagGroups.map((g) => (
                <TagSection
                  key={g.tag}
                  group={g}
                  selected={selectedEndpoint}
                  onSelect={setSelectedEndpoint}
                  search={search}
                />
              ))}
            </div>
          </Card>

          {/* Right: detail + request form (independently scrollable) */}
          <div className="flex-1 overflow-y-auto">
            {selectedEndpoint && selectedDomainId ? (
              <EndpointDetail
                endpoint={selectedEndpoint}
                baseUrl={baseUrl}
                host={baseUrl.replace(/^https?:\/\//, "").split("/")[0]}
                domainId={selectedDomainId}
              />
            ) : (
              <Card className="p-12 flex flex-col items-center justify-center text-center min-h-[400px] bg-base-100 border-base-300 shadow-xl rounded-[2.5rem] animate-in fade-in zoom-in-95 duration-500">
                <BookOpen className="w-16 h-16 text-base-content/10 mb-6 drop-shadow-xl" />
                <p className="text-base-content/60 text-lg font-black tracking-tight uppercase">{t.selectEndpoint}</p>
                <p className="text-base-content/20 text-xs mt-2 font-black uppercase tracking-[0.2em]">
                  {t.endpointsInfo(allEndpoints.length, tagGroups.length)}
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Empty state when no domain selected */}
      {!parsedSpec && !schemaLoading && !parseError && (
        <Card className="flex-1 flex flex-col items-center justify-center text-center bg-base-100/50 backdrop-blur-sm border-base-300 shadow-2xl rounded-[3rem] animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="p-8 bg-primary/5 rounded-[2.5rem] mb-8 ring-1 ring-primary/10">
            <BookOpen className="w-24 h-24 text-primary/40" />
          </div>
          <p className="text-base-content/60 text-xl font-black tracking-tighter uppercase mb-2">
            {t.chooseDomainToStart}
          </p>
          {schemaLinks.length === 0 ? (
            <p className="text-base-content/20 text-xs font-black uppercase tracking-[0.2em] max-w-sm leading-relaxed">
              No domains with Schema URL found. Register them in the Dashboard first.
            </p>
          ) : (
            <p className="text-base-content/20 text-xs font-black uppercase tracking-[0.2em]">
              {t.registeredDomains(schemaLinks.length)} available
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
