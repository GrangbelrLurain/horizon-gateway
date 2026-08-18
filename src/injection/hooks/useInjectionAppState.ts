import { useEffect, useState } from "react";
import type { MockedApiEntry } from "../types";
import { useAnnotations } from "./useAnnotations";
import { useDockDrag } from "./useDockDrag";
import { useGatewayStatus } from "./useGatewayStatus";
import { useInjectionTheme } from "./useInjectionTheme";
import { useInspectMode } from "./useInspectMode";
import { useMockRules } from "./useMockRules";
import { useProxyRoutes } from "./useProxyRoutes";
import { useTrafficLogs } from "./useTrafficLogs";

export function useInjectionAppState() {
  const theme = useInjectionTheme();
  const gateway = useGatewayStatus();
  const proxy = useProxyRoutes(gateway.fetchStatus);
  const mock = useMockRules();
  const traffic = useTrafficLogs();
  const annotations = useAnnotations();
  const inspect = useInspectMode(annotations.fetchAnnotations, annotations.allAnnotations);
  const dock = useDockDrag();

  // Stable callbacks only — do not put hook return objects in effect deps
  // (new object identity every render → fetch storm).
  const fetchStatus = gateway.fetchStatus;
  const fetchProxyRoutes = proxy.fetchProxyRoutes;
  const fetchMockRules = mock.fetchMockRules;
  const fetchLoggingDomains = traffic.fetchLoggingDomains;
  const setMockedRequests = mock.setMockedRequests;

  const [isPrxPopoverOpen, setIsPrxPopoverOpen] = useState(false);
  const [isMockListOpen, setIsMockListOpen] = useState(false);
  const [isLogPopoverOpen, setIsLogPopoverOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  const closeAllPopovers = () => {
    setIsPrxPopoverOpen(false);
    setIsMockListOpen(false);
    setIsLogPopoverOpen(false);
    setIsGuideModalOpen(false);
  };

  useEffect(() => {
    fetchStatus();
    fetchProxyRoutes();
    fetchMockRules();
    fetchLoggingDomains();
  }, [fetchStatus, fetchProxyRoutes, fetchMockRules, fetchLoggingDomains]);

  useEffect(() => {
    if (isPrxPopoverOpen) {
      fetchProxyRoutes();
      fetchStatus();
    }
  }, [isPrxPopoverOpen, fetchProxyRoutes, fetchStatus]);

  useEffect(() => {
    if (isMockListOpen) {
      fetchMockRules();
      fetchStatus();
    }
  }, [isMockListOpen, fetchMockRules, fetchStatus]);

  useEffect(() => {
    if (isLogPopoverOpen) {
      fetchLoggingDomains();
    }
  }, [isLogPopoverOpen, fetchLoggingDomains]);

  useEffect(() => {
    const existing = (window as unknown as { __wt_mocked_requests?: MockedApiEntry[] }).__wt_mocked_requests;
    if (Array.isArray(existing) && existing.length > 0) {
      setMockedRequests((prev) => {
        const merged = [...prev];
        for (const item of existing) {
          if (!merged.some((m) => m.url === item.url && m.method === item.method)) {
            merged.push(item);
          }
        }
        return merged;
      });
    }

    const handleMockedEvent = (e: Event) => {
      const detail = (e as CustomEvent<MockedApiEntry>).detail;
      if (detail) {
        setMockedRequests((prev) => {
          if (prev.some((m) => m.id === detail.id || (m.url === detail.url && m.method === detail.method))) {
            return prev;
          }
          return [detail, ...prev];
        });
      }
    };
    window.addEventListener("wt:mocked-request", handleMockedEvent);
    return () => window.removeEventListener("wt:mocked-request", handleMockedEvent);
  }, [setMockedRequests]);

  return {
    ...theme,
    ...gateway,
    ...proxy,
    ...mock,
    ...traffic,
    ...annotations,
    ...inspect,
    ...dock,
    isPrxPopoverOpen,
    setIsPrxPopoverOpen,
    isMockListOpen,
    setIsMockListOpen,
    isLogPopoverOpen,
    setIsLogPopoverOpen,
    isGuideModalOpen,
    setIsGuideModalOpen,
    closeAllPopovers,
  };
}

export type InjectionAppState = ReturnType<typeof useInjectionAppState>;
