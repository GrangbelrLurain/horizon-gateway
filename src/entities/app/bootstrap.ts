import { listen } from "@tauri-apps/api/event";
import { useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { domainsAtom, fetchDomains } from "@/entities/domain";
import { apiLoggingLinksAtom, fetchApiLoggingLinks } from "@/entities/domain-api-logging";
import { fetchInspectorEnabled, inspectorEnabledAtom } from "@/entities/inspector";
import { fetchMockingEnabled, mockingEnabledAtom } from "@/entities/mocking";
import { fetchProxyStatus, proxyStatusAtom } from "@/entities/proxy";
import { appStatusLoadedAtom, appStatusLoadingAtom } from "./status/store";

export function useAppBootstrap() {
  const setDomains = useSetAtom(domainsAtom);
  const setApiLoggingLinks = useSetAtom(apiLoggingLinksAtom);
  const setProxyStatus = useSetAtom(proxyStatusAtom);
  const setMockingEnabled = useSetAtom(mockingEnabledAtom);
  const setInspectorEnabled = useSetAtom(inspectorEnabledAtom);
  const setLoading = useSetAtom(appStatusLoadingAtom);
  const setLoaded = useSetAtom(appStatusLoadedAtom);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [domains, links, proxy, mocking, inspector] = await Promise.all([
        fetchDomains(),
        fetchApiLoggingLinks(),
        fetchProxyStatus(),
        fetchMockingEnabled(),
        fetchInspectorEnabled(),
      ]);
      setDomains(domains);
      setApiLoggingLinks(links);
      setProxyStatus(proxy);
      setMockingEnabled(mocking);
      setInspectorEnabled(inspector);
      setLoaded(true);
    } catch (e) {
      console.error("useAppBootstrap:", e);
    } finally {
      setLoading(false);
    }
  }, [setDomains, setApiLoggingLinks, setProxyStatus, setMockingEnabled, setInspectorEnabled, setLoading, setLoaded]);

  useEffect(() => {
    void refresh();

    const unlistenProxy = listen<{ running: boolean; local_routing_enabled: boolean }>(
      "proxy-status-changed",
      (event) => {
        if (event.payload) {
          setProxyStatus((prev) => ({
            running: event.payload.running,
            local_routing_enabled: event.payload.local_routing_enabled,
            port: prev?.port ?? null,
            reverse_http_port: prev?.reverse_http_port ?? null,
            reverse_https_port: prev?.reverse_https_port ?? null,
          }));
        }
      },
    );

    const unlistenMocking = listen<{ enabled: boolean }>("mocking-status-changed", (event) => {
      if (event.payload) {
        setMockingEnabled(event.payload.enabled);
      }
    });

    const interval = setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      clearInterval(interval);
      void unlistenProxy.then((fn) => fn());
      void unlistenMocking.then((fn) => fn());
    };
  }, [refresh, setProxyStatus, setMockingEnabled]);

  return { refresh };
}
