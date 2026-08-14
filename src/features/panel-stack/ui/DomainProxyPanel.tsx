import { useAtomValue } from "jotai";
import { Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { languageAtom } from "@/entities/app";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { reportError } from "@/shared/ui/toast";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { usePanelNavigation } from "../hooks/usePanelNavigation";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { FeaturePanelToggle } from "./FeaturePanelToggle";
import { Panel } from "./Panel";

const DEFAULT_TARGET_HOST = "127.0.0.1";

interface DomainProxyPanelProps {
  domain: Domain;
  onClose: () => void;
}

function parseTargetPort(value: string): number | null {
  const portNum = Number(value);
  if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return null;
  }
  return portNum;
}

export function DomainProxyPanel({ domain, onClose }: DomainProxyPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const nav = usePanelNavigation();
  const { getFeatureState, getDomainHost, getProxyRoute, fetchAll } = useDomainHubData();
  const featureState = getFeatureState(domain.id);
  const localRoute = getProxyRoute(domain);
  const toggles = useDomainFeatureToggles({
    domainId: domain.id,
    domainUrl: domain.url,
    state: featureState,
    onRefresh: fetchAll,
  });
  const host = getDomainHost(domain);
  const portInputRef = useRef<HTMLInputElement>(null);

  const [targetHost, setTargetHost] = useState(localRoute?.targetHost ?? DEFAULT_TARGET_HOST);
  const [targetPort, setTargetPort] = useState(localRoute ? String(localRoute.targetPort) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!localRoute) {
      return;
    }
    setTargetHost(localRoute.targetHost);
    setTargetPort(String(localRoute.targetPort));
  }, [localRoute]);

  const hostTrimmed = targetHost.trim();
  const portNum = parseTargetPort(targetPort);
  const isValid = Boolean(hostTrimmed) && portNum != null;
  const isDirty = !localRoute || hostTrimmed !== localRoute.targetHost || portNum !== localRoute.targetPort;

  const persistRoute = async () => {
    if (!isValid || portNum == null) {
      return false;
    }
    if (localRoute) {
      await commands
        .updateLocalRoute({
          id: localRoute.id,
          targetHost: hostTrimmed,
          targetPort: portNum,
          enabled: null,
        })
        .then(unwrap);
    } else {
      await commands
        .addLocalRoute({
          domainId: domain.id,
          targetHost: hostTrimmed,
          targetPort: portNum,
        })
        .then(unwrap);
    }
    await fetchAll();
    await notifyHubDataChanged("routes");
    return true;
  };

  const handleSave = async () => {
    if (!isValid || !isDirty) {
      return;
    }
    setSaving(true);
    try {
      await persistRoute();
    } catch (e) {
      reportError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    if (!localRoute && enabled) {
      if (!isValid) {
        portInputRef.current?.focus();
        return;
      }
      setSaving(true);
      try {
        await persistRoute();
      } catch (e) {
        reportError(e);
      } finally {
        setSaving(false);
      }
      return;
    }
    await toggles.proxy.toggle(enabled);
  };

  return (
    <Panel id="proxy" title={t.localDestination} subtitle={host} onClose={onClose} width="md">
      <FeaturePanelToggle
        label={t.localDestination}
        checked={toggles.proxy.checked}
        loading={toggles.proxy.loading || saving}
        onChange={handleToggle}
      />
      <p className="text-xs text-base-content/50 mb-4">{t.localDestinationHint}</p>

      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <label htmlFor="local-destination-host" className="text-[10px] font-bold uppercase text-base-content/50">
              {t.proxyRouteTargetHost}
            </label>
            <Input
              id="local-destination-host"
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              placeholder={DEFAULT_TARGET_HOST}
              className="h-9 text-xs font-mono"
            />
          </div>
          <div className="w-[7.5rem] shrink-0 space-y-1">
            <label htmlFor="local-destination-port" className="text-[10px] font-bold uppercase text-base-content/50">
              {t.proxyRouteTargetPort}
            </label>
            <Input
              ref={portInputRef}
              id="local-destination-port"
              type="number"
              min={1}
              max={65535}
              value={targetPort}
              onChange={(e) => setTargetPort(e.target.value)}
              placeholder="3000"
              className="h-9 text-xs font-mono"
            />
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => void handleSave()}
          disabled={saving || !isValid || !isDirty}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : localRoute ? t.proxyRouteSave : t.proxyRouteAdd}
        </Button>
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full gap-2"
        onClick={() => nav.openGlobalSurface("global/proxy-graph")}
      >
        <MapPin className="w-4 h-4" />
        {t.openProxyPanel}
      </Button>
    </Panel>
  );
}
