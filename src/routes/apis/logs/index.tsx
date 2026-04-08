import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  FlaskConical,
  GlobeIcon,
  History,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiLoggingCountAtom, domainCountAtom } from "@/domain/app-status/store";
import { languageAtom } from "@/domain/i18n/store";
import type { ApiLogEntry } from "@/entities/proxy/types/local_route";
import type { Scenario } from "@/entities/scenario/types/mocking";
import { invokeApi } from "@/shared/api";
import * as mockingApi from "@/shared/api/mocking";
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
  const [hostFilter, setHostFilter] = useAtom(apiLogsHostFilterAtom);
  const [methodFilter, setMethodFilter] = useAtom(apiLogsMethodFilterAtom);
  const [selectedLog, setSelectedLog] = useState<ApiLogEntry | null>(null);
  const [clearing, setClearing] = useState(false);
  const domainCount = useAtomValue(domainCountAtom);
  const apiLoggingCount = useAtomValue(apiLoggingCountAtom);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isScenarioSelectModalOpen, setIsScenarioSelectModalOpen] = useState(false);
  const [selectedScenarioIdForMock, setSelectedScenarioIdForMock] = useState<string>("");
  const [mockForm, setMockForm] = useState({
    host: "",
    method: "GET",
    urlPattern: "",
    responseStatus: 200,
  });

  // 날짜 목록 조회
  const fetchDates = useCallback(async () => {
    try {
      const res = await invokeApi("list_api_log_dates");
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
        const res = await invokeApi("get_api_logs", {
          payload: {
            date: targetDate,
            domainFilter: search.trim() || undefined,
            methodFilter: methodFilter || undefined,
            hostFilter: hostFilter.trim() || undefined,
          },
        });
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
    mockingApi.getScenarios().then(setScenarios).catch(console.error);
  }, [fetchDates]);

  useEffect(() => {
    fetchLogs(date);
    // 폴링 대신 수동 새로고침 버튼을 두거나, 필요시 5초 주기 폴링 추가 가능
    const interval = setInterval(() => fetchLogs(date), 5000);
    return () => clearInterval(interval);
  }, [date, fetchLogs]);

  const changeDate = (days: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    setDate(newDate.toISOString().split("T")[0]);
  };

  const handleSaveAsMockRule = async () => {
    if (!selectedLog || !selectedScenarioIdForMock) {
      return;
    }
    try {
      await mockingApi.createMockRule(
        selectedScenarioIdForMock,
        mockForm.host || null,
        mockForm.method,
        mockForm.urlPattern,
        Number(mockForm.responseStatus),
        selectedLog.response_headers || {},
        selectedLog.response_body || "",
        true,
      );
      alert("Mock rule created successfully.");
      setIsScenarioSelectModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to create mock rule.");
    }
  };

  const handleClearLogs = async (clearAll: boolean) => {
    if (!confirm(clearAll ? t.clearAllConfirm : t.clearConfirm(date))) {
      return;
    }
    setClearing(true);
    try {
      await invokeApi("clear_api_logs", {
        payload: clearAll ? { date: undefined } : { date },
      });
      setLogs([]);
      await fetchDates();
    } catch (e) {
      console.error("clear_api_logs:", e);
    } finally {
      setClearing(false);
    }
  };

  const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

  return (
    <div className="flex flex-col gap-6 pb-20 h-[calc(100vh-6rem)] overflow-hidden">
      <AnimatePresence>
        {loading && logs.length === 0 && <LoadingScreen key="logs-loader" onCancel={() => setLoading(false)} />}
      </AnimatePresence>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-secondary/10 text-secondary rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-base-content">{t.title}</h1>
          </div>
          <p className="text-base-content/60 text-sm font-medium">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchLogs(date)}
            disabled={loading}
            className="flex items-center gap-2 h-10 px-4 whitespace-nowrap shrink-0"
          >
            <History className={clsx("w-4 h-4", loading && "animate-spin")} />
            {t.refresh}
          </Button>

          {/* Date Navigator */}
          <div className="flex items-center gap-2 bg-base-100 p-1 rounded-xl border border-base-300 shadow-sm h-10">
            <Button variant="secondary" size="icon" onClick={() => changeDate(-1)} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-3">
              <Calendar className="w-4 h-4 text-base-content/40" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-sm font-bold text-base-content outline-none bg-transparent w-[110px]"
              />
            </div>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => changeDate(1)}
              disabled={date === new Date().toISOString().split("T")[0]}
              className="h-8 w-8"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-3 shrink-0">
        <div className="flex flex-1 gap-3">
          <Card className="p-2 bg-base-100 border-base-300 flex-1 flex items-center gap-3 px-4 shadow-sm">
            <Search className="w-4 h-4 text-base-content/40 shrink-0" />
            <input
              type="text"
              placeholder={t.filterPath}
              className="bg-transparent border-none outline-none text-sm w-full font-bold min-w-0 placeholder:text-base-content/30 text-base-content"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-base-content/40 hover:text-base-content/80 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </Card>

          <Card className="p-2 bg-base-100 border-base-300 flex-1 flex items-center gap-3 px-4 shadow-sm">
            <GlobeIcon className="w-4 h-4 text-base-content/40 shrink-0" />
            <input
              type="text"
              placeholder={t.filterHost}
              className="bg-transparent border-none outline-none text-sm w-full font-bold min-w-0 placeholder:text-base-content/30 text-base-content"
              value={hostFilter}
              onChange={(e) => setHostFilter(e.target.value)}
            />
            {hostFilter && (
              <button
                type="button"
                onClick={() => setHostFilter("")}
                className="text-base-content/40 hover:text-base-content/80 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </Card>
        </div>

        <div className="flex items-center gap-2 bg-base-100 rounded-xl border border-base-300 p-1 shadow-sm">
          <Button
            variant={methodFilter === "" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setMethodFilter("")}
            className="font-black text-[10px] uppercase tracking-tighter h-8"
          >
            {t.allMethods}
          </Button>
          <div className="w-px h-4 bg-base-300 mx-1" />
          {METHODS.map((m) => (
            <Button
              key={m}
              variant={methodFilter === m ? "primary" : "ghost"}
              size="sm"
              onClick={() => setMethodFilter(methodFilter === m ? "" : m)}
              className="font-black text-[10px] h-8 px-3 uppercase tracking-tighter"
            >
              {m}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2 h-auto whitespace-nowrap shrink-0"
            onClick={() => handleClearLogs(false)}
            disabled={clearing || logs.length === 0}
          >
            <Trash2 className="w-4 h-4" />
            {t.clearDate(date)}
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="flex items-center gap-2 h-auto whitespace-nowrap shrink-0"
            onClick={() => handleClearLogs(true)}
            disabled={clearing}
          >
            <Trash2 className="w-4 h-4" />
            {t.clearAll}
          </Button>
        </div>
      </div>

      {/* Log List */}
      <div className="bg-base-100 rounded-2xl border border-base-300 shadow-xl overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="grid grid-cols-[80px_60px_1fr_120px] gap-4 px-6 py-3 bg-base-200/50 border-b border-base-300 text-[10px] font-black text-base-content/40 uppercase tracking-widest shrink-0">
          <div>{t.status}</div>
          <div>{t.method}</div>
          <div>{t.urlPath}</div>
          <div className="text-right">{t.time}</div>
        </div>

        <div className="overflow-y-auto flex-1 p-0">
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
            <div className="divide-y divide-base-300/50">
              {logs.map((log) => (
                <button
                  type="button"
                  key={log.id}
                  className="w-full grid grid-cols-[80px_60px_1fr_120px] gap-4 items-center px-6 py-3 hover:bg-base-200/50 transition-all text-left group border-l-4 border-l-transparent hover:border-l-primary"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex">
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
                      className="font-black w-[50px] justify-center tracking-tighter"
                    >
                      {log.status_code ?? "-"}
                    </Badge>
                  </div>
                  <span
                    className={`font-black text-[10px] uppercase tracking-tighter ${
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
                      className="text-sm font-bold text-base-content/80 truncate font-mono tracking-tight"
                      title={log.url}
                    >
                      {log.path}
                    </span>
                    <span className="text-[10px] text-base-content/40 font-bold uppercase truncate tracking-wider">
                      {log.host}
                    </span>
                  </div>

                  <span className="text-xs text-base-content/40 font-mono text-right tabular-nums group-hover:text-base-content/80 transition-colors">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log Detail Modal */}
      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)}>
        <Modal.Header title={t.logDetails} description={selectedLog?.id} />
        <Modal.Body className="flex flex-col gap-6 py-4 max-h-[70vh] overflow-y-auto px-6">
          {selectedLog && (
            <>
              {/* Summary */}
              <div className="flex flex-col gap-3 p-5 bg-base-200/50 rounded-2xl border border-base-300 shadow-inner relative">
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-4 right-4"
                  onClick={() => {
                    if (scenarios.length > 0) {
                      setSelectedScenarioIdForMock(scenarios[0].id);
                    }
                    setMockForm({
                      host: selectedLog.host || "",
                      method: selectedLog.method || "GET",
                      urlPattern: selectedLog.path || "/",
                      responseStatus: selectedLog.status_code || 200,
                    });
                    setIsScenarioSelectModalOpen(true);
                  }}
                >
                  <FlaskConical className="w-4 h-4 mr-2" />
                  Save as Mock
                </Button>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={{ color: "slate", size: "sm" }}
                    className="font-black bg-base-300 text-base-content/80"
                  >
                    {selectedLog.method}
                  </Badge>
                  <span className="font-mono text-sm font-bold text-base-content break-all leading-tight">
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
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.requestHeaders}</h3>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <tbody>
                        {Object.entries(selectedLog.request_headers).map(([k, v]) => (
                          <tr key={k}>
                            <td className="text-slate-500 pr-3 py-0.5 select-all whitespace-nowrap align-top">{k}:</td>
                            <td className="text-slate-800 py-0.5 select-all break-all">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Request Body */}
              {selectedLog.request_body && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.requestBody}</h3>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 overflow-x-auto max-h-48 relative group">
                    <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-all">
                      {selectedLog.request_body}
                    </pre>
                  </div>
                </div>
              )}

              {/* Response Headers */}
              {selectedLog.response_headers && Object.keys(selectedLog.response_headers).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 border-t border-slate-100 pt-4 mt-2">
                    {t.responseHeaders}
                  </h3>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <tbody>
                        {Object.entries(selectedLog.response_headers).map(([k, v]) => (
                          <tr key={k}>
                            <td className="text-slate-500 pr-3 py-0.5 select-all whitespace-nowrap align-top">{k}:</td>
                            <td className="text-slate-800 py-0.5 select-all break-all">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Response Body */}
              {selectedLog.response_body && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.responseBody}</h3>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 overflow-x-auto max-h-60">
                    <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-all">
                      {selectedLog.response_body}
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

      {/* Scenario Selection Modal for Mock Rule */}
      <Modal isOpen={isScenarioSelectModalOpen} onClose={() => setIsScenarioSelectModalOpen(false)}>
        <Modal.Header title="Save as Mock Rule" description="Select a scenario to save this mock rule to" />
        <Modal.Body className="flex flex-col gap-4 py-4">
          {scenarios.length === 0 ? (
            <p className="text-sm text-base-content/50">
              No scenarios available. Please create one in the Mocking dashboard first.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="scenario-select" className="text-xs font-bold uppercase">
                  Select Scenario
                </label>
                <select
                  id="scenario-select"
                  className="select select-bordered border-base-300 w-full font-bold bg-base-100/50"
                  value={selectedScenarioIdForMock}
                  onChange={(e) => setSelectedScenarioIdForMock(e.target.value)}
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col gap-1 w-1/3">
                  <label htmlFor="mock-method" className="text-xs font-bold uppercase">
                    Method
                  </label>
                  <select
                    id="mock-method"
                    className="select select-bordered border-base-300 w-full font-bold bg-base-100/50"
                    value={mockForm.method}
                    onChange={(e) => setMockForm((prev) => ({ ...prev, method: e.target.value }))}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 w-2/3">
                  <label htmlFor="mock-status" className="text-xs font-bold uppercase">
                    Status Code
                  </label>
                  <input
                    id="mock-status"
                    type="number"
                    className="input input-bordered border-base-300 w-full font-bold bg-base-100/50 tabular-nums"
                    value={mockForm.responseStatus}
                    onChange={(e) => setMockForm((prev) => ({ ...prev, responseStatus: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="mock-host" className="text-xs font-bold uppercase">
                  {t.host}
                </label>
                <input
                  id="mock-host"
                  type="text"
                  className="input input-bordered border-base-300 w-full font-mono text-sm bg-base-100/50"
                  placeholder="Domain (optional)"
                  value={mockForm.host}
                  onChange={(e) => setMockForm((prev) => ({ ...prev, host: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="mock-url" className="text-xs font-bold uppercase">
                  {t.urlPattern}
                </label>
                <input
                  id="mock-url"
                  type="text"
                  className="input input-bordered border-base-300 w-full font-mono text-sm bg-base-100/50"
                  value={mockForm.urlPattern}
                  onChange={(e) => setMockForm((prev) => ({ ...prev, urlPattern: e.target.value }))}
                />
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setIsScenarioSelectModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveAsMockRule}
            disabled={scenarios.length === 0 || !selectedScenarioIdForMock}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
