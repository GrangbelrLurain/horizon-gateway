import { useAtomValue } from "jotai";
import { useRef, useState } from "react";
import type { DomainFeatureState } from "@/entities/domain";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import { openPopupWindow } from "@/features/popup-window";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";

interface UseDomainFeatureTogglesOptions {
  domainId: number;
  domainUrl: string;
  state: DomainFeatureState;
  proxyActive: boolean;
  onRefresh: () => void;
}

export function useDomainFeatureToggles({
  domainId,
  domainUrl,
  state,
  proxyActive,
  onRefresh,
}: UseDomainFeatureTogglesOptions) {
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [showProxyModal, setShowProxyModal] = useState(false);
  const apiLinks = useAtomValue(apiLoggingLinksAtom);
  const preservedApiRef = useRef<{ schemaUrl: string | null; bodyEnabled: boolean } | null>(null);

  const toggleMonitor = async (enabled: boolean) => {
    setMonitorLoading(true);
    try {
      await commands.setDomainMonitorCheckEnabled({ domainIds: [domainId], enabled }).then(unwrap);
      onRefresh();
      await notifyHubDataChanged("features");
    } catch (e) {
      console.error(e);
    } finally {
      setMonitorLoading(false);
    }
  };

  const toggleApiLogging = async (enabled: boolean) => {
    setApiLoading(true);
    try {
      if (!enabled) {
        const link = apiLinks.find((l) => l.domainId === domainId);
        if (link) {
          preservedApiRef.current = {
            schemaUrl: link.schemaUrl ?? null,
            bodyEnabled: link.bodyEnabled ?? false,
          };
        }
        await commands.removeDomainApiLogging({ domainId }).then(unwrap);
      } else {
        const preserved = preservedApiRef.current;
        await commands
          .setDomainApiLogging({
            domainId,
            loggingEnabled: true,
            bodyEnabled: preserved?.bodyEnabled ?? false,
            schemaUrl: preserved?.schemaUrl ?? null,
          })
          .then(unwrap);
        preservedApiRef.current = null;
      }
      onRefresh();
      await notifyHubDataChanged("features");
    } catch (e) {
      console.error(e);
    } finally {
      setApiLoading(false);
    }
  };

  const toggleBodyLogging = async (enabled: boolean) => {
    setBodyLoading(true);
    try {
      const link = apiLinks.find((l) => l.domainId === domainId);
      await commands
        .setDomainApiLogging({
          domainId,
          loggingEnabled: link?.loggingEnabled ?? true,
          bodyEnabled: enabled,
          schemaUrl: link?.schemaUrl ?? null,
        })
        .then(unwrap);
      onRefresh();
      await notifyHubDataChanged("features");
    } catch (e) {
      console.error(e);
    } finally {
      setBodyLoading(false);
    }
  };

  const toggleProxy = async (enabled: boolean) => {
    if (!proxyActive) {
      void openPopupWindow("infrastructure");
      return;
    }

    if (state.proxyRouteId === undefined) {
      if (enabled) {
        setShowProxyModal(true);
      }
      return;
    }

    setProxyLoading(true);
    try {
      await commands
        .updateLocalRoute({
          id: state.proxyRouteId,
          targetHost: null,
          targetPort: null,
          enabled,
        })
        .then(unwrap);
      onRefresh();
      await notifyHubDataChanged("routes");
    } catch (e) {
      console.error(e);
    } finally {
      setProxyLoading(false);
    }
  };

  const proxyChecked = proxyActive && state.proxyEnabled === true;

  return {
    monitor: {
      checked: state.monitorEnabled === true,
      loading: monitorLoading,
      toggle: toggleMonitor,
    },
    proxy: {
      checked: proxyChecked,
      loading: proxyLoading,
      toggle: toggleProxy,
      needsRoute: state.proxyRouteId === undefined,
      showModal: showProxyModal,
      setShowModal: setShowProxyModal,
      domainUrl,
    },
    api: {
      checked: state.apiLoggingEnabled === true,
      loading: apiLoading,
      toggle: toggleApiLogging,
      bodyChecked: apiLinks.find((l) => l.domainId === domainId)?.bodyEnabled === true,
      bodyLoading,
      toggleBody: toggleBodyLogging,
    },
  };
}
