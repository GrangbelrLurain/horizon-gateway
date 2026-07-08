import clsx from "clsx";
import { useAtomValue } from "jotai";
import { Activity, ArrowRight, Bug, ChevronRight, Loader2, Server, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import { ProxyRouteModal } from "@/entities/domain";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
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
}

interface FeatureMenuRowProps {
  icon: React.ReactNode;
  label: string;
  mode?: "feature" | "nav";
  checked?: boolean;
  loading?: boolean;
  hint?: string;
  compact?: boolean;
  onOpen: () => void;
  onToggle?: (enabled: boolean) => void;
}

function FeatureMenuRow({
  icon,
  label,
  mode = "feature",
  checked = false,
  loading,
  hint,
  compact = false,
  onOpen,
  onToggle,
}: FeatureMenuRowProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-base-300/40 bg-base-200/20 opacity-75">
        <div className="w-6 h-6 rounded-md bg-base-200/80 flex items-center justify-center text-base-content/35 shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-base-content/55 truncate">{label}</p>
          {hint && <p className="text-[9px] text-base-content/35 truncate">{hint}</p>}
        </div>
        {mode === "feature" && onToggle && (
          <label className="flex items-center shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <input
                type="checkbox"
                className="toggle toggle-success toggle-xs"
                checked={checked}
                onChange={(e) => onToggle(e.target.checked)}
              />
            )}
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2.5 rounded-xl border border-base-300 bg-base-100 hover:border-primary/30 transition-all">
      <button type="button" onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center text-base-content/50 shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-base-content">{label}</p>
          {hint && <p className="text-[10px] text-base-content/40 mt-0.5">{hint}</p>}
        </div>
        <ChevronRight className="w-4 h-4 text-base-content/30 shrink-0" />
      </button>

      {mode === "feature" && onToggle && (
        <label className="flex items-center shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary mx-2" />
          ) : (
            <input
              type="checkbox"
              className="toggle toggle-success toggle-sm"
              checked={checked}
              onChange={(e) => onToggle(e.target.checked)}
            />
          )}
        </label>
      )}
    </div>
  );
}

export function DomainOverviewPanel({ domain, onClose, onOpenPanel }: DomainOverviewPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
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

  const featureRows = useMemo(
    () => [
      {
        key: "monitor",
        panelId: "monitor" as PanelId,
        icon: <Activity className="w-4 h-4" />,
        label: t.monitor,
        checked: toggles.monitor.checked,
        loading: toggles.monitor.loading,
        hint: !toggles.monitor.checked ? t.monitorEnableHint : undefined,
        onToggle: toggles.monitor.toggle,
      },
      {
        key: "proxy",
        panelId: "proxy" as PanelId,
        icon: <Server className="w-4 h-4" />,
        label: t.proxy,
        checked: toggles.proxy.checked,
        loading: toggles.proxy.loading,
        onToggle: toggles.proxy.toggle,
      },
      {
        key: "api",
        panelId: "api" as PanelId,
        icon: <Wifi className="w-4 h-4" />,
        label: t.api,
        checked: toggles.api.checked,
        loading: toggles.api.loading,
        hint: !toggles.api.checked ? t.apiEnableHint : undefined,
        onToggle: toggles.api.toggle,
      },
    ],
    [t, toggles],
  );

  const activeFeatures = featureRows.filter((row) => row.checked);
  const inactiveFeatures = featureRows.filter((row) => !row.checked);

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

  return (
    <Panel
      id="overview"
      title={displayHost}
      subtitle={getGroupName(domain.id, t.ungrouped)}
      onClose={onClose}
      width="md"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          {activeFeatures.map((row) => (
            <FeatureMenuRow
              key={row.key}
              icon={row.icon}
              label={row.label}
              checked={row.checked}
              loading={row.loading}
              hint={row.hint}
              onOpen={() => onOpenPanel(row.panelId)}
              onToggle={row.onToggle}
            />
          ))}

          <FeatureMenuRow
            icon={<Bug className="w-4 h-4" />}
            label={t.debug}
            mode="nav"
            hint={t.debugNavDesc}
            onOpen={() => onOpenPanel("debug")}
          />

          {inactiveFeatures.length > 0 && (
            <>
              <div className="pt-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-base-content/30 px-1">
                  {t.featureDisabledSection}
                </p>
              </div>
              {inactiveFeatures.map((row) => (
                <FeatureMenuRow
                  key={row.key}
                  icon={row.icon}
                  label={row.label}
                  checked={row.checked}
                  loading={row.loading}
                  hint={row.hint}
                  compact
                  onOpen={() => onOpenPanel(row.panelId)}
                  onToggle={row.onToggle}
                />
              ))}
            </>
          )}
        </div>

        {recentLogs.length > 0 && (
          <div>
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
      </div>

      {toggles.proxy.showModal && (
        <ProxyRouteModal
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
