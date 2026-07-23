import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { FileText, FlaskConical, History, Wifi } from "lucide-react";
import { languageAtom } from "@/entities/app";
import type { Domain } from "@/shared/api";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { usePanelNavigation } from "../hooks/usePanelNavigation";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { hubApiLogsHostSeedAtom } from "../store";
import type { PanelId } from "../types";
import { FeaturePanelToggle } from "./FeaturePanelToggle";
import { Panel } from "./Panel";

interface DomainApiPanelProps {
  domain: Domain;
  onClose: () => void;
  onOpenPanel: (id: PanelId) => void;
  activeSection?: PanelId;
}

export function DomainApiPanel({ domain, onClose, onOpenPanel, activeSection }: DomainApiPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const nav = usePanelNavigation();
  const setApiLogsHostSeed = useSetAtom(hubApiLogsHostSeedAtom);
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

  const logSections: { id: PanelId; label: string; icon: React.ReactNode }[] = [
    { id: "api/logs", label: t.apiLogs, icon: <History className="w-4 h-4" /> },
    { id: "api/schema", label: t.apiSchema, icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <Panel id="api" title={t.apiTitle} subtitle={host} onClose={onClose} width="sm">
      <FeaturePanelToggle
        label={t.api}
        checked={toggles.api.checked}
        loading={toggles.api.loading}
        onChange={toggles.api.toggle}
      />

      {toggles.api.checked && (
        <FeaturePanelToggle
          label={t.apiBodyLogging}
          checked={toggles.api.bodyChecked ?? false}
          loading={toggles.api.bodyLoading}
          onChange={toggles.api.toggleBody}
        />
      )}

      <div className="space-y-1 mb-4">
        <button
          type="button"
          onClick={() => {
            setApiLogsHostSeed(host);
            nav.openGlobalSurface("global/api-logs");
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-base-200 border border-transparent"
        >
          <Wifi className="w-4 h-4 text-base-content/50" />
          <span className="text-xs font-bold">{t.openApiPanel}</span>
        </button>
        <button
          type="button"
          onClick={() => nav.openGlobalSurface("global/mocking")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-base-200 border border-transparent"
        >
          <FlaskConical className="w-4 h-4 text-base-content/50" />
          <span className="text-xs font-bold">{t.apiMocking}</span>
        </button>
      </div>

      {!toggles.api.checked ? (
        <p className="text-xs text-base-content/50">{t.apiEnableHint}</p>
      ) : (
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2">
            {t.apiSelectSection}
          </p>
          {logSections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpenPanel(s.id)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                activeSection === s.id
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "hover:bg-base-200 border border-transparent",
              )}
            >
              {s.icon}
              <span className="text-xs font-bold">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
