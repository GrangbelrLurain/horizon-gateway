import { listen } from "@tauri-apps/api/event";
import { useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { domainsAtom, fetchDomains } from "@/entities/domain";
import { apiLoggingLinksAtom, fetchApiLoggingLinks } from "@/entities/domain-api-logging";
import { fetchInspectorEnabled, inspectorEnabledAtom } from "@/entities/inspector";
import { fetchMockingEnabled, mockingEnabledAtom } from "@/entities/mocking";
import { savedPipelinesAtom } from "@/entities/pipeline";
import { fetchProxyStatus, proxyStatusAtom } from "@/entities/proxy";
import {
  migrateSandboxLibrariesFromLocalStorage,
  savedCryptoPresetsAtom,
  savedJsonSchemasAtom,
} from "@/entities/sandbox";
import { HUB_DATA_CHANGED } from "@/shared/lib/tauri/hubEvents";
import { appStatusLoadedAtom, appStatusLoadingAtom } from "./status/store";

export function useAppBootstrap() {
  const setDomains = useSetAtom(domainsAtom);
  const setApiLoggingLinks = useSetAtom(apiLoggingLinksAtom);
  const setProxyStatus = useSetAtom(proxyStatusAtom);
  const setMockingEnabled = useSetAtom(mockingEnabledAtom);
  const setInspectorEnabled = useSetAtom(inspectorEnabledAtom);
  const setSavedPipelines = useSetAtom(savedPipelinesAtom);
  const setSavedJsonSchemas = useSetAtom(savedJsonSchemasAtom);
  const setSavedCryptoPresets = useSetAtom(savedCryptoPresetsAtom);
  const setLoading = useSetAtom(appStatusLoadingAtom);
  const setLoaded = useSetAtom(appStatusLoadedAtom);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [domains, links, proxy, mocking, inspector, sandboxLibs] = await Promise.all([
        fetchDomains(),
        fetchApiLoggingLinks(),
        fetchProxyStatus(),
        fetchMockingEnabled(),
        fetchInspectorEnabled(),
        migrateSandboxLibrariesFromLocalStorage(),
      ]);
      setDomains(domains);
      setApiLoggingLinks(links);
      setProxyStatus(proxy);
      setMockingEnabled(mocking);
      setInspectorEnabled(inspector);
      setSavedPipelines(
        sandboxLibs.pipelines.map((p) => ({
          ...p,
          createdAt: p.createdAt ?? 0,
          updatedAt: p.updatedAt ?? 0,
        })),
      );
      setSavedJsonSchemas(
        sandboxLibs.schemas.map((s) => ({
          ...s,
          createdAt: s.createdAt ?? 0,
          updatedAt: s.updatedAt ?? 0,
        })),
      );
      setSavedCryptoPresets(
        sandboxLibs.presets.map((p) => ({
          ...p,
          action: p.action as import("@/entities/sandbox").CryptoAction,
          createdAt: p.createdAt ?? 0,
          updatedAt: p.updatedAt ?? 0,
        })),
      );
      setLoaded(true);
    } catch (e) {
      console.error("useAppBootstrap:", e);
    } finally {
      setLoading(false);
    }
  }, [
    setDomains,
    setApiLoggingLinks,
    setProxyStatus,
    setMockingEnabled,
    setInspectorEnabled,
    setSavedPipelines,
    setSavedJsonSchemas,
    setSavedCryptoPresets,
    setLoading,
    setLoaded,
  ]);

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

    const unlistenHub = listen(HUB_DATA_CHANGED, () => {
      void refresh();
    });

    const interval = setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      clearInterval(interval);
      void unlistenProxy.then((fn) => fn());
      void unlistenMocking.then((fn) => fn());
      void unlistenHub.then((fn) => fn());
    };
  }, [refresh, setProxyStatus, setMockingEnabled]);

  return { refresh };
}
