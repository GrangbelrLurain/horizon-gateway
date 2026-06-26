import { CheckCircle2, Globe, History, Wifi, XCircle } from "lucide-react";
import type { QuickStat } from "./types";

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
