import type { MockRule } from "@/entities/mocking";

export interface QuickStat {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  href: string;
  color: string;
  bg: string;
}

export interface SetupStep {
  label: string;
  done: boolean;
  href: string;
  actionLabel: string;
}

export interface RecentMonitorItem {
  url: string;
  level: string;
  latency?: number;
}

export interface RecentApiLog {
  id: string;
  method: string;
  path: string;
  status_code: number | null;
  timestamp: string;
}

export interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

export interface DashboardData {
  monitorItems: RecentMonitorItem[];
  apiLogs: RecentApiLog[];
  todayCount: number;
  mockRules: MockRule[];
}
