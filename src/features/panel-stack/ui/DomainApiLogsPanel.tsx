import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { languageAtom, usePromiseModal } from "@/entities/app";
import {
  ApiLogsBulkExportBar,
  apiLogEntryToCopyInput,
  downloadApiExchangesHtml,
  revealDownloadedApiExchangesHtml,
} from "@/entities/sandbox";
import type { ApiLogEntry, Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { offerRevealSavedDownload } from "@/shared/lib/tauri/offerRevealSavedDownload";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { LoadingScreen } from "@/shared/ui/loader/LoadingScreen";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { domainApiLogsMethodAtom, domainApiLogsSearchAtom } from "../store";
import { Panel } from "./Panel";

interface DomainApiLogsPanelProps {
  domain: Domain;
  onClose: () => void;
  onSelectLog: (logId: string) => void;
  selectedLogId?: string;
}

const METHODS = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

export function DomainApiLogsPanel({ domain, onClose, onSelectLog, selectedLogId }: DomainApiLogsPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const { show: showModal } = usePromiseModal();
  const { getDomainHost } = useDomainHubData();
  const host = getDomainHost(domain);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useAtom(domainApiLogsSearchAtom);
  const [methodFilter, setMethodFilter] = useAtom(domainApiLogsMethodAtom);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(() => new Set());
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await commands
        .getApiLogs({ date: today, domainFilter: host, methodFilter: null, hostFilter: null, exactMatch: null })
        .then(unwrap);
      if (res.success && res.data) {
        setLogs(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    void fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((entry) => {
      if (methodFilter !== "ALL" && entry.method.toUpperCase() !== methodFilter) {
        return false;
      }
      if (q && !entry.path.toLowerCase().includes(q) && !entry.url.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [logs, search, methodFilter]);

  const hasFilters = search.trim().length > 0 || methodFilter !== "ALL";

  const copyFieldLabels = useMemo(
    () => ({
      requestHeaders: t.apiLogRequestHeaders,
      requestBody: t.apiLogRequestBody,
      responseHeaders: t.apiLogResponseHeaders,
      responseBody: t.apiLogResponseBody,
    }),
    [t],
  );

  const handleToggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedLogIds(new Set(filteredLogs.map((log) => log.id)));
  }, [filteredLogs]);

  const handleClearSelection = useCallback(() => {
    setSelectedLogIds(new Set());
  }, []);

  const handleOpenSavedFolder = useCallback(async () => {
    if (!lastSavedPath) {
      return;
    }
    try {
      await revealDownloadedApiExchangesHtml(lastSavedPath);
    } catch (e) {
      console.error("revealDownloadedApiExchangesHtml:", e);
    }
  }, [lastSavedPath]);

  const handleDownloadSelectedHtml = useCallback(async () => {
    const selected = filteredLogs.filter((log) => selectedLogIds.has(log.id));
    if (selected.length === 0) {
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const inputs = selected.map((log) => apiLogEntryToCopyInput(log, copyFieldLabels));
    try {
      const result = await downloadApiExchangesHtml(
        inputs,
        {
          ...copyFieldLabels,
          documentTitle: t.apiLogsExportDocumentTitle,
          exportedAt: t.apiLogsExportExportedAt,
          entryCount: t.apiLogsExportEntryCount,
          tableOfContents: t.apiLogsExportTableOfContents,
          copyResponse: t.apiLogsExportCopyResponse,
          copyRequest: t.apiLogsExportCopyRequest,
          copyExchange: t.apiLogsExportCopyExchange,
          copyAllResponses: t.apiLogsExportCopyAllResponses,
          copied: t.apiLogCopied,
          generatedBy: t.apiLogsExportGeneratedBy,
          jumpToEntry: t.apiLogsExportJumpToEntry,
        },
        `horizon-gateway-api-logs-${host}-${today}-${selected.length}.html`,
      );
      if (result.status !== "saved") {
        return;
      }
      setLastSavedPath(result.path);
      await offerRevealSavedDownload({
        path: result.path,
        title: t.apiLogsDownloadComplete,
        message: t.apiLogsDownloadCompleteMessage(result.path),
        openFolderText: t.apiLogsOpenFolder,
        closeText: lang === "ko" ? "닫기" : "Close",
        show: showModal,
      });
    } catch (e) {
      console.error("downloadApiExchangesHtml:", e);
    }
  }, [copyFieldLabels, filteredLogs, host, lang, selectedLogIds, showModal, t]);

  const allFilteredSelected = filteredLogs.length > 0 && filteredLogs.every((log) => selectedLogIds.has(log.id));
  const someFilteredSelected = filteredLogs.some((log) => selectedLogIds.has(log.id));

  return (
    <Panel id="api/logs" title={t.apiLogs} subtitle={host} onClose={onClose} width="lg">
      <div className="flex flex-col gap-2 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/30" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.apiLogsSearchPlaceholder}
              className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => void fetchLogs()}
            disabled={loading}
            title={t.apiLogsRefresh}
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setMethodFilter(method)}
              className={clsx(
                "px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap shrink-0",
                methodFilter === method
                  ? "bg-primary/20 text-primary"
                  : "bg-base-200 text-base-content/50 hover:bg-base-300",
              )}
            >
              {method}
            </button>
          ))}
        </div>
        {hasFilters && (
          <p className="text-[10px] text-base-content/40 px-0.5">
            {filteredLogs.length}/{logs.length}
          </p>
        )}
        <ApiLogsBulkExportBar
          selectedCount={selectedLogIds.size}
          totalCount={filteredLogs.length}
          labels={{
            selected: t.apiLogsBulkSelected,
            selectAll: t.apiLogsBulkSelectAll,
            clearSelection: t.apiLogsBulkClearSelection,
            downloadHtml: t.apiLogsBulkDownloadHtml,
            openFolder: t.apiLogsOpenFolder,
            downloadComplete: t.apiLogsDownloadComplete,
          }}
          onSelectAll={handleSelectAllFiltered}
          onClearSelection={handleClearSelection}
          onDownloadHtml={() => void handleDownloadSelectedHtml()}
          lastSavedPath={lastSavedPath}
          onOpenFolder={() => void handleOpenSavedFolder()}
        />
      </div>

      {loading && logs.length === 0 ? (
        <LoadingScreen />
      ) : logs.length === 0 ? (
        <p className="text-xs text-base-content/50">{t.apiNoLogs}</p>
      ) : filteredLogs.length === 0 ? (
        <p className="text-xs text-base-content/50">{t.apiLogsNoMatch}</p>
      ) : (
        <div className="space-y-1 overflow-y-auto min-h-0 flex-1">
          <div className="flex items-center gap-2 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-base-content/35">
            <input
              type="checkbox"
              className="checkbox checkbox-xs checkbox-primary"
              checked={allFilteredSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = someFilteredSelected && !allFilteredSelected;
                }
              }}
              onChange={(e) => {
                if (e.target.checked) {
                  handleSelectAllFiltered();
                } else {
                  handleClearSelection();
                }
              }}
              aria-label={t.apiLogsBulkSelectAll}
            />
            <span>{t.apiLogsBulkSelectAll}</span>
          </div>
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className={clsx(
                "w-full flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors",
                selectedLogId === log.id ? "bg-primary/10 border-primary/30" : "border-transparent hover:bg-base-200",
              )}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-xs checkbox-primary shrink-0"
                checked={selectedLogIds.has(log.id)}
                onChange={(e) => handleToggleSelect(log.id, e.target.checked)}
                aria-label={`Select ${log.method} ${log.path}`}
              />
              <button
                type="button"
                onClick={() => onSelectLog(log.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span className="text-[9px] font-black bg-base-300 px-1.5 py-0.5 rounded shrink-0">{log.method}</span>
                <span className="text-[10px] font-mono truncate flex-1">{log.path}</span>
                <span
                  className={clsx(
                    "text-[9px] font-bold shrink-0",
                    (log.status_code ?? 0) >= 400 ? "text-error" : "text-success",
                  )}
                >
                  {log.status_code ?? "-"}
                </span>
                <span className="text-[9px] text-base-content/30 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
