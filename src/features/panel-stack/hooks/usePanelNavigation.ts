import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { openPopupWindow, type PopupWindowId } from "@/features/popup-window";
import { canOpenPanel } from "../lib/panelGates";
import { panelStackAtom, selectedDomainIdAtom } from "../store";
import type { PanelEntry, PanelId } from "../types";
import { buildPanelsFromSearch } from "../types";
import { useDomainHubData } from "./useDomainHubData";

function searchFromState(domainId: number | null, panels: PanelEntry[]): Record<string, string | number | undefined> {
  if (!domainId) {
    return {};
  }

  const last = panels[panels.length - 1];
  if (!last || last.id === "overview") {
    return { d: domainId, p: "overview" };
  }

  if (last.id === "api/log" && last.params?.logId) {
    return { d: domainId, p: "api/log", logId: last.params.logId };
  }

  return { d: domainId, p: last.id };
}

export function usePanelNavigation() {
  const navigate = useNavigate({ from: "/" });
  const search = useSearch({ from: "/" });
  const [domainId, setDomainId] = useAtom(selectedDomainIdAtom);
  const [panels, setPanels] = useAtom(panelStackAtom);
  const { getFeatureState } = useDomainHubData();
  const domainIdRef = useRef(domainId);
  domainIdRef.current = domainId;

  useEffect(() => {
    const built = buildPanelsFromSearch(search.d, search.p, search.logId);
    setDomainId(built.domainId);
    setPanels(built.panels);
  }, [search.d, search.p, search.logId, setDomainId, setPanels]);

  const syncUrl = useCallback(
    (nextDomainId: number | null, nextPanels: PanelEntry[]) => {
      navigate({ search: searchFromState(nextDomainId, nextPanels), replace: true });
    },
    [navigate],
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
      syncUrl(domainId, [{ id: "overview" }]);
    }
  }, [domainId, panels, getFeatureState, syncUrl]);

  const selectDomain = useCallback(
    (id: number) => {
      if (domainIdRef.current === id) {
        syncUrl(null, []);
        return;
      }
      syncUrl(id, [{ id: "overview" }]);
    },
    [syncUrl],
  );

  const openPanel = useCallback(
    (id: PanelId, params?: Record<string, string>) => {
      if (!domainId) {
        return;
      }

      const features = getFeatureState(domainId);
      if (id !== "overview" && !canOpenPanel(id, features)) {
        return;
      }

      let nextPanels: PanelEntry[];

      if (id === "overview") {
        nextPanels = [{ id: "overview" }];
      } else if (id === "api") {
        nextPanels = [{ id: "overview" }, { id: "api" }];
      } else if (id.startsWith("api/")) {
        const hasApi = panels.some((p) => p.id === "api");
        nextPanels = hasApi
          ? [...panels.filter((p) => p.id === "overview" || p.id === "api"), { id, params }]
          : [{ id: "overview" }, { id: "api" }, { id, params }];
      } else {
        nextPanels = [{ id: "overview" }, { id, params }];
      }

      syncUrl(domainId, nextPanels);
    },
    [domainId, panels, syncUrl, getFeatureState],
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
      syncUrl(domainId, nextPanels);
    },
    [domainId, panels, syncUrl],
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
      syncUrl(domainId, nextPanels);
    },
    [domainId, panels, syncUrl],
  );

  const resetPanels = useCallback(() => {
    if (!domainId) {
      return;
    }
    syncUrl(domainId, [{ id: "overview" }]);
  }, [domainId, syncUrl]);

  const clearDomain = useCallback(() => {
    syncUrl(null, []);
  }, [syncUrl]);

  const restoreNavigation = useCallback(
    (id: number, nextPanels: PanelEntry[]) => {
      syncUrl(id, nextPanels.length > 0 ? nextPanels : [{ id: "overview" }]);
    },
    [syncUrl],
  );

  const openPopup = useCallback((id: PopupWindowId) => {
    void openPopupWindow(id);
  }, []);

  return {
    domainId,
    panels,
    selectDomain,
    openPanel,
    navigateToPanel,
    closePanel,
    resetPanels,
    clearDomain,
    restoreNavigation,
    openPopup,
  };
}
