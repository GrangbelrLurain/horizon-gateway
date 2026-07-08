import clsx from "clsx";
import { useAtomValue } from "jotai";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { languageAtom } from "@/entities/app";
import type { Domain, DomainStatusLog } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { openDetachedWindow } from "@/shared/lib/tauri/openDetachedWindow";
import { Button } from "@/shared/ui/button/Button";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { Panel } from "./Panel";

interface DomainMonitorPanelProps {
  domain: Domain;
  onClose: () => void;
}

export function DomainMonitorPanel({ domain, onClose }: DomainMonitorPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const { getFeatureState, getDomainHost, proxyActive, fetchAll } = useDomainHubData();
  const featureState = getFeatureState(domain.id);
  const toggles = useDomainFeatureToggles({
    domainId: domain.id,
    domainUrl: domain.url,
    state: featureState,
    proxyActive,
    onRefresh: fetchAll,
  });
  const [status, setStatus] = useState<{ level: string; message: string; timestamp: string } | null>(null);
  const [logs, setLogs] = useState<DomainStatusLog[]>([]);
  const [loading, setLoading] = useState(false);

  const host = getDomainHost(domain);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const [latestRes, logsRes] = await Promise.all([
        commands.getLatestStatus().then(unwrap),
        commands.getDomainStatusLogs({ date: today }).then(unwrap),
      ]);

      if (latestRes.success && latestRes.data) {
        const match = latestRes.data.find((s) => s.url.toLowerCase().includes(host));
        if (match) {
          setStatus({
            level: match.level,
            message: match.errorMessage ?? match.status,
            timestamp: match.timestamp,
          });
        }
      }

      if (logsRes.success && logsRes.data) {
        setLogs(
          logsRes.data
            .filter((log) => log.url.toLowerCase().includes(host))
            .slice(0, 8)
            .reverse(),
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    if (!toggles.monitor.checked) {
      return;
    }
    void fetchStatus();
  }, [toggles.monitor.checked, fetchStatus]);

  const levelLabel =
    status?.level === "error" ? t.monitorError : status?.level === "warning" ? t.monitorWarning : t.monitorHealthy;

  return (
    <Panel id="monitor" title={t.monitorTitle} subtitle={host} onClose={onClose} width="md">
      {!toggles.monitor.checked ? (
        <p className="text-xs text-base-content/50">{t.monitorEnableHint}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
              {t.monitorStatus}
            </span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={fetchStatus} disabled={loading}>
              <RefreshCw className={clsx("w-3 h-3", loading && "animate-spin")} />
              {t.monitorRefresh}
            </Button>
          </div>

          {status ? (
            <div
              className={clsx(
                "p-4 rounded-xl border",
                status.level === "error"
                  ? "bg-error/10 border-error/20"
                  : status.level === "warning"
                    ? "bg-warning/10 border-warning/20"
                    : "bg-success/10 border-success/20",
              )}
            >
              <p className="text-sm font-black">{levelLabel}</p>
              <p className="text-xs text-base-content/60 mt-1">{status.message}</p>
              <p className="text-[10px] text-base-content/40 mt-2">{new Date(status.timestamp).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-xs text-base-content/50">{t.monitorNoData}</p>
          )}

          {logs.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2">
                {t.monitorRecentLogs}
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={`${log.timestamp}-${i}`} className="px-2 py-1.5 rounded-lg bg-base-200/50 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={clsx(
                          "font-black uppercase",
                          log.level === "error"
                            ? "text-error"
                            : log.level === "warning"
                              ? "text-warning"
                              : "text-success",
                        )}
                      >
                        {log.level}
                      </span>
                      <span className="text-base-content/40">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-base-content/60 mt-0.5 truncate">{log.errorMessage ?? log.status}</p>
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() =>
                  void openDetachedWindow(
                    `/monitor/logs?host=${encodeURIComponent(host)}`,
                    `${host} — ${t.monitorOpenLogs}`,
                    1100,
                    760,
                  )
                }
              >
                {t.monitorOpenLogs}
              </Button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
