import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowRight, Globe } from "lucide-react";
import { useCallback } from "react";
import { languageAtom } from "@/entities/app";
import type { Domain } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { usePanelNavigation } from "../hooks/usePanelNavigation";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { domainListOverlayOpenAtom, hubApiLogsHostSeedAtom } from "../store";
import type { PanelId } from "../types";

interface HubContextBarProps {
  domain: Domain;
}

function FeatureChip({
  label,
  short,
  active,
  onClick,
}: {
  label: string;
  short: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}: ${active ? "ON" : "OFF"}`}
      className={clsx(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black transition-colors",
        active
          ? "bg-success/15 text-success hover:bg-success/25"
          : "bg-base-300/50 text-base-content/40 hover:bg-base-300",
      )}
    >
      <span className="opacity-70">{short}</span>
      {active && <span className="w-1 h-1 rounded-full bg-success" />}
    </button>
  );
}

function getDomainLabel(domain: Domain) {
  try {
    const u = new URL(domain.url.startsWith("http") ? domain.url : `https://${domain.url}`);
    return u.hostname;
  } catch {
    return domain.url;
  }
}

export function HubContextBar({ domain }: HubContextBarProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const nav = usePanelNavigation();
  const { getFeatureState, getDomainHost } = useDomainHubData();
  const setDomainListOverlay = useSetAtom(domainListOverlayOpenAtom);
  const setApiLogsHostSeed = useSetAtom(hubApiLogsHostSeedAtom);
  const featureState = getFeatureState(domain.id);
  const host = getDomainHost(domain);
  const label = getDomainLabel(domain);

  const openFeaturePanel = useCallback(
    (panelId: PanelId) => {
      nav.openPanel(panelId);
    },
    [nav],
  );

  const handleOpenGlobalLogs = useCallback(() => {
    setApiLogsHostSeed(host);
    nav.openGlobalSurface("global/api-logs");
  }, [host, nav, setApiLogsHostSeed]);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-base-300 bg-base-100/90 shrink-0 min-h-[34px]">
      <button
        type="button"
        onClick={() => setDomainListOverlay(true)}
        className="inline-flex items-center gap-1.5 min-w-0 text-left hover:text-primary transition-colors"
        title={t.contextBarShowDomainList}
      >
        <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-black truncate max-w-[200px]">{label}</span>
      </button>

      <span className="text-base-content/20 text-xs">·</span>

      <div className="flex items-center gap-1">
        <FeatureChip
          short="M"
          label={t.featureBadgeMonitor}
          active={featureState.monitorEnabled === true}
          onClick={() => openFeaturePanel("monitor")}
        />
        <FeatureChip
          short="P"
          label={t.featureBadgeProxy}
          active={featureState.proxyEnabled === true}
          onClick={() => openFeaturePanel("proxy")}
        />
        <FeatureChip
          short="A"
          label={t.featureBadgeApi}
          active={featureState.apiLoggingEnabled === true}
          onClick={() => openFeaturePanel("api")}
        />
      </div>

      <div className="flex-1" />

      {featureState.apiLoggingEnabled && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[10px] font-bold shrink-0"
          onClick={handleOpenGlobalLogs}
        >
          {t.contextBarGlobalLogs}
          <ArrowRight className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
