import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { Activity, ExternalLink, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { languageAtom } from "@/entities/app";
import type { Domain, DomainStatusLog } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { openDetachedWindow } from "@/shared/lib/tauri/openDetachedWindow";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { useDomainHubData } from "../../hooks/useDomainHubData";
import { en } from "../../i18n/en";
import { ko } from "../../i18n/ko";

function hostFromUrl(url: string) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function MonitorManagementView() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const { domains, fetchAll, getGroupName, getDomainHost, getFeatureState } = useDomainHubData();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusByHost, setStatusByHost] = useState<Map<string, DomainStatusLog>>(new Map());
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await commands.getLatestStatus().then(unwrap);
      if (res.success && res.data) {
        const map = new Map<string, DomainStatusLog>();
        for (const entry of res.data) {
          map.set(hostFromUrl(entry.url), entry);
        }
        setStatusByHost(map);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const filteredDomains = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return domains
      .filter((d) => {
        if (!q) {
          return true;
        }
        const host = getDomainHost(d);
        const groupName = getGroupName(d.id, t.ungrouped);
        const status = statusByHost.get(host);
        return (
          host.includes(q) ||
          groupName.toLowerCase().includes(q) ||
          status?.status?.toLowerCase().includes(q) ||
          status?.level?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const stateA = getFeatureState(a.id);
        const stateB = getFeatureState(b.id);
        const weight = (enabled: boolean | undefined) => (enabled ? 2 : 1);
        const wA = weight(stateA.monitorEnabled);
        const wB = weight(stateB.monitorEnabled);
        if (wA !== wB) {
          return wB - wA;
        }
        return getDomainHost(a).localeCompare(getDomainHost(b));
      });
  }, [domains, getDomainHost, getFeatureState, getGroupName, searchTerm, statusByHost, t.ungrouped]);

  const rowVirtualizer = useVirtualizer({
    count: filteredDomains.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  const handleToggleMonitor = async (domainId: number, enabled: boolean) => {
    setTogglingId(domainId);
    try {
      await commands.setDomainMonitorCheckEnabled({ domainIds: [domainId], enabled }).then(unwrap);
      await fetchAll();
      await notifyHubDataChanged("features");
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingId(null);
    }
  };

  const renderStatus = (domain: Domain) => {
    const host = getDomainHost(domain);
    const enabled = getFeatureState(domain.id).monitorEnabled === true;
    if (!enabled) {
      return <span className="text-[9px] font-bold text-base-content/35 uppercase">{t.featureOff}</span>;
    }
    const status = statusByHost.get(host);
    if (!status) {
      return <span className="text-[9px] font-bold text-base-content/40">{t.monitorNoData}</span>;
    }
    const label =
      status.level === "error" ? t.monitorError : status.level === "warning" ? t.monitorWarning : t.monitorHealthy;
    return (
      <span
        className={clsx(
          "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
          status.level === "error"
            ? "bg-error/15 text-error"
            : status.level === "warning"
              ? "bg-warning/15 text-warning"
              : "bg-success/15 text-success",
        )}
      >
        {label}
      </span>
    );
  };

  const renderRow = (domain: Domain) => {
    const host = getDomainHost(domain);
    const groupName = getGroupName(domain.id, t.ungrouped);
    const enabled = getFeatureState(domain.id).monitorEnabled === true;
    const status = statusByHost.get(host);
    const toggling = togglingId === domain.id;

    return (
      <div className="p-3 rounded-xl border border-base-300 bg-base-100 hover:bg-base-200/40 transition-colors flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold font-mono truncate">{host}</span>
            {renderStatus(domain)}
          </div>
          <span className="text-[9px] text-base-content/40 font-bold block mt-1 truncate">{groupName}</span>
          {enabled && status?.errorMessage && (
            <p className="text-[10px] text-base-content/50 mt-1 truncate">{status.errorMessage}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-base-300 text-base-content/50 hover:text-primary transition-colors"
            title={t.monitorOpenLogs}
            onClick={() =>
              void openDetachedWindow(
                `/monitor/logs?host=${encodeURIComponent(host)}`,
                `${host} — ${t.monitorOpenLogs}`,
                1100,
                760,
              )
            }
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          {toggling ? (
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <input
              type="checkbox"
              className="toggle toggle-success toggle-sm"
              checked={enabled}
              onChange={(e) => void handleToggleMonitor(domain.id, e.target.checked)}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-base-100 text-base-content select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-base-300 bg-base-200/50 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h1 className="text-sm font-black tracking-tight">{t.toolsMonitor}</h1>
          </div>
          <p className="text-[10px] text-base-content/50 font-medium mt-0.5">{t.monitorManageDesc}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.monitorManageSearchPlaceholder}
              className="pl-8 h-8 text-[11px] rounded-lg shadow-sm"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-base-content/65 hover:text-base-content"
            onClick={() => {
              void fetchAll();
              void fetchStatus();
            }}
            title={t.monitorRefresh}
            disabled={loadingStatus}
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loadingStatus && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin">
        <div className="flex items-center justify-between pb-2 border-b border-base-300 mb-3">
          <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">
            {t.domains} ({filteredDomains.length})
          </span>
        </div>

        {filteredDomains.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-base-300 text-center text-xs text-base-content/40">
            {searchTerm ? t.monitorManageEmptySearch : t.noDomains}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const domain = filteredDomains[virtualRow.index];
              if (!domain) {
                return null;
              }
              return (
                <div
                  key={domain.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size - 8}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderRow(domain)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
