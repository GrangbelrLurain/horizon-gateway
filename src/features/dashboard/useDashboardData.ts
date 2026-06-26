import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { domainCountAtom } from "@/entities/app";
import type { MockRule } from "@/entities/mocking";
import { getMockRules } from "@/entities/mocking";
import { commands, unwrap } from "@/shared/api";
import type { DashboardData, RecentApiLog, RecentMonitorItem } from "./types";

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
