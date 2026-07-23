import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import {
  Activity,
  ArrowRight,
  Bug,
  Camera,
  ChevronRight,
  FileText,
  FlaskConical,
  Loader2,
  Search,
  Server,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import { ProxyRouteModal } from "@/entities/domain";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { openDetachedWindow } from "@/shared/lib/tauri/openDetachedWindow";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { usePanelNavigation } from "../hooks/usePanelNavigation";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { hubApiLogsHostSeedAtom } from "../store";
import type { HubSurfaceId, PanelId } from "../types";
import { Panel } from "./Panel";

interface DomainOverviewPanelProps {
  domain: Domain;
  onClose: () => void;
  onOpenPanel: (id: PanelId, params?: Record<string, string>) => void;
  activePanelIds?: PanelId[];
}

export function DomainOverviewPanel({
  domain,
  onClose,
  onOpenPanel,
  activePanelIds: _activePanelIds = [],
}: DomainOverviewPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const nav = usePanelNavigation();
  const setApiLogsHostSeed = useSetAtom(hubApiLogsHostSeedAtom);
  const { getFeatureState, getGroupName, proxyActive, fetchAll } = useDomainHubData();
  const featureState = getFeatureState(domain.id);
  const toggles = useDomainFeatureToggles({
    domainId: domain.id,
    domainUrl: domain.url,
    state: featureState,
    proxyActive,
    onRefresh: fetchAll,
  });
  const [recentLogs, setRecentLogs] = useState<{ id: string; method: string; path: string; status: number }[]>([]);

  let displayHost = domain.url;
  try {
    const u = new URL(domain.url.startsWith("http") ? domain.url : `https://${domain.url}`);
    displayHost = u.hostname;
  } catch {
    // keep
  }

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

  const renderOpenGlobalLink = (surfaceId: HubSurfaceId, label: string, icon: React.ReactNode, onOpen?: () => void) => (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        nav.openGlobalSurface(surfaceId);
      }}
      className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors text-xs text-left hover:bg-base-200/60"
    >
      <div className="flex items-center gap-2">
        <span className="text-base-content/50">{icon}</span>
        <span className="font-bold">{label}</span>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-base-content/30" />
    </button>
  );

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

            <div className="pl-11 space-y-1.5">
              {renderOpenGlobalLink("global/api-logs", t.openApiPanel, <Wifi className="w-3.5 h-3.5" />, () =>
                setApiLogsHostSeed(displayHost),
              )}
            </div>

            <div className="pl-11 pt-1">
              <button
                type="button"
                onClick={() => nav.openGlobalSurface("global/mocking")}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors text-xs text-left hover:bg-base-200/60"
              >
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-3.5 h-3.5 text-base-content/50" />
                  <span className="font-bold">{t.apiMocking}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-base-content/30" />
              </button>
              <p className="text-[10px] text-base-content/40 px-2 mt-1">{t.apiMockingIndependentHint}</p>
            </div>
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

            <div className="pl-11">
              {renderOpenGlobalLink("global/monitor", t.openMonitorPanel, <Activity className="w-3.5 h-3.5" />)}
            </div>
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

            <div className="pl-11">
              {renderOpenGlobalLink("global/proxy-graph", t.openProxyPanel, <Server className="w-3.5 h-3.5" />)}
            </div>
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
        <div className="space-y-3">
          {activeFeatures.map((key, index) => (
            <div key={key} className={clsx(index > 0 && "border-t border-base-200/40 pt-3")}>
              {renderFeatureCard(key, true)}
            </div>
          ))}

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
