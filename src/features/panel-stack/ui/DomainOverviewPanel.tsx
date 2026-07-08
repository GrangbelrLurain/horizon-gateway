import clsx from "clsx";
import { useAtomValue } from "jotai";
import {
  Activity,
  ArrowRight,
  Bug,
  Camera,
  ChevronRight,
  FileText,
  FlaskConical,
  History,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import { ProxyRouteModal } from "@/entities/domain";
import { openPopupWindow } from "@/features/popup-window";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { openDetachedWindow } from "@/shared/lib/tauri/openDetachedWindow";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import type { PanelId } from "../types";
import { Panel } from "./Panel";

interface DomainOverviewPanelProps {
  domain: Domain;
  onClose: () => void;
  onOpenPanel: (id: PanelId, params?: Record<string, string>) => void;
  activePanelIds?: PanelId[];
}

export function DomainOverviewPanel({ domain, onClose, onOpenPanel, activePanelIds = [] }: DomainOverviewPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const { getFeatureState, getGroupName, getProxyRoute, proxyActive, fetchAll } = useDomainHubData();
  const featureState = getFeatureState(domain.id);
  const toggles = useDomainFeatureToggles({
    domainId: domain.id,
    domainUrl: domain.url,
    state: featureState,
    proxyActive,
    onRefresh: fetchAll,
  });
  const [recentLogs, setRecentLogs] = useState<{ id: string; method: string; path: string; status: number }[]>([]);
  const [status, setStatus] = useState<{ level: string; message: string; timestamp: string } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const [targetHost, setTargetHost] = useState("localhost");
  const [targetPort, setTargetPort] = useState("3000");
  const [savingProxy, setSavingProxy] = useState(false);

  let displayHost = domain.url;
  try {
    const u = new URL(domain.url.startsWith("http") ? domain.url : `https://${domain.url}`);
    displayHost = u.hostname;
  } catch {
    // keep
  }

  const route = getProxyRoute(domain);

  useEffect(() => {
    if (route) {
      setTargetHost(route.targetHost);
      setTargetPort(String(route.targetPort));
    }
  }, [route]);

  const handleAddRoute = async () => {
    const port = Number(targetPort);
    if (!targetHost.trim() || Number.isNaN(port)) {
      return;
    }
    setSavingProxy(true);
    try {
      await commands
        .addLocalRoute({ domainId: domain.id, targetHost: targetHost.trim(), targetPort: port })
        .then(unwrap);
      await fetchAll();
      await notifyHubDataChanged("routes");
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProxy(false);
    }
  };

  const handleUpdateRoute = async () => {
    if (!route) {
      return;
    }
    const port = Number(targetPort);
    if (!targetHost.trim() || Number.isNaN(port)) {
      return;
    }
    setSavingProxy(true);
    try {
      await commands
        .updateLocalRoute({
          id: route.id,
          targetHost: targetHost.trim(),
          targetPort: port,
          enabled: null,
        })
        .then(unwrap);
      await fetchAll();
      await notifyHubDataChanged("routes");
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProxy(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (!route) {
      return;
    }
    setSavingProxy(true);
    try {
      await commands.removeLocalRoute({ id: route.id }).then(unwrap);
      setTargetHost("localhost");
      setTargetPort("3000");
      await fetchAll();
      await notifyHubDataChanged("routes");
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProxy(false);
    }
  };

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await commands.getLatestStatus().then(unwrap);
      if (res.success && res.data) {
        const match = res.data.find((s) => s.url.toLowerCase().includes(displayHost));
        if (match) {
          setStatus({
            level: match.level,
            message: match.errorMessage ?? match.status,
            timestamp: match.timestamp,
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatus(false);
    }
  }, [displayHost]);

  useEffect(() => {
    if (!toggles.monitor.checked) {
      return;
    }
    void fetchStatus();
  }, [toggles.monitor.checked, fetchStatus]);

  useEffect(() => {
    if (!toggles.api.checked) {
      setRecentLogs([]);
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    commands
      .getApiLogs({ date: today, domainFilter: displayHost, methodFilter: null, hostFilter: null, exactMatch: null })
      .then(unwrap)
      .then((res) => {
        if (res.success && res.data) {
          setRecentLogs(
            res.data.slice(0, 3).map((l) => ({
              id: l.id,
              method: l.method,
              path: l.path,
              status: l.status_code ?? 0,
            })),
          );
        }
      })
      .catch(console.error);
  }, [displayHost, toggles.api.checked]);

  const activeFeatures = useMemo(() => {
    const list = [];
    if (toggles.api.checked) {
      list.push("api");
    }
    if (toggles.monitor.checked) {
      list.push("monitor");
    }
    if (toggles.proxy.checked) {
      list.push("proxy");
    }
    return list;
  }, [toggles.api.checked, toggles.monitor.checked, toggles.proxy.checked]);

  const inactiveFeatures = useMemo(() => {
    const list = [];
    if (!toggles.api.checked) {
      list.push("api");
    }
    if (!toggles.monitor.checked) {
      list.push("monitor");
    }
    if (!toggles.proxy.checked) {
      list.push("proxy");
    }
    return list;
  }, [toggles.api.checked, toggles.monitor.checked, toggles.proxy.checked]);

  const renderFeatureCard = (key: string, isActive: boolean) => {
    switch (key) {
      case "api":
        return (
          <div key="api" className={clsx("transition-all space-y-3 py-1", !isActive && "opacity-60 hover:opacity-80")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    isActive ? "bg-base-200 text-base-content/50" : "bg-base-300/50 text-base-content/30",
                  )}
                >
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-base-content">{t.api}</span>
                    {!isActive && (
                      <span className="text-[8px] font-bold text-base-content/30 bg-base-300 px-1 py-0.5 rounded">
                        OFF
                      </span>
                    )}
                  </div>
                  {!isActive && <p className="text-[10px] text-base-content/40 mt-0.5">{t.apiEnableHint}</p>}
                </div>
              </div>
              {toggles.api.loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              ) : (
                <input
                  type="checkbox"
                  className="toggle toggle-success toggle-sm shrink-0"
                  checked={toggles.api.checked}
                  onChange={(e) => toggles.api.toggle(e.target.checked)}
                />
              )}
            </div>

            {isActive && (
              <div className="pl-11 space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs py-1 px-2">
                  <span className="text-base-content/70">{t.apiBodyLogging}</span>
                  {toggles.api.bodyLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  ) : (
                    <input
                      type="checkbox"
                      className="toggle toggle-success toggle-xs"
                      checked={toggles.api.bodyChecked ?? false}
                      onChange={(e) => toggles.api.toggleBody(e.target.checked)}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenPanel("api/logs")}
                    className={clsx(
                      "w-full flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors text-xs text-left",
                      activePanelIds.includes("api/logs") ? "bg-primary/15 text-primary" : "hover:bg-base-200/60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <History
                        className={clsx(
                          "w-3.5 h-3.5",
                          activePanelIds.includes("api/logs") ? "text-primary" : "text-base-content/50",
                        )}
                      />
                      <span className="font-bold">{t.apiLogs}</span>
                    </div>
                    <ChevronRight
                      className={clsx(
                        "w-3.5 h-3.5",
                        activePanelIds.includes("api/logs") ? "text-primary/70" : "text-base-content/30",
                      )}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenPanel("api/mocking")}
                    className={clsx(
                      "w-full flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors text-xs text-left",
                      activePanelIds.includes("api/mocking") ? "bg-primary/15 text-primary" : "hover:bg-base-200/60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FlaskConical
                        className={clsx(
                          "w-3.5 h-3.5",
                          activePanelIds.includes("api/mocking") ? "text-primary" : "text-base-content/50",
                        )}
                      />
                      <span className="font-bold">{t.apiMocking}</span>
                    </div>
                    <ChevronRight
                      className={clsx(
                        "w-3.5 h-3.5",
                        activePanelIds.includes("api/mocking") ? "text-primary/70" : "text-base-content/30",
                      )}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenPanel("api/schema")}
                    className={clsx(
                      "w-full flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors text-xs text-left",
                      activePanelIds.includes("api/schema") ? "bg-primary/15 text-primary" : "hover:bg-base-200/60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileText
                        className={clsx(
                          "w-3.5 h-3.5",
                          activePanelIds.includes("api/schema") ? "text-primary" : "text-base-content/50",
                        )}
                      />
                      <span className="font-bold">{t.apiSchema}</span>
                    </div>
                    <ChevronRight
                      className={clsx(
                        "w-3.5 h-3.5",
                        activePanelIds.includes("api/schema") ? "text-primary/70" : "text-base-content/30",
                      )}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case "monitor":
        return (
          <div
            key="monitor"
            className={clsx("transition-all space-y-3 py-1", !isActive && "opacity-60 hover:opacity-80")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    isActive ? "bg-base-200 text-base-content/50" : "bg-base-300/50 text-base-content/30",
                  )}
                >
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-base-content">{t.monitor}</span>
                    {!isActive && (
                      <span className="text-[8px] font-bold text-base-content/30 bg-base-300 px-1 py-0.5 rounded">
                        OFF
                      </span>
                    )}
                  </div>
                  {!isActive && <p className="text-[10px] text-base-content/40 mt-0.5">{t.monitorEnableHint}</p>}
                </div>
              </div>
              {toggles.monitor.loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              ) : (
                <input
                  type="checkbox"
                  className="toggle toggle-success toggle-sm shrink-0"
                  checked={toggles.monitor.checked}
                  onChange={(e) => toggles.monitor.toggle(e.target.checked)}
                />
              )}
            </div>

            {isActive && (
              <div className="pl-11 space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs py-1 px-2">
                  <span className="text-[10px] font-black uppercase text-base-content/40">{t.monitorStatus}</span>
                  <button
                    type="button"
                    onClick={fetchStatus}
                    disabled={loadingStatus}
                    className="flex items-center gap-1 hover:text-primary transition-colors text-[10px] font-bold"
                  >
                    <RefreshCw className={clsx("w-3 h-3", loadingStatus && "animate-spin")} />
                    {t.monitorRefresh}
                  </button>
                </div>

                {status ? (
                  <div
                    className={clsx(
                      "p-3 rounded-lg border text-xs mx-2",
                      status.level === "error"
                        ? "bg-error/10 border-error/20 text-error"
                        : status.level === "warning"
                          ? "bg-warning/10 border-warning/20 text-warning"
                          : "bg-success/10 border-success/20 text-success",
                    )}
                  >
                    <p className="font-bold">
                      {status.level === "error"
                        ? t.monitorError
                        : status.level === "warning"
                          ? t.monitorWarning
                          : t.monitorHealthy}
                    </p>
                    <p className="text-[10px] text-base-content/60 mt-0.5 truncate">{status.message}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-base-content/50 px-2">{t.monitorNoData}</p>
                )}

                <button
                  type="button"
                  onClick={() =>
                    void openDetachedWindow(
                      `/monitor/logs?host=${encodeURIComponent(displayHost)}`,
                      `${displayHost} — ${t.monitorOpenLogs}`,
                      1100,
                      760,
                    )
                  }
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-base-200/60 transition-colors text-xs text-left"
                >
                  <span className="font-bold text-base-content/75">{t.monitorOpenLogs}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-base-content/30" />
                </button>
              </div>
            )}
          </div>
        );

      case "proxy":
        return (
          <div
            key="proxy"
            className={clsx("transition-all space-y-3 py-1", !isActive && "opacity-60 hover:opacity-80")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    isActive ? "bg-base-200 text-base-content/50" : "bg-base-300/50 text-base-content/30",
                  )}
                >
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-base-content">{t.proxy}</span>
                    {!isActive && (
                      <span className="text-[8px] font-bold text-base-content/30 bg-base-300 px-1 py-0.5 rounded">
                        OFF
                      </span>
                    )}
                  </div>
                  {!isActive && <p className="text-[10px] text-base-content/40 mt-0.5">{t.proxyRouteToggleHint}</p>}
                </div>
              </div>
              {toggles.proxy.loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              ) : (
                <input
                  type="checkbox"
                  className="toggle toggle-success toggle-sm shrink-0"
                  checked={toggles.proxy.checked}
                  onChange={(e) => toggles.proxy.toggle(e.target.checked)}
                />
              )}
            </div>

            {isActive && (
              <div className="pl-11 space-y-3 pt-2 text-xs">
                {!proxyActive ? (
                  <div className="space-y-2 py-1 px-2">
                    <p className="text-[10px] text-base-content/50">{t.proxyGlobalOff}</p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="text-[10px] h-7 px-2 py-0"
                      onClick={() => void openPopupWindow("infrastructure")}
                    >
                      {t.proxyOpenInfra}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 py-1 px-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] font-bold text-base-content/40 uppercase block mb-1">
                          {t.proxyRouteTargetHost}
                        </label>
                        <Input
                          value={targetHost}
                          onChange={(e) => setTargetHost(e.target.value)}
                          placeholder="localhost"
                          className="h-8 text-[11px] px-2 bg-base-200/40 border-base-300"
                        />
                      </div>
                      <div className="w-20">
                        <label className="text-[9px] font-bold text-base-content/40 uppercase block mb-1">
                          {t.proxyRouteTargetPort}
                        </label>
                        <Input
                          value={targetPort}
                          onChange={(e) => setTargetPort(e.target.value)}
                          placeholder="3000"
                          type="number"
                          className="h-8 text-[11px] px-2 bg-base-200/40 border-base-300"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      {route ? (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-[10px] h-7 gap-1 px-2.5 font-bold"
                            onClick={handleUpdateRoute}
                            disabled={savingProxy}
                          >
                            <Server className="w-3 h-3" />
                            {savingProxy ? t.proxyRouteSaving : t.proxyRouteSave}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-[10px] h-7 gap-1 text-error px-2.5 font-bold"
                            onClick={handleDeleteRoute}
                            disabled={savingProxy}
                          >
                            {t.proxyRouteDelete}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          className="text-[10px] h-7 gap-1 px-2.5 font-bold"
                          onClick={handleAddRoute}
                          disabled={savingProxy}
                        >
                          <Server className="w-3 h-3" />
                          {t.proxyRouteAdd}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Panel
      id="overview"
      title={displayHost}
      subtitle={getGroupName(domain.id, t.ungrouped)}
      onClose={onClose}
      width="md"
    >
      <div className="space-y-4">
        {/* 활성 피처/메뉴 목록 */}
        <div className="space-y-3">
          {activeFeatures.map((key, index) => (
            <div key={key} className={clsx(index > 0 && "border-t border-base-200/40 pt-3")}>
              {renderFeatureCard(key, true)}
            </div>
          ))}

          {/* 고정 메뉴: Debug (디버그) */}
          <div className="border-t border-base-200/40 pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 py-1">
                <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center text-base-content/50 shrink-0">
                  <Bug className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-base-content">{t.debug}</span>
                  <p className="text-[10px] text-base-content/40 mt-0.5">{t.debugNavDesc}</p>
                </div>
              </div>
            </div>

            <div className="pl-11 space-y-1.5">
              <button
                type="button"
                onClick={() => void openDetachedWindow("/proxy/inspector", t.debugInspector, 1100, 760)}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-base-200/60 transition-colors text-xs text-left"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-base-content/50" />
                  <span className="font-bold text-base-content/75">{t.debugInspector}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-base-content/30" />
              </button>

              <button
                type="button"
                onClick={() =>
                  void openDetachedWindow(
                    `/ux/live-capture?url=${encodeURIComponent(domain.url)}`,
                    `${displayHost} — Live Capture`,
                    1280,
                    860,
                  )
                }
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-base-200/60 transition-colors text-xs text-left"
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-base-content/50" />
                  <span className="font-bold text-base-content/75">{t.debugLiveCapture}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-base-content/30" />
              </button>

              <button
                type="button"
                onClick={() => void openDetachedWindow("/ux/policies", t.debugPolicies, 1100, 760)}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-base-200/60 transition-colors text-xs text-left"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-base-content/50" />
                  <span className="font-bold text-base-content/75">{t.debugPolicies}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-base-content/30" />
              </button>
            </div>
          </div>
        </div>

        {recentLogs.length > 0 && (
          <div className="pt-3 border-t border-base-200/40">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2">
              {t.recentActivity}
            </h3>
            <div className="space-y-1">
              {recentLogs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => onOpenPanel("api/log", { logId: log.id })}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-base-200 text-left transition-colors"
                >
                  <span className="text-[9px] font-black bg-base-300 px-1.5 py-0.5 rounded text-base-content/60">
                    {log.method}
                  </span>
                  <span className="text-[10px] font-mono truncate flex-1 text-base-content/70">{log.path}</span>
                  <span className={clsx("text-[9px] font-bold", log.status >= 400 ? "text-error" : "text-success")}>
                    {log.status}
                  </span>
                  <ArrowRight className="w-3 h-3 text-base-content/30" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 비활성 피처 목록 */}
        {inactiveFeatures.length > 0 && (
          <div className="space-y-3">
            <div className="pt-3 border-t border-base-200/40 mt-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-base-content/30 px-1 mb-1">
                {t.featureDisabledSection}
              </p>
            </div>
            {inactiveFeatures.map((key, index) => (
              <div key={key} className={clsx(index > 0 && "border-t border-base-200/40 pt-3")}>
                {renderFeatureCard(key, false)}
              </div>
            ))}
          </div>
        )}
      </div>

      {toggles.proxy.showModal && (
        <ProxyRouteModal
          domainId={domain.id}
          domainUrl={domain.url}
          t={t}
          onClose={() => toggles.proxy.setShowModal(false)}
          onAdded={() => {
            toggles.proxy.setShowModal(false);
            fetchAll();
          }}
        />
      )}
    </Panel>
  );
}
