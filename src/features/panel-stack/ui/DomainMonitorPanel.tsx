import { useAtomValue } from "jotai";
import { Activity } from "lucide-react";
import { languageAtom } from "@/entities/app";
import type { Domain } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { usePanelNavigation } from "../hooks/usePanelNavigation";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { FeaturePanelToggle } from "./FeaturePanelToggle";
import { Panel } from "./Panel";

interface DomainMonitorPanelProps {
  domain: Domain;
  onClose: () => void;
}

export function DomainMonitorPanel({ domain, onClose }: DomainMonitorPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const nav = usePanelNavigation();
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

  return (
    <Panel id="monitor" title={t.monitorTitle} subtitle={host} onClose={onClose} width="md">
      <FeaturePanelToggle
        label={t.monitor}
        checked={toggles.monitor.checked}
        loading={toggles.monitor.loading}
        onChange={toggles.monitor.toggle}
      />
      <p className="text-xs text-base-content/50 mb-4">{t.monitorManageDesc}</p>
      <Button
        variant="primary"
        size="sm"
        className="w-full gap-2"
        onClick={() => nav.openGlobalSurface("global/monitor")}
      >
        <Activity className="w-4 h-4" />
        {t.openMonitorPanel}
      </Button>
    </Panel>
  );
}
