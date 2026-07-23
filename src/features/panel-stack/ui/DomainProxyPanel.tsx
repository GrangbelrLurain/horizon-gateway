import { useAtomValue } from "jotai";
import { Server } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { ProxyRouteModal } from "@/entities/domain";
import type { Domain } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { usePanelNavigation } from "../hooks/usePanelNavigation";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { FeaturePanelToggle } from "./FeaturePanelToggle";
import { Panel } from "./Panel";

interface DomainProxyPanelProps {
  domain: Domain;
  onClose: () => void;
}

export function DomainProxyPanel({ domain, onClose }: DomainProxyPanelProps) {
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
    <Panel id="proxy" title={t.proxyTitle} subtitle={host} onClose={onClose} width="md">
      <FeaturePanelToggle
        label={t.proxy}
        checked={toggles.proxy.checked}
        loading={toggles.proxy.loading}
        onChange={toggles.proxy.toggle}
      />
      <p className="text-xs text-base-content/50 mb-4">{t.proxyGraphDesc}</p>
      <Button
        variant="primary"
        size="sm"
        className="w-full gap-2"
        onClick={() => nav.openGlobalSurface("global/proxy-graph")}
      >
        <Server className="w-4 h-4" />
        {t.openProxyPanel}
      </Button>

      {toggles.proxy.showModal && (
        <ProxyRouteModal
          domainId={domain.id}
          domainUrl={domain.url}
          t={t}
          onClose={() => toggles.proxy.setShowModal(false)}
          onAdded={() => {
            toggles.proxy.setShowModal(false);
            void fetchAll();
          }}
        />
      )}
    </Panel>
  );
}
