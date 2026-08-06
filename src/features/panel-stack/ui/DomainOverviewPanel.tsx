import clsx from "clsx";
import { useAtomValue } from "jotai";
import { Activity, ArrowRight, ChevronRight, Code, FileText, FlaskConical, Loader2, Server, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import { ProxyRouteModal } from "@/entities/domain";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { openDetachedWindow } from "@/shared/lib/tauri/openDetachedWindow";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { usePanelNavigation } from "../hooks/usePanelNavigation";
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

interface MenuItemDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  toggle?: {
    checked: boolean;
    loading: boolean;
    onToggle: (checked: boolean) => void;
  };
  onClick: () => void;
  isActive: boolean;
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
  const { getFeatureState, getGroupName, proxyActive, fetchAll } = useDomainHubData();
  const featureState = getFeatureState(domain.id);
  const toggles = useDomainFeatureToggles({
    domainId: domain.id,
    domainUrl: domain.url,
    state: featureState,
    proxyActive,
    onRefresh: fetchAll,
  });

  const apiLoggingLinks = useAtomValue(apiLoggingLinksAtom);

  const [recentLogs, setRecentLogs] = useState<{ id: string; method: string; path: string; status: number }[]>([]);
  const [hasMockRules, setHasMockRules] = useState(false);
  const [hasAnnotations, setHasAnnotations] = useState(false);

  let displayHost = domain.url;
  try {
    const u = new URL(domain.url.startsWith("http") ? domain.url : `https://${domain.url}`);
    displayHost = u.hostname;
  } catch {
    // keep
  }

  const apiLink = useMemo(() => apiLoggingLinks.find((l) => l.domainId === domain.id), [apiLoggingLinks, domain.id]);
  const hasSchema = Boolean(apiLink?.schemaUrl?.trim());

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

  useEffect(() => {
    const cleanHost = displayHost.toLowerCase();
    commands
      .getMockRules()
      .then(unwrap)
      .then((res) => {
        if (res.success && res.data) {
          const match = res.data.some(
            (r) => r.host?.toLowerCase().includes(cleanHost) || r.url_pattern?.toLowerCase().includes(cleanHost),
          );
          setHasMockRules(match);
        }
      })
      .catch(() => {});

    commands
      .getAnnotations()
      .then(unwrap)
      .then((res) => {
        if (res.success && res.data) {
          const match = res.data.some((a) => Boolean(a.url?.toLowerCase().includes(cleanHost)));
          setHasAnnotations(match);
        }
      })
      .catch(() => {});
  }, [displayHost]);

  // Canonical ordering of menu items
  const menuItems: MenuItemDef[] = useMemo(
    () => [
      {
        id: "global/inspector",
        label: lang === "ko" ? "스크립트 인젝션 (Inspector)" : "Script Injection (Inspector)",
        icon: <Code className="w-4 h-4" />,
        toggle: {
          checked: toggles.scriptInjection.checked,
          loading: toggles.scriptInjection.loading,
          onToggle: (checked) => toggles.scriptInjection.toggle(checked),
        },
        onClick: () => void openDetachedWindow("/ux/live-capture", "Script Injection", 1100, 760),
        isActive: toggles.scriptInjection.checked,
      },
      {
        id: "api/logs",
        label: t.openApiPanel,
        icon: <Wifi className="w-4 h-4" />,
        toggle: {
          checked: toggles.api.checked,
          loading: toggles.api.loading,
          onToggle: (checked) => toggles.api.toggle(checked),
        },
        onClick: () => onOpenPanel("api/logs"),
        isActive: toggles.api.checked || recentLogs.length > 0,
      },
      {
        id: "api/schema",
        label: t.apiSchema,
        icon: <FileText className="w-4 h-4" />,
        onClick: () => onOpenPanel("api/schema"),
        isActive: hasSchema,
      },
      {
        id: "global/mocking",
        label: t.apiMocking,
        icon: <FlaskConical className="w-4 h-4" />,
        onClick: () => nav.openGlobalSurface("global/mocking"),
        isActive: hasMockRules,
      },
      {
        id: "debug/policies",
        label: t.debugPolicies,
        icon: <FileText className="w-4 h-4" />,
        onClick: () => void openDetachedWindow("/ux/policies", t.debugPolicies, 1100, 760),
        isActive: hasAnnotations,
      },
      {
        id: "global/monitor",
        label: t.openMonitorPanel,
        icon: <Activity className="w-4 h-4" />,
        toggle: {
          checked: toggles.monitor.checked,
          loading: toggles.monitor.loading,
          onToggle: (checked) => toggles.monitor.toggle(checked),
        },
        onClick: () => nav.openGlobalSurface("global/monitor"),
        isActive: toggles.monitor.checked,
      },
      {
        id: "global/proxy-graph",
        label: t.openProxyPanel,
        icon: <Server className="w-4 h-4" />,
        toggle: {
          checked: toggles.proxy.checked,
          loading: toggles.proxy.loading,
          onToggle: (checked) => toggles.proxy.toggle(checked),
        },
        onClick: () => nav.openGlobalSurface("global/proxy-graph"),
        isActive: toggles.proxy.checked,
      },
    ],
    [
      lang,
      t.openApiPanel,
      t.apiSchema,
      t.apiMocking,
      t.debugPolicies,
      t.openMonitorPanel,
      t.openProxyPanel,
      toggles.scriptInjection,
      toggles.api,
      toggles.monitor,
      toggles.proxy,
      recentLogs.length,
      hasSchema,
      hasMockRules,
      hasAnnotations,
      onOpenPanel,
      nav,
    ],
  );

  const activeItems = useMemo(() => menuItems.filter((item) => item.isActive), [menuItems]);
  const inactiveItems = useMemo(() => menuItems.filter((item) => !item.isActive), [menuItems]);

  const renderMenuItemRow = (item: MenuItemDef) => (
    <div
      key={item.id}
      className={clsx(
        "group flex items-center justify-between py-1.5 px-2 rounded-lg transition-all",
        item.isActive
          ? "hover:bg-base-200/80 text-base-content"
          : "opacity-45 hover:opacity-80 hover:bg-base-200/40 text-base-content/60",
      )}
    >
      <button type="button" onClick={item.onClick} className="flex items-center gap-2.5 flex-1 text-left py-0.5">
        <div
          className={clsx(
            "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
            item.isActive ? "bg-base-200 text-base-content/70" : "bg-base-300/40 text-base-content/40",
          )}
        >
          {item.icon}
        </div>
        <span
          className={clsx(
            "text-xs font-bold truncate",
            item.isActive ? "text-base-content/90" : "text-base-content/50",
          )}
        >
          {item.label}
        </span>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        {item.toggle &&
          (item.toggle.loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
          ) : (
            <input
              type="checkbox"
              className="toggle toggle-success toggle-xs shrink-0"
              checked={item.toggle.checked}
              onChange={(e) => item.toggle?.onToggle(e.target.checked)}
            />
          ))}
        <button
          type="button"
          onClick={item.onClick}
          className="p-1 hover:text-base-content text-base-content/30 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <Panel
      id="overview"
      title={displayHost}
      subtitle={getGroupName(domain.id, t.ungrouped)}
      onClose={onClose}
      width="md"
    >
      <div className="space-y-4">
        {activeItems.length > 0 && <div className="space-y-0.5">{activeItems.map(renderMenuItemRow)}</div>}

        {recentLogs.length > 0 && (
          <div className="pt-2.5 border-t border-base-200/40">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-1.5 px-1">
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

        {inactiveItems.length > 0 && (
          <div className="space-y-1">
            {activeItems.length > 0 && (
              <div className="pt-2 border-t border-base-200/40 my-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-base-content/30 px-1 mb-1">
                  {t.featureDisabledSection}
                </p>
              </div>
            )}
            <div className="space-y-0.5">{inactiveItems.map(renderMenuItemRow)}</div>
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
