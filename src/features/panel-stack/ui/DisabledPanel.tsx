import { useAtomValue } from "jotai";
import { Loader2, Lock } from "lucide-react";
import { languageAtom } from "@/entities/app";
import type { Domain } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { getPanelIcon } from "../lib/panelIcons";
import type { PanelId } from "../types";
import { Panel } from "./Panel";

interface DisabledPanelProps {
  panelId: PanelId;
  domain: Domain;
  onClose: () => void;
}

// biome-ignore lint/suspicious/noExplicitAny: type safety compatibility with translation schemas
const PANEL_TITLES: Record<PanelId, (t: any) => string> = {
  overview: (t) => t.overview,
  monitor: (t) => t.monitorTitle,
  proxy: (t) => t.proxyTitle,
  api: (t) => t.apiTitle,
  "api/logs": (t) => t.apiLogs,
  "api/log": (t) => t.apiLogDetail,
  "api/mocking": (t) => t.apiMocking,
  "api/schema": (t) => t.apiSchema,
  debug: (t) => t.debugTitle,
};

export function DisabledPanel({ panelId, domain, onClose }: DisabledPanelProps) {
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

  const host = getDomainHost(domain);
  const title = PANEL_TITLES[panelId]?.(t) ?? panelId;
  const icon = getPanelIcon(panelId);

  const isMonitor = panelId === "monitor";
  const toggle = isMonitor ? toggles.monitor : toggles.api;

  const handleEnable = async () => {
    await toggle.toggle(true);
  };

  const IconComponent = icon;

  return (
    <Panel id={panelId} title={title} subtitle={host} onClose={onClose} width="md">
      <div className="flex flex-col items-center justify-center h-[80%] text-center p-6 space-y-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center text-base-content/30">
            {IconComponent ? <IconComponent className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-warning flex items-center justify-center text-warning-content border-2 border-base-100 shadow-md">
            <Lock className="w-3 h-3" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-black text-base-content">
            {lang === "ko" ? "기능 비활성 상태" : "Feature Inactive"}
          </h3>
          <p className="text-xs text-base-content/50 max-w-[240px] leading-relaxed">
            {isMonitor ? t.monitorEnableHint : t.apiEnableHint}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          className="font-bold gap-2 h-9 px-4 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          onClick={handleEnable}
          disabled={toggle.loading}
        >
          {toggle.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.bulkTurnOn}
        </Button>
      </div>
    </Panel>
  );
}
