import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, FlaskConical, History } from "lucide-react";
import type { MockRule } from "@/entities/mocking";
import { Card } from "@/shared/ui/card/card";
import type { RecentApiLog, RecentMonitorItem } from "../types";

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
