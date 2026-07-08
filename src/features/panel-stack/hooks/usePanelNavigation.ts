import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { notifyHubHandoff } from "@/shared/lib/tauri/hubEvents";
import { openDetachedWindow } from "@/shared/lib/tauri/openDetachedWindow";
import type { HandoffTarget, HubHandoff } from "../lib/hubHandoff";
import { canOpenPanel } from "../lib/panelGates";
import { getSurfaceEntry } from "../lib/surfaceRegistry";
import { hubHandoffAtom, hubHandoffConsumedIdAtom, panelStackAtom, selectedDomainIdAtom } from "../store";
import type { HubSearchParams, HubSurfaceId, PanelEntry, PanelId } from "../types";
import { buildPanelsFromSearch, parseHubSurfaceId } from "../types";
import { useDomainHubData } from "./useDomainHubData";

function buildNextPanels(currentPanels: PanelEntry[], id: PanelId, params?: Record<string, string>): PanelEntry[] {
  if (id === "overview") {
    return [{ id: "overview" }];
  }
  if (id === "api") {
    return [{ id: "overview" }, { id: "api" }];
  }
  if (id.startsWith("api/")) {
    const hasApi = currentPanels.some((p) => p.id === "api");
    return hasApi
      ? [...currentPanels.filter((p) => p.id === "overview" || p.id === "api"), { id, params }]
      : [{ id: "overview" }, { id: "api" }, { id, params }];
  }
  return [{ id: "overview" }, { id, params }];
}

function searchFromState(
  domainId: number | null,
  panels: PanelEntry[],
  globalSurface: HubSurfaceId | null,
): HubSearchParams {
  const result: HubSearchParams = {};

  if (globalSurface) {
    result.g = globalSurface;
  }

  if (!domainId) {
    return result;
  }

  result.d = domainId;
  const last = panels[panels.length - 1];
  if (!last || last.id === "overview") {
    result.p = "overview";
    return result;
  }

  if (last.id === "api/log" && last.params?.logId) {
    result.p = "api/log";
    result.logId = last.params.logId;
    return result;
  }

  result.p = last.id;
  return result;
}

export function usePanelNavigation() {
  const navigate = useNavigate({ from: "/" });
  const search = useSearch({ from: "/" });
  const [domainId, setDomainId] = useAtom(selectedDomainIdAtom);
  const [panels, setPanels] = useAtom(panelStackAtom);
  const setHandoff = useSetAtom(hubHandoffAtom);
  const setConsumedHandoffId = useSetAtom(hubHandoffConsumedIdAtom);
  const { getFeatureState } = useDomainHubData();
  const domainIdRef = useRef(domainId);
  const panelsRef = useRef(panels);
  const globalSurfaceRef = useRef<HubSurfaceId | null>(null);
  domainIdRef.current = domainId;
  panelsRef.current = panels;

  const globalSurface = parseHubSurfaceId(search.g);
  globalSurfaceRef.current = globalSurface;

  useEffect(() => {
    const built = buildPanelsFromSearch(search.d, search.p, search.logId);
    setDomainId(built.domainId);
    setPanels(built.panels);
  }, [search.d, search.p, search.logId, setDomainId, setPanels]);

  const syncUrl = useCallback(
    (nextDomainId: number | null, nextPanels: PanelEntry[], nextGlobalSurface: HubSurfaceId | null) => {
      navigate({
        search: searchFromState(nextDomainId, nextPanels, nextGlobalSurface),
        replace: true,
      });
    },
    [navigate],
  );

  const syncUrlPreserveGlobal = useCallback(
    (nextDomainId: number | null, nextPanels: PanelEntry[]) => {
      syncUrl(nextDomainId, nextPanels, globalSurfaceRef.current);
    },
    [syncUrl],
  );

  useEffect(() => {
    if (!domainId) {
      return;
    }
    const active = panels[panels.length - 1];
    if (!active || active.id === "overview") {
      return;
    }
    if (!canOpenPanel(active.id, getFeatureState(domainId))) {
      syncUrlPreserveGlobal(domainId, [{ id: "overview" }]);
    }
  }, [domainId, panels, getFeatureState, syncUrlPreserveGlobal]);

  const openGlobalSurface = useCallback(
    (id: HubSurfaceId, opts?: { detach?: boolean }) => {
      const entry = getSurfaceEntry(id);
      if (opts?.detach) {
        void openDetachedWindow(entry.route, id, entry.detachWidth, entry.detachHeight);
        return;
      }
      syncUrl(domainIdRef.current, panelsRef.current, id);
    },
    [syncUrl],
  );

  const closeGlobalSurface = useCallback(() => {
    syncUrl(domainIdRef.current, panelsRef.current, null);
  }, [syncUrl]);

  const openChromeSurface = useCallback(
    (id: Extract<HubSurfaceId, `chrome/${string}`>) => {
      openGlobalSurface(id);
    },
    [openGlobalSurface],
  );

  const selectDomain = useCallback(
    (id: number) => {
      if (domainIdRef.current === id) {
        syncUrl(null, [], globalSurfaceRef.current);
        return;
      }
      syncUrl(id, [{ id: "overview" }], globalSurfaceRef.current);
    },
    [syncUrl],
  );

  const openPanel = useCallback(
    (id: PanelId, params?: Record<string, string>) => {
      const currentDomainId = domainIdRef.current;
      if (!currentDomainId) {
        return;
      }

      const features = getFeatureState(currentDomainId);
      if (id !== "overview" && !canOpenPanel(id, features)) {
        return;
      }

      const nextPanels = buildNextPanels(panelsRef.current, id, params);
      syncUrl(currentDomainId, nextPanels, globalSurfaceRef.current);
    },
    [syncUrl, getFeatureState],
  );

  const openPanelForDomain = useCallback(
    (targetDomainId: number, id: PanelId, params?: Record<string, string>) => {
      const features = getFeatureState(targetDomainId);
      if (id !== "overview" && !canOpenPanel(id, features)) {
        return;
      }
      const nextPanels = buildNextPanels([], id, params);
      syncUrl(targetDomainId, nextPanels, null);
    },
    [syncUrl, getFeatureState],
  );

  const navigateToPanel = useCallback(
    (id: PanelId, index: number) => {
      if (!domainId) {
        return;
      }
      const nextPanels = panels.slice(0, index + 1);
      if (nextPanels[nextPanels.length - 1]?.id !== id) {
        return;
      }
      syncUrlPreserveGlobal(domainId, nextPanels);
    },
    [domainId, panels, syncUrlPreserveGlobal],
  );

  const closePanel = useCallback(
    (fromIndex: number) => {
      if (!domainId) {
        return;
      }
      const nextPanels = panels.slice(0, fromIndex);
      if (nextPanels.length === 0) {
        nextPanels.push({ id: "overview" });
      }
      syncUrlPreserveGlobal(domainId, nextPanels);
    },
    [domainId, panels, syncUrlPreserveGlobal],
  );

  const resetPanels = useCallback(() => {
    if (!domainId) {
      return;
    }
    syncUrlPreserveGlobal(domainId, [{ id: "overview" }]);
  }, [domainId, syncUrlPreserveGlobal]);

  const clearDomain = useCallback(() => {
    syncUrl(null, [], globalSurfaceRef.current);
  }, [syncUrl]);

  const restoreNavigation = useCallback(
    (id: number, nextPanels: PanelEntry[]) => {
      syncUrl(id, nextPanels.length > 0 ? nextPanels : [{ id: "overview" }], globalSurfaceRef.current);
    },
    [syncUrl],
  );

  const dispatchHandoff = useCallback(
    (handoff: HubHandoff, target: HandoffTarget) => {
      setHandoff(handoff);
      setConsumedHandoffId(null);
      void notifyHubHandoff(handoff, target);

      if (target.scope === "domain") {
        openPanelForDomain(target.domainId, target.panelId);
        return;
      }

      syncUrl(domainIdRef.current, panelsRef.current, target.surfaceId);
    },
    [setHandoff, setConsumedHandoffId, openPanelForDomain, syncUrl],
  );

  return {
    domainId,
    panels,
    globalSurface,
    selectDomain,
    openPanel,
    openPanelForDomain,
    navigateToPanel,
    closePanel,
    resetPanels,
    clearDomain,
    restoreNavigation,
    openGlobalSurface,
    closeGlobalSurface,
    openChromeSurface,
    dispatchHandoff,
  };
}
