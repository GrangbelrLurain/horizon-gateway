import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { Activity, ArrowRight, CheckCircle2, FlaskConical, Globe, History, Server, Wifi, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { domainCountAtom, proxyActiveAtom, proxyRunningAtom } from "@/entities/app";
import type { MockRule } from "@/entities/mocking";
import { getMockRules } from "@/entities/mocking";
import { commands, unwrap } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";

interface QuickStat {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  href: string;
  color: string;
  bg: string;
}

interface SetupStep {
  label: string;
  done: boolean;
  href: string;
  actionLabel: string;
}

interface RecentMonitorItem {
  url: string;
  level: string;
  latency?: number;
}

interface RecentApiLog {
  id: string;
  method: string;
  path: string;
  status_code: number | null;
  timestamp: string;
}

// ── SetupProgressCard ────────────────────────────────────────────────────────

interface SetupProgressCardProps {
  steps: SetupStep[];
  lang: "ko" | "en";
  onDismiss: () => void;
}

const SETUP_T = {
  ko: {
    title: "시작하기",
    subtitle: "아래 단계를 완료하면 Watchtower의 모든 기능을 사용할 수 있어요.",
    done: "완료",
    skip: "건너뛰기",
  },
  en: {
    title: "Getting Started",
    subtitle: "Complete the steps below to unlock all Watchtower features.",
    done: "Done",
    skip: "Skip",
  },
};

export function SetupProgressCard({ steps, lang, onDismiss }: SetupProgressCardProps) {
  const t = SETUP_T[lang];
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  // Once all done, it should naturally stay hidden via the parent but checking here too
  if (allDone) {
    return null;
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 shadow-xl shadow-primary/5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-black text-base-content tracking-tight">{t.title}</h2>
          <p className="text-sm text-base-content/60 mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary bg-primary/20 px-3 py-1 rounded-full">
            {completedCount}/{steps.length}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 text-base-content/40 hover:text-base-content/80 hover:bg-base-content/5 rounded-lg transition-colors group"
            title={t.skip}
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="w-full bg-primary/10 rounded-full h-1.5 mb-5 overflow-hidden">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${
              step.done
                ? "bg-transparent border-transparent opacity-40 grayscale"
                : "bg-base-100 border-primary/10 shadow-sm"
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-primary/30 shrink-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary/60">{i + 1}</span>
              </div>
            )}
            <span
              className={`text-sm flex-1 ${step.done ? "text-base-content/40 line-through" : "text-base-content font-bold"}`}
            >
              {step.label}
            </span>
            {!step.done && (
              <Link to={step.href}>
                <Button variant="primary" size="sm" className="gap-1 shrink-0 text-xs h-7 px-4">
                  {step.actionLabel}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── QuickStatsRow ────────────────────────────────────────────────────────────

interface QuickStatsRowProps {
  stats: QuickStat[];
}

export function QuickStatsRow({ stats }: QuickStatsRowProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {stats.map((stat) => (
        <Link key={stat.href} to={stat.href}>
          <Card className="p-5 bg-base-100 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group cursor-pointer overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors" />
            <div className="flex items-center gap-4 relative z-10">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${stat.bg}`}
              >
                <div className={stat.color}>{stat.icon}</div>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black text-base-content leading-none tracking-tight">{stat.value}</p>
                <p className="text-xs text-base-content/40 font-bold uppercase tracking-wider mt-1.5 truncate">
                  {stat.label}
                </p>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// ── RecentActivityGrid ────────────────────────────────────────────────────────

interface RecentActivityGridProps {
  monitorItems: RecentMonitorItem[];
  apiLogs: RecentApiLog[];
  mockRules: MockRule[];
  lang: "ko" | "en";
}

const ACTIVITY_T = {
  ko: {
    monitorTitle: "최근 모니터링",
    apiTitle: "최근 API 요청",
    viewAll: "전체 보기",
    healthy: "정상",
    warning: "경고",
    error: "오류",
    noMonitor: "모니터링 데이터가 없어요",
    noApi: "API 로그가 없어요",
  },
  en: {
    monitorTitle: "Recent Monitor",
    apiTitle: "Recent API Requests",
    viewAll: "View All",
    healthy: "Healthy",
    warning: "Warning",
    error: "Error",
    noMonitor: "No monitoring data yet",
    noApi: "No API logs yet",
  },
};

const levelConfig = {
  info: { dot: "bg-success", badge: "text-success bg-success/10" },
  warning: { dot: "bg-warning", badge: "text-warning bg-warning/10" },
  error: { dot: "bg-error", badge: "text-error bg-error/10" },
};

const statusColor = (code: number | null) => {
  if (code === null) {
    return "text-base-content/30";
  }
  if (code >= 500) {
    return "text-error";
  }
  if (code >= 400) {
    return "text-warning";
  }
  if (code >= 300) {
    return "text-info";
  }
  return "text-success font-bold";
};

export function RecentActivityGrid({ monitorItems, apiLogs, mockRules, lang }: RecentActivityGridProps) {
  const t = ACTIVITY_T[lang];
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
      {/* Monitor */}
      <Card className="p-5 bg-base-100 shadow-sm border-base-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-base-content flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            {t.monitorTitle}
          </h2>
          <Link
            to="/monitor"
            className="text-xs text-primary hover:text-primary/80 font-bold uppercase tracking-widest flex items-center gap-1"
          >
            {t.viewAll} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {monitorItems.length === 0 ? (
          <p className="text-sm text-base-content/30 text-center py-8">{t.noMonitor}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {monitorItems.slice(0, 5).map((item, i) => {
              const cfg = levelConfig[item.level as keyof typeof levelConfig] ?? levelConfig.info;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200/50 transition-colors border-b border-base-200/50 last:border-0"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 shadow-sm ${cfg.dot}`} />
                  <span className="text-sm font-mono text-base-content/80 flex-1 truncate">{item.url}</span>
                  {item.latency !== undefined && (
                    <span className="text-xs text-base-content/40 tabular-nums shrink-0">{item.latency}ms</span>
                  )}
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 uppercase tracking-tighter ${cfg.badge}`}
                  >
                    {t[item.level as keyof typeof t] ?? item.level}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* API Logs */}
      <Card className="p-5 bg-base-100 shadow-sm border-base-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-base-content flex items-center gap-2">
            <History className="w-4 h-4 text-primary/80" />
            {t.apiTitle}
          </h2>
          <Link
            to="/apis/logs"
            className="text-xs text-primary hover:text-primary/80 font-bold uppercase tracking-widest flex items-center gap-1"
          >
            {t.viewAll} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {apiLogs.length === 0 ? (
          <p className="text-sm text-base-content/30 text-center py-8">{t.noApi}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {apiLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200/50 transition-colors border-b border-base-200/50 last:border-0"
              >
                <span className="text-[10px] font-black text-base-content/60 bg-base-300 px-2 py-0.5 rounded w-14 text-center shrink-0 uppercase">
                  {log.method}
                </span>
                <span className="text-xs font-mono text-base-content/80 flex-1 truncate">{log.path}</span>
                <span className={`text-xs font-black shrink-0 tabular-nums ${statusColor(log.status_code)}`}>
                  {log.status_code ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Mock Rules */}
      <Card className="p-5 bg-base-100 shadow-sm border-base-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-base-content flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-accent" />
            {lang === "ko" ? "활성 모킹 API" : "Active Mock APIs"}
          </h2>
          <Link
            to="/apis/mocking"
            className="text-xs text-accent hover:text-accent/80 font-bold uppercase tracking-widest flex items-center gap-1"
          >
            {lang === "ko" ? "관리" : "Manage"} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {mockRules.length === 0 ? (
          <p className="text-sm text-base-content/30 text-center py-8">
            {lang === "ko" ? "활성화된 모킹 룰이 없습니다." : "No active mock rules."}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {mockRules.slice(0, 5).map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200/50 transition-colors border-b border-base-200/50 last:border-0"
              >
                <span className="text-[10px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded w-14 text-center shrink-0 uppercase">
                  {rule.method}
                </span>
                <span className="text-xs font-mono text-base-content/80 flex-1 truncate" title={rule.url_pattern}>
                  {rule.url_pattern}
                </span>
                <span className={`text-xs font-black shrink-0 tabular-nums ${statusColor(rule.response_status)}`}>
                  {rule.response_status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── DashboardDataProvider ────────────────────────────────────────────────────

interface DashboardData {
  monitorItems: RecentMonitorItem[];
  apiLogs: RecentApiLog[];
  todayCount: number;
  mockRules: MockRule[];
}

export function useDashboardData(): DashboardData {
  const [monitorItems, setMonitorItems] = useState<RecentMonitorItem[]>([]);
  const [apiLogs, setApiLogs] = useState<RecentApiLog[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [mockRules, setMockRules] = useState<MockRule[]>([]);
  const domainCount = useAtomValue(domainCountAtom);

  useEffect(() => {
    if (domainCount === 0 || domainCount === null) {
      return;
    }

    commands
      .getLatestStatus()
      .then(unwrap)
      .then((res) => {
        if (res.success && res.data) {
          setMonitorItems(res.data.slice(0, 5));
        }
      })
      .catch(console.error);

    const today = new Date().toISOString().split("T")[0];
    commands
      .getApiLogs({ date: today, domainFilter: null, methodFilter: null, hostFilter: null, exactMatch: null })
      .then(unwrap)
      .then((res) => {
        if (res.success && res.data) {
          setTodayCount(res.data.length);
          setApiLogs(res.data.slice(0, 5).map((l) => ({ ...l, status_code: l.status_code ?? null })));
        }
      })
      .catch(console.error);

    getMockRules()
      .then((rules) => {
        setMockRules(rules.filter((r) => r.enabled));
      })
      .catch(console.error);
  }, [domainCount]);

  return { monitorItems, apiLogs, todayCount, mockRules };
}

// ── ProxyStatusBadge ─────────────────────────────────────────────────────────

export function ProxyStatusBadge({ lang }: { lang: "ko" | "en" }) {
  const proxyActive = useAtomValue(proxyActiveAtom);
  const proxyRunning = useAtomValue(proxyRunningAtom);

  if (proxyRunning === null) {
    return null;
  }

  return (
    <Link to="/proxy/dashboard">
      <div
        className={clsx(
          "flex items-center gap-3 px-4 py-2 rounded-full text-[10px] sm:text-xs font-black transition-all border shadow-lg shadow-black/5 cursor-pointer active:scale-95 h-10 select-none shrink-0",
          proxyActive
            ? "bg-success/10 text-success border-success/30 hover:bg-success/20 hover:border-success/40"
            : "bg-base-300 text-base-content/40 border-base-content/5 grayscale opacity-70 hover:opacity-100 hover:grayscale-0 hover:bg-base-300/80 hover:border-base-300",
        )}
      >
        <Server
          className={clsx("w-3.5 h-3.5 transition-colors", proxyActive ? "text-success" : "text-base-content/20")}
        />
        <span className="uppercase tracking-widest whitespace-nowrap">
          {proxyActive
            ? lang === "ko"
              ? "프록시 활성"
              : "Proxy Active"
            : lang === "ko"
              ? "프록시 비활성"
              : "Proxy Inactive"}
        </span>
        <div
          className={clsx(
            "w-2 h-2 rounded-full",
            proxyActive ? "bg-success animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-base-content/20",
          )}
        />
      </div>
    </Link>
  );
}

// ── QuickActions ─────────────────────────────────────────────────────────────

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

interface QuickActionsCardProps {
  actions: QuickAction[];
  title: string;
}

export function QuickActionsCard({ actions, title }: QuickActionsCardProps) {
  return (
    <Card className="p-6 bg-base-100 shadow-sm border-base-200">
      <h2 className="font-black text-base-content mb-6 tracking-tight uppercase text-xs opacity-40">{title}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {actions.map((action) => (
          <Link key={action.href} to={action.href}>
            <div className="flex flex-col gap-4 p-5 rounded-2xl border border-base-200 hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer h-full shadow-sm hover:shadow-md">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3 ${action.color}`}
              >
                {action.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-base-content group-hover:text-primary transition-colors">
                  {action.label}
                </p>
                <p className="text-xs text-base-content/40 leading-relaxed mt-1 font-medium italic">
                  {action.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

// ── Helper: build quick stats ─────────────────────────────────────────────────

export function buildQuickStats(
  domainCount: number | null,
  apiLoggingCount: number | null,
  proxyRunning: boolean | null,
  proxyLocalRouting: boolean | null,
  todayApiCount: number,
  lang: "ko" | "en",
): QuickStat[] {
  const ko = lang === "ko";
  return [
    {
      label: ko ? "등록된 도메인" : "Domains",
      value: domainCount ?? "—",
      icon: <Globe className="w-5 h-5" />,
      href: "/domains/dashboard",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: ko ? "API 로깅 도메인" : "API Logging",
      value: apiLoggingCount ?? "—",
      icon: <Wifi className="w-5 h-5" />,
      href: "/apis/dashboard",
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      label: ko ? "오늘 API 요청" : "Today's Requests",
      value: todayApiCount,
      icon: <History className="w-5 h-5" />,
      href: "/apis/logs",
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: ko ? "프록시 상태" : "Proxy Status",
      value:
        proxyRunning === null
          ? "—"
          : !proxyRunning
            ? ko
              ? "중지됨"
              : "Stopped"
            : proxyLocalRouting
              ? ko
                ? "활성"
                : "Active"
              : ko
                ? "비활성"
                : "Inactive",
      icon: proxyRunning && proxyLocalRouting ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />,
      href: "/proxy/dashboard",
      color: proxyRunning && proxyLocalRouting ? "text-success" : "text-base-content/30",
      bg: proxyRunning && proxyLocalRouting ? "bg-success/10" : "bg-base-content/5",
    },
  ];
}
