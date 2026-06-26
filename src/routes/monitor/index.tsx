import { createFileRoute, Link } from "@tanstack/react-router";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import { Activity, AlertTriangle, CheckCircle2, Clock, Copy, Filter, History, RefreshCcw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { domainCountAtom, languageAtom } from "@/entities/app";
import { siteCheckAtom } from "@/entities/domain-monitor";
import { VirtualizedGroupSection } from "@/features/domain-monitor";
import type { DomainStatusLog } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { EmptyState } from "@/shared/ui/empty-state/EmptyState";
import { LoadingScreen } from "@/shared/ui/loader/LoadingScreen";
import { en } from "./en";
import { ko } from "./ko";
import { monitorFilterLevelAtom, monitorSearchAtom } from "./store";

export const Route = createFileRoute("/monitor/")({
  component: MonitorIndex,
});

function MonitorIndex() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [isFetching, setIsFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  const [siteCheck, setSiteCheck] = useAtom(siteCheckAtom);
  const [search, setSearch] = useAtom(monitorSearchAtom);
  const [filterLevel, setFilterLevel] = useAtom(monitorFilterLevelAtom);
  const domainCount = useAtomValue(domainCountAtom);

  const fetchLatest = useCallback(async () => {
    setIsFetching(true);
    try {
      const response = await commands.getLatestStatus().then(unwrap);
      if (response.success && response.data.length > 0) {
        setSiteCheck(response.data);
        const latestTime =
          response.data.length > 0
            ? new Date(response.data[0].timestamp).toLocaleTimeString()
            : new Date().toLocaleTimeString();
        setLastUpdated(latestTime);
      }
    } catch (err) {
      console.error("Failed to fetch latest status:", err);
    } finally {
      setIsFetching(false);
    }
  }, [setSiteCheck]);

  const handleManualRefresh = useCallback(async () => {
    setIsFetching(true);
    try {
      const response = await commands.checkDomainStatus().then(unwrap);
      if (response.success) {
        setSiteCheck(response.data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to perform manual refresh:", err);
    } finally {
      setIsFetching(false);
    }
  }, [setSiteCheck]);

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(() => {
      fetchLatest();
    }, 1000 * 30);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  const stats = useMemo(() => {
    const healthy = siteCheck.filter((s) => s.level === "info").length;
    const warnings = siteCheck.filter((s) => s.level === "warning").length;
    const errors = siteCheck.filter((s) => s.level === "error").length;
    const avgLatency =
      siteCheck.length > 0
        ? Math.round(
            siteCheck.reduce((acc, s) => acc + (typeof s.latency === "number" ? s.latency : 0), 0) / siteCheck.length,
          )
        : 0;
    return { healthy, warnings, errors, avgLatency };
  }, [siteCheck]);

  const groupedSites = useMemo(() => {
    const filtered = siteCheck
      .filter((item) => (search ? item.url.toLowerCase().includes(search.toLowerCase()) : true))
      .filter((item) => (!filterLevel.length ? true : filterLevel.includes(item.level)));
    return filtered.reduce(
      (acc, obj) => {
        const rawGroup = obj.group || "Default";
        // Split combined group names and clean up
        const groups = rawGroup
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean);

        for (const groupName of groups) {
          if (!acc[groupName]) {
            acc[groupName] = [];
          }
          acc[groupName].push(obj);
        }
        return acc;
      },
      {} as Record<string, DomainStatusLog[]>,
    );
  }, [siteCheck, search, filterLevel]);

  const copyUrls = async () => {
    const reportContent = Object.entries(groupedSites)
      .map(([group, apps]) => {
        const errorList = apps.map((app) => `  • ${app.url} (${app.level.toUpperCase()}): ${app.status}`).join("\n");
        return `[${group}]\n${errorList}`;
      })
      .join("\n\n");
    if (reportContent) {
      await navigator.clipboard.writeText(`${t.reportTitle(new Date().toLocaleTimeString())}\n\n${reportContent}`);
      alert(t.reportCopied);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <AnimatePresence>
        {isFetching && siteCheck.length === 0 && (
          <LoadingScreen key="monitor-loader" onCancel={() => setIsFetching(false)} />
        )}
      </AnimatePresence>
      <header className="flex flex-col tablet:flex-row justify-between items-start tablet:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1 tablet:mb-2 text-primary">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <h1 className="text-2xl tablet:text-3xl font-black tracking-tight text-base-content">{t.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-base-content/60 text-[10px] tablet:text-sm">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {t.lastSynched}: <span className="font-bold text-base-content/80">{lastUpdated}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full tablet:w-auto">
          <Link to="/monitor/logs" className="flex-1 tablet:flex-none">
            <Button variant="secondary" className="gap-2 flex items-center w-full justify-center">
              <History className="w-4 h-4" />
              <span className="text-xs tablet:text-sm">{t.viewLogs}</span>
            </Button>
          </Link>
          <Button
            variant="secondary"
            onClick={handleManualRefresh}
            className="gap-2 flex items-center flex-1 tablet:flex-none justify-center"
          >
            <RefreshCcw className={clsx("w-4 h-4", isFetching && "animate-spin")} />
            <span className="text-xs tablet:text-sm">{t.refresh}</span>
          </Button>
          <Button
            variant="primary"
            onClick={copyUrls}
            className="gap-2 shadow-lg shadow-blue-500/20 flex items-center w-full tablet:w-auto justify-center"
          >
            <Copy className="w-4 h-4" />
            <span className="text-xs tablet:text-sm">{t.copyReport}</span>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-base-content/40 uppercase font-bold tracking-widest">{t.healthy}</p>
            <p className="text-xl font-bold text-base-content">{stats.healthy}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-base-content/40 uppercase font-bold tracking-widest">{t.warnings}</p>
            <p className="text-xl font-bold text-base-content">{stats.warnings}</p>
          </div>
        </Card>
        <Card
          className={clsx(
            "p-5 flex items-center gap-4 border-0 transition-all duration-500 shadow-sm",
            stats.errors > 0
              ? "bg-error/10 text-error shadow-lg shadow-error/10 ring-2 ring-error/20"
              : "bg-base-100 text-base-content border border-base-300",
          )}
        >
          <div
            className={clsx(
              "w-10 h-10 rounded-full flex items-center justify-center",
              stats.errors > 0 ? "bg-error text-error-content" : "bg-base-200 text-base-content/40",
            )}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p
              className={clsx(
                "text-[10px] uppercase font-bold tracking-widest",
                stats.errors > 0 ? "text-error" : "text-base-content/40",
              )}
            >
              {t.critical}
            </p>
            <p className="text-xl font-bold">{stats.errors}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center text-info">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-base-content/40 uppercase font-bold tracking-widest">{t.latencyAvg}</p>
            <p className="text-xl font-bold text-base-content">{stats.avgLatency}ms</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-col tablet:flex-row gap-4 items-center bg-base-100/50 backdrop-blur-sm p-4 rounded-3xl border border-base-300 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
          <input
            type="text"
            placeholder={t.filterPlaceholder}
            className="w-full pl-11 pr-4 py-3 bg-base-200 border-none rounded-2xl focus:ring-2 focus:ring-primary focus:bg-base-100 transition-all outline-none text-sm text-base-content font-bold tracking-tight shadow-inner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full tablet:w-auto overflow-x-auto [scrollbar-width:none] pb-1 tablet:pb-0">
          <Filter className="w-4 h-4 text-base-content/40 mr-1 shrink-0" />
          <div className="flex gap-2">
            {[
              { id: "info", label: t.healthy, color: "success" },
              { id: "warning", label: t.warnings, color: "warning" },
              { id: "error", label: t.critical, color: "error" },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() =>
                  setFilterLevel((prev) => (prev.includes(l.id) ? prev.filter((i) => i !== l.id) : [...prev, l.id]))
                }
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border",
                  filterLevel.includes(l.id)
                    ? {
                        "bg-success/10 text-success border-success/20": l.id === "info",
                        "bg-warning/10 text-warning border-warning/20": l.id === "warning",
                        "bg-error/10 text-error border-error/20": l.id === "error",
                      }
                    : "bg-base-200 text-base-content/40 border-transparent hover:bg-base-300",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-10 pb-20">
        {/* Tier 1: No domains at all */}
        {domainCount === 0 ? (
          <EmptyState tier={1} lang={lang} />
        ) : Object.entries(groupedSites).length > 0 ? (
          Object.entries(groupedSites).map(([group, apps]) => (
            <VirtualizedGroupSection key={group} group={group} apps={apps} />
          ))
        ) : search || filterLevel.length > 0 ? (
          /* Tier 3 (filtered): No matches for current search/filter */
          <EmptyState
            tier={3}
            icon={Search}
            title={t.noMatchingChecks}
            description={t.noMatchingDesc}
            actionLabel={t.resetFilters}
            onAction={() => {
              setSearch("");
              setFilterLevel([]);
            }}
          />
        ) : (
          /* Tier 3 (no data yet, setup complete) */
          <EmptyState tier={3} icon={Activity} title={t.noDataTitle} description={t.noDataDesc} />
        )}
      </div>
    </div>
  );
}
