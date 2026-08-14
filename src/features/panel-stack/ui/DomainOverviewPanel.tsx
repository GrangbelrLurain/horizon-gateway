import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Code,
  FileText,
  FlaskConical,
  Loader2,
  Lock,
  MapPin,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import { ProxyRouteModal } from "@/entities/domain";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { annotationMatchesHost } from "@/shared/lib/guideMatch";
import { Button } from "@/shared/ui/button/Button";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { usePanelNavigation } from "../hooks/usePanelNavigation";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { hubPoliciesDomainSeedAtom } from "../store";
import type { PanelId } from "../types";
import { OverviewHelpPopover } from "./OverviewHelpPopover";
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
  const setPoliciesDomainSeed = useSetAtom(hubPoliciesDomainSeedAtom);
  const { getFeatureState, getGroupName, getProxyRoute, proxyActive, fetchAll, hubProxySettings } = useDomainHubData();
  const featureState = getFeatureState(domain.id);
  const toggles = useDomainFeatureToggles({
    domainId: domain.id,
    domainUrl: domain.url,
    state: featureState,
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

  const hostInList = (list: string[] | undefined, host: string) =>
    Boolean(
      list?.some((item) => {
        const p = item.toLowerCase();
        return host === p || host.endsWith(`.${p}`) || host.includes(p);
      }),
    );

  const tlsBypassed = hostInList(hubProxySettings?.tls_bypass_hosts, displayHost.toLowerCase());
  const localRoute = getProxyRoute(domain);

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
          const match = res.data.some((a) => annotationMatchesHost(a, cleanHost));
          setHasAnnotations(match);
        }
      })
      .catch(() => {});
  }, [displayHost]);

  const inspectItems: MenuItemDef[] = useMemo(
    () => [
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
        id: "global/policies",
        label: t.debugPolicies,
        icon: <BookOpen className="w-4 h-4" />,
        onClick: () => {
          setPoliciesDomainSeed(displayHost);
          nav.openGlobalSurface("global/policies");
        },
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
    ],
    [
      t.openApiPanel,
      t.apiSchema,
      t.apiMocking,
      t.debugPolicies,
      t.openMonitorPanel,
      toggles.api,
      toggles.monitor,
      recentLogs.length,
      hasSchema,
      hasMockRules,
      hasAnnotations,
      onOpenPanel,
      nav,
      displayHost,
      setPoliciesDomainSeed,
    ],
  );

  const activeItems = useMemo(() => inspectItems.filter((item) => item.isActive), [inspectItems]);
  const inactiveItems = useMemo(() => inspectItems.filter((item) => !item.isActive), [inspectItems]);

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

  const localTargetLabel = localRoute ? `${localRoute.targetHost}:${localRoute.targetPort}` : t.localDestinationNone;

  return (
    <Panel
      id="overview"
      title={displayHost}
      subtitle={getGroupName(domain.id, t.ungrouped)}
      onClose={onClose}
      width="md"
    >
      <div className="space-y-4">
        {!proxyActive && (
          <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg bg-warning/10">
            <p className="text-[11px] font-bold text-warning leading-snug">{t.listenerOffBanner}</p>
            <Button variant="secondary" size="sm" onClick={() => nav.openGlobalSurface("chrome/settings")}>
              {t.listenerOffAction}
            </Button>
          </div>
        )}

        <section className="space-y-1 px-1">
          <div className="flex items-center justify-between gap-2 py-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-base-200 text-base-content/70">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold">{t.httpsDecrypt}</p>
                  <OverviewHelpPopover
                    id="overview-https-decrypt-help"
                    ariaLabel={t.httpsDecryptHelpAria}
                    whyTitle={t.httpsDecryptHelpWhyTitle}
                    why={t.httpsDecryptHelpWhy}
                    onTitle={t.httpsDecryptHelpOnTitle}
                    on={t.httpsDecryptHelpOn}
                    offTitle={t.httpsDecryptHelpOffTitle}
                    off={t.httpsDecryptHelpOff}
                  />
                </div>
                <p className="text-[10px] text-base-content/40 leading-snug">{t.httpsDecryptHint}</p>
              </div>
            </div>
            {toggles.httpsDecrypt.loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            ) : (
              <input
                type="checkbox"
                className="toggle toggle-success toggle-xs shrink-0"
                checked={toggles.httpsDecrypt.checked}
                onChange={(e) => toggles.httpsDecrypt.toggle(e.target.checked)}
              />
            )}
          </div>
          {tlsBypassed && <p className="text-[10px] text-warning font-bold px-9">{t.httpsDecryptBypass}</p>}
        </section>

        <section className="space-y-1 px-1">
          <div className="flex items-center justify-between gap-2 py-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-base-200 text-base-content/70">
                <Code className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold">{t.scriptInjection}</p>
                  <OverviewHelpPopover
                    id="overview-script-injection-help"
                    ariaLabel={t.scriptInjectionHelpAria}
                    whyTitle={t.httpsDecryptHelpWhyTitle}
                    why={t.scriptInjectionHelpWhy}
                    onTitle={t.httpsDecryptHelpOnTitle}
                    on={t.scriptInjectionHelpOn}
                    offTitle={t.httpsDecryptHelpOffTitle}
                    off={t.scriptInjectionHelpOff}
                  />
                </div>
                <p className="text-[10px] text-base-content/40 leading-snug">{t.scriptInjectionHint}</p>
              </div>
            </div>
            {toggles.scriptInjection.loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            ) : (
              <input
                type="checkbox"
                className="toggle toggle-success toggle-xs shrink-0"
                checked={toggles.scriptInjection.checked}
                onChange={(e) => toggles.scriptInjection.toggle(e.target.checked)}
              />
            )}
          </div>
        </section>

        <section className="space-y-1 px-1">
          <div className="flex items-center justify-between gap-2 py-1">
            <button
              type="button"
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
              onClick={() => onOpenPanel("proxy")}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-base-200 text-base-content/70">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold">{t.localDestination}</p>
                <p className="text-[10px] font-mono text-base-content/50 truncate">{localTargetLabel}</p>
              </div>
            </button>
            <div className="flex items-center gap-1 shrink-0">
              {toggles.proxy.loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              ) : (
                <input
                  type="checkbox"
                  className="toggle toggle-success toggle-xs shrink-0"
                  checked={toggles.proxy.checked}
                  onChange={(e) => toggles.proxy.toggle(e.target.checked)}
                />
              )}
              <button
                type="button"
                onClick={() => onOpenPanel("proxy")}
                className="p-1 hover:text-base-content text-base-content/30 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-base-content/40 px-9 leading-relaxed">{t.localDestinationHint}</p>
        </section>

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
            {(activeItems.length > 0 || recentLogs.length > 0) && (
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
