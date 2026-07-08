import { useAtomValue } from "jotai";
import { Server, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { languageAtom, proxyLocalRoutingEnabledAtom, proxyRunningAtom } from "@/entities/app";
import { ProxyRouteModal } from "@/entities/domain";
import { openPopupWindow } from "@/features/popup-window";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { ConfirmModal } from "@/shared/ui/modal/ConfirmModal";
import { useDomainFeatureToggles } from "../hooks/useDomainFeatureToggles";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { Panel } from "./Panel";

interface DomainProxyPanelProps {
  domain: Domain;
  onClose: () => void;
}

export function DomainProxyPanel({ domain, onClose }: DomainProxyPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const { getDomainHost, getProxyRoute, getFeatureState, proxyActive, fetchAll } = useDomainHubData();
  const proxyRunning = useAtomValue(proxyRunningAtom);
  const localRoutingEnabled = useAtomValue(proxyLocalRoutingEnabledAtom);
  const featureState = getFeatureState(domain.id);
  const toggles = useDomainFeatureToggles({
    domainId: domain.id,
    domainUrl: domain.url,
    state: featureState,
    proxyActive,
    onRefresh: fetchAll,
  });
  const host = getDomainHost(domain);
  const route = getProxyRoute(domain);
  const [targetHost, setTargetHost] = useState("localhost");
  const [targetPort, setTargetPort] = useState("3000");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (route) {
      setTargetHost(route.targetHost);
      setTargetPort(String(route.targetPort));
    }
  }, [route]);

  const handleAddRoute = async () => {
    const port = Number(targetPort);
    if (!targetHost.trim() || Number.isNaN(port)) {
      return;
    }
    setSaving(true);
    try {
      await commands
        .addLocalRoute({ domainId: domain.id, targetHost: targetHost.trim(), targetPort: port })
        .then(unwrap);
      await fetchAll();
      await notifyHubDataChanged("routes");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRoute = async () => {
    if (!route) {
      return;
    }
    const port = Number(targetPort);
    if (!targetHost.trim() || Number.isNaN(port)) {
      return;
    }
    setSaving(true);
    try {
      await commands
        .updateLocalRoute({
          id: route.id,
          targetHost: targetHost.trim(),
          targetPort: port,
          enabled: null,
        })
        .then(unwrap);
      await fetchAll();
      await notifyHubDataChanged("routes");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (!route) {
      return;
    }
    setSaving(true);
    try {
      await commands.removeLocalRoute({ id: route.id }).then(unwrap);
      setTargetHost("localhost");
      setTargetPort("3000");
      await fetchAll();
      await notifyHubDataChanged("routes");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <Panel id="proxy" title={t.proxyTitle} subtitle={host} onClose={onClose} width="md">
      {!proxyRunning ? (
        <div className="space-y-3">
          <p className="text-xs text-base-content/50">{t.proxyGlobalOff}</p>
          <Button variant="primary" size="sm" onClick={() => void openPopupWindow("infrastructure")}>
            {t.proxyOpenInfra}
          </Button>
        </div>
      ) : !localRoutingEnabled ? (
        <div className="space-y-3">
          <p className="text-xs text-base-content/50">{t.proxyLocalRoutingOff}</p>
          <Button variant="primary" size="sm" onClick={() => void openPopupWindow("infrastructure")}>
            {t.proxyOpenInfra}
          </Button>
        </div>
      ) : route ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-base-300 bg-base-200/30 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t.proxyRoute}</p>
            <p className="text-sm font-mono font-bold text-base-content">{host}</p>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-base-content/50 uppercase">{t.proxyTarget}</label>
              <Input
                value={targetHost}
                onChange={(e) => setTargetHost(e.target.value)}
                placeholder="localhost"
                className="h-9 text-xs"
              />
              <Input
                value={targetPort}
                onChange={(e) => setTargetPort(e.target.value)}
                placeholder="3000"
                type="number"
                className="h-9 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" className="gap-1.5" onClick={handleUpdateRoute} disabled={saving}>
                <Server className="w-3.5 h-3.5" />
                {saving ? t.proxyRouteSaving : t.proxyRouteSave}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 text-error"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.proxyRouteDelete}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-base-content/40">{t.proxyRouteToggleHint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-base-content/50">{t.proxyNoRoute}</p>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-base-content/50 uppercase">{t.proxyTarget}</label>
            <Input
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              placeholder="localhost"
              className="h-9 text-xs"
            />
            <Input
              value={targetPort}
              onChange={(e) => setTargetPort(e.target.value)}
              placeholder="3000"
              type="number"
              className="h-9 text-xs"
            />
          </div>
          <Button variant="primary" size="sm" className="gap-1.5" onClick={handleAddRoute} disabled={saving}>
            <Server className="w-3.5 h-3.5" />
            {t.proxyRouteAdd}
          </Button>
        </div>
      )}

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

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteRoute}
        title={t.proxyRouteDelete}
        message={t.proxyRouteDeleteConfirm}
        confirmText={t.proxyRouteDelete}
        cancelText={t.proxyRouteCancel}
        type="danger"
      />
    </Panel>
  );
}
