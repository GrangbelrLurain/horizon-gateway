import { createFileRoute } from "@tanstack/react-router";
import { getVersion } from "@tauri-apps/api/app";
import { useAtom, useAtomValue } from "jotai";
import { BookOpen, History, Plus, Server } from "lucide-react";
import { useEffect, useState } from "react";
import {
  apiLoggingCountAtom,
  domainCountAtom,
  languageAtom,
  proxyLocalRoutingEnabledAtom,
  proxyMockingEnabledAtom,
  proxyRunningAtom,
} from "@/entities/app";
import { ProxyServerWarning, setupDismissedAtom } from "@/entities/proxy";
import {
  buildQuickStats,
  QuickActionsCard,
  QuickStatsRow,
  RecentActivityGrid,
  SetupProgressCard,
  useDashboardData,
} from "@/features/dashboard";
import { commands, unwrap } from "@/shared/api";
import { Badge } from "@/shared/ui/badge/badge";
import { StatusToggle } from "@/shared/ui/status-toggle/StatusToggle";
import { en } from "./en";
import { ko } from "./ko";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [version, setVersion] = useState("");
  const langKey = useAtomValue(languageAtom);
  const t = langKey === "ko" ? ko : en;

  const domainCount = useAtomValue(domainCountAtom);
  const apiLoggingCount = useAtomValue(apiLoggingCountAtom);
  const proxyRunning = useAtomValue(proxyRunningAtom);
  const proxyLocalRouting = useAtomValue(proxyLocalRoutingEnabledAtom);
  const [mockingEnabled, setMockingEnabled] = useAtom(proxyMockingEnabledAtom);

  const [setupDismissed, setSetupDismissed] = useAtom(setupDismissedAtom);
  const [mockingLoading, setMockingLoading] = useState(false);
  const [proxyRoutingLoading, setProxyRoutingLoading] = useState(false);
  const { monitorItems, apiLogs, todayCount, mockRules } = useDashboardData();

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);

  const toggleMocking = async (enabled: boolean) => {
    if (mockingEnabled === null) {
      return;
    }
    setMockingLoading(true);
    try {
      const res = await commands.setMockingEnabled({ enabled }).then(unwrap);
      if (res.success) {
        setMockingEnabled(enabled);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMockingLoading(false);
    }
  };

  const toggleProxyLocalRouting = async (enabled: boolean) => {
    setProxyRoutingLoading(true);
    try {
      await commands.setLocalRoutingEnabled({ enabled }).then(unwrap);
    } catch (e) {
      console.error("set_local_routing_enabled:", e);
    } finally {
      setProxyRoutingLoading(false);
    }
  };

  // ── Setup progress ──────────────────────────────────────────────────────────
  const setupSteps = [
    {
      label: t.step1Label,
      done: (domainCount ?? 0) > 0,
      href: "/domains/regist",
      actionLabel: t.step1Action,
    },
    {
      label: t.step2Label,
      done: !!(proxyRunning && proxyLocalRouting),
      href: "/proxy/dashboard",
      actionLabel: t.step2Action,
    },
    {
      label: t.step3Label,
      done: (apiLoggingCount ?? 0) > 0,
      href: "/apis/settings",
      actionLabel: t.step3Action,
    },
  ];

  // Auto-set setup dismissed if all steps completed
  useEffect(() => {
    const allDone = (domainCount ?? 0) > 0 && !!(proxyRunning && proxyLocalRouting) && (apiLoggingCount ?? 0) > 0;
    if (allDone && !setupDismissed) {
      setSetupDismissed(true);
    }
  }, [domainCount, proxyRunning, proxyLocalRouting, apiLoggingCount, setupDismissed, setSetupDismissed]);

  // ── Quick stats ─────────────────────────────────────────────────────────────
  const stats = buildQuickStats(domainCount, apiLoggingCount, proxyRunning, proxyLocalRouting, todayCount, langKey);

  // ── Quick actions ───────────────────────────────────────────────────────────
  const quickActions = [
    {
      label: t.qa1Label,
      description: t.qa1Desc,
      href: "/domains/regist",
      icon: <Plus className="w-4 h-4" />,
      color: "bg-primary/10 text-primary",
    },
    {
      label: t.qa2Label,
      description: t.qa2Desc,
      href: "/apis/logs",
      icon: <History className="w-4 h-4" />,
      color: "bg-secondary/10 text-secondary",
    },
    {
      label: t.qa3Label,
      description: t.qa3Desc,
      href: "/apis/schema",
      icon: <BookOpen className="w-4 h-4" />,
      color: "bg-accent/10 text-accent",
    },
    {
      label: t.qa4Label,
      description: t.qa4Desc,
      href: "/proxy/setup",
      icon: <Server className="w-4 h-4" />,
      color: "bg-base-300 text-base-content/60",
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ── */}
      <header className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl tablet:text-3xl font-black text-base-content tracking-tight">{t.title}</h1>
            {version && (
              <Badge variant={{ color: "blue" }} className="bg-primary/10 text-primary border-primary/20">
                v{version}
              </Badge>
            )}
          </div>
          <p className="text-base-content/60 text-xs tablet:text-sm">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusToggle
            label={langKey === "ko" ? "모킹" : "Mocking"}
            checked={!!mockingEnabled}
            onChange={toggleMocking}
            loading={mockingLoading}
            icon={<Server className="w-3.5 h-3.5" />}
          />
          <StatusToggle
            label={langKey === "ko" ? "프록시 활성" : "Proxy Active"}
            checked={!!(proxyRunning && proxyLocalRouting)}
            onChange={toggleProxyLocalRouting}
            loading={proxyRoutingLoading}
            disabled={!proxyRunning}
            icon={<Server className="w-3.5 h-3.5" />}
          />
        </div>
      </header>

      <ProxyServerWarning />

      {/* ── Setup Progress Card (disappears when all done or dismissed) ── */}
      {!setupDismissed && (
        <SetupProgressCard steps={setupSteps} lang={langKey} onDismiss={() => setSetupDismissed(true)} />
      )}

      {/* ── Quick Stats ── */}
      <QuickStatsRow stats={stats} />

      {/* ── Recent Activity ── */}
      <RecentActivityGrid monitorItems={monitorItems} apiLogs={apiLogs} mockRules={mockRules} lang={langKey} />

      {/* ── Quick Actions ── */}
      <QuickActionsCard actions={quickActions} title={t.quickActionsTitle} />
    </div>
  );
}
