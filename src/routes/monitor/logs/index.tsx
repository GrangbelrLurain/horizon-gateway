import { createFileRoute } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Hash,
  History,
  Info,
  Search,
  Server,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { languageAtom } from "@/entities/app";
import type { DomainStatusLog } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { Badge } from "@/shared/ui/badge/badge";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { LoadingScreen } from "@/shared/ui/loader/LoadingScreen";
import { Modal } from "@/shared/ui/modal/Modal";
import { en } from "./en";
import { ko } from "./ko";
import { monitorLogsDateAtom, monitorLogsLevelFilterAtom, monitorLogsSearchAtom } from "./store";

export const Route = createFileRoute("/monitor/logs/")({
  component: MonitorLogs,
});

function MonitorLogs() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [date, setDate] = useAtom(monitorLogsDateAtom);
  const [logs, setLogs] = useState<DomainStatusLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useAtom(monitorLogsSearchAtom);
  const [levelFilter, setLevelFilter] = useAtom(monitorLogsLevelFilterAtom);
  const [selectedLog, setSelectedLog] = useState<DomainStatusLog | null>(null);

  const LEVELS = [
    { id: "info", label: t.levelInfo },
    { id: "warning", label: t.levelWarning },
    { id: "error", label: t.levelError },
  ] as const;

  const toggleLevel = (level: string) => {
    setLevelFilter((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));
  };

  const fetchLogs = useCallback(async (targetDate: string) => {
    setLoading(true);
    try {
      const response = await commands.getDomainStatusLogs({ date: targetDate }).then(unwrap);
      if (response.success) {
        setLogs(response.data.reverse());
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(date);
  }, [date, fetchLogs]);

  const changeDate = (days: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    setDate(newDate.toISOString().split("T")[0]);
  };

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(
        (log) => log.url.toLowerCase().includes(lowerSearch) || log.group.toLowerCase().includes(lowerSearch),
      );
    }
    if (levelFilter.length > 0) {
      result = result.filter((log) => levelFilter.includes(log.level));
    }
    return result;
  }, [logs, search, levelFilter]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  return (
    <div className="flex flex-col gap-6 pb-20">
      <AnimatePresence>
        {loading && logs.length === 0 && <LoadingScreen key="logs-loader" onCancel={() => setLoading(false)} />}
      </AnimatePresence>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-base-content">{t.title}</h1>
          </div>
          <p className="text-base-content/60 text-sm">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 bg-base-100 p-1 rounded-xl border border-base-200 shadow-sm">
          <Button variant="secondary" size="icon" onClick={() => changeDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 px-3">
            <Calendar className="w-4 h-4 text-base-content/40" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm font-bold text-base-content/80 outline-none bg-transparent"
            />
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => changeDate(1)}
            disabled={date === new Date().toISOString().split("T")[0]}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <Card className="p-4 bg-base-100/50 backdrop-blur-sm border-base-200 flex-1 shadow-sm">
          <div className="flex items-center gap-3">
            <Search className="w-4 h-4 text-base-content/40 shrink-0" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              className="bg-transparent border-none outline-none text-sm w-full font-medium min-w-0 text-base-content placeholder:text-base-content/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </Card>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-base-content/50 shrink-0">{t.level}:</span>
          <Button
            variant={levelFilter.length === 0 ? "primary" : "secondary"}
            size="sm"
            onClick={() => setLevelFilter([])}
          >
            {t.all}
          </Button>
          {LEVELS.map(({ id, label }) => (
            <Button
              key={id}
              variant={levelFilter.includes(id) ? "primary" : "secondary"}
              size="sm"
              onClick={() => toggleLevel(id)}
              className={
                levelFilter.includes(id)
                  ? id === "error"
                    ? "bg-red-600 hover:bg-red-700"
                    : id === "warning"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : id === "info"
                        ? "bg-green-600 hover:bg-green-700"
                        : ""
                  : ""
              }
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div
        ref={parentRef}
        className="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-auto max-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-base-300 relative"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 opacity-40 text-base-content">
            <FileText className="w-10 h-10" />
            <p className="text-sm font-medium">{t.noLogs}</p>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-20 flex items-center bg-base-200 border-b border-base-300 px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 w-[120px] text-center">
                {t.tableTime}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 w-[200px] grow text-center">
                {t.tableDomain}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 w-[100px] text-center">
                {t.tableStatus}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 w-[300px] text-center">
                {t.tableMessage}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 w-[100px] text-center">
                {t.tableLatency}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 w-[100px] text-center">
                {t.tableLevel}
              </div>
            </div>
            <div className="relative w-full min-w-[1000px]" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const log = filteredLogs[virtualRow.index];
                return (
                  <button
                    type="button"
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute top-0 left-0 w-full flex items-center px-6 py-4 hover:bg-base-200 transition-all border-b border-base-200 cursor-pointer group/row outline-none focus-visible:bg-primary/10 focus-visible:ring-1 focus-visible:ring-primary/20"
                    onClick={() => setSelectedLog(log)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedLog(log);
                      }
                    }}
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="text-xs font-mono text-base-content/40 whitespace-nowrap w-[120px] text-center">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour12: false,
                      })}
                    </div>
                    <div className="flex flex-col min-w-0 pr-4 w-[200px] grow text-center">
                      <span className="text-sm font-bold text-base-content/80 truncate block" title={log.url}>
                        {log.url}
                      </span>
                      <span className="text-[10px] text-base-content/40 font-medium truncate block">{log.group}</span>
                    </div>
                    <div className="min-w-0 pr-4 w-[100px] text-center">
                      <span
                        className={clsx("text-xs font-bold truncate block", log.ok ? "text-success" : "text-error")}
                        title={log.status}
                      >
                        {log.status}
                      </span>
                    </div>
                    <div className="min-w-0 pr-4 w-[300px]">
                      <span
                        className="text-[11px] text-base-content/50 font-medium truncate block"
                        title={log.errorMessage ?? undefined}
                      >
                        {log.errorMessage || "-"}
                      </span>
                    </div>
                    <div className="text-sm font-black text-base-content/80 tabular-nums whitespace-nowrap w-[100px] text-center">
                      {log.latency}ms
                    </div>
                    <div className="flex justify-center w-[100px] text-center">
                      <Badge
                        variant={{
                          color: log.level === "error" ? "red" : log.level === "warning" ? "amber" : "green",
                        }}
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)}>
        <Modal.Header title={t.modalTitle} description={t.modalDesc} />
        <Modal.Body className="flex flex-col gap-6 py-6 font-sans">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-base-200 rounded-2xl flex flex-col gap-1">
              <div className="flex items-center gap-2 text-base-content/30 mb-1">
                <Globe className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t.targetDomain}</span>
              </div>
              <span className="text-sm font-black text-base-content/80 break-all">{selectedLog?.url}</span>
            </div>

            <div className="p-4 bg-base-200 rounded-2xl flex flex-col gap-1">
              <div className="flex items-center gap-2 text-base-content/30 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t.timestamp}</span>
              </div>
              <span className="text-sm font-black text-base-content/80">
                {selectedLog && new Date(selectedLog.timestamp).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-base-200 rounded-2xl flex flex-col items-center text-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/30">
                {t.tableStatus}
              </span>
              <span className={clsx("text-base font-black", selectedLog?.ok ? "text-success" : "text-error")}>
                {selectedLog?.status}
              </span>
            </div>
            <div className="p-4 bg-base-200 rounded-2xl flex flex-col items-center text-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/30">
                {t.tableLatency}
              </span>
              <span className="text-base font-black text-base-content/80 tracking-tight">{selectedLog?.latency}ms</span>
            </div>
            <div className="p-4 bg-base-200 rounded-2xl flex flex-col items-center text-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.tableLevel}</span>
              <Badge
                variant={{
                  color: selectedLog?.level === "error" ? "red" : selectedLog?.level === "warning" ? "amber" : "green",
                }}
              >
                {selectedLog?.level?.toUpperCase() || ""}
              </Badge>
            </div>
          </div>

          <div className="p-4 bg-info/10 border border-info/20 rounded-2xl flex flex-col gap-2 shadow-inner">
            <div className="flex items-center gap-2 text-info">
              <Info className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t.systemMessage}</span>
            </div>
            <p className="text-sm font-medium text-base-content/70 leading-relaxed font-mono">
              {selectedLog?.errorMessage || t.noSystemMessage}
            </p>
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-base-content/20" />
              <span className="text-xs font-bold text-base-content/30">{selectedLog?.group}</span>
            </div>
            <div className="flex items-center gap-1 text-base-content/20">
              <Hash className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono">
                #{selectedLog ? Math.abs(new Date(selectedLog.timestamp).getTime() % 10000) : "0000"}
              </span>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSelectedLog(null)} className="rounded-xl px-6">
            {t.closePanel}
          </Button>
          <Button
            onClick={() =>
              selectedLog &&
              window.open(selectedLog.url.startsWith("http") ? selectedLog.url : `https://${selectedLog.url}`, "_blank")
            }
            className="rounded-xl px-6 shadow-xl shadow-blue-500/20"
          >
            {t.openUrl}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
