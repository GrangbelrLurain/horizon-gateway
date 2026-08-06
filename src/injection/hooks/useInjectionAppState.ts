import { useEffect, useState } from "react";
import type { MockedApiEntry } from "../types";
import { useAnnotations } from "./useAnnotations";
import { useDockDrag } from "./useDockDrag";
import { useGatewayStatus } from "./useGatewayStatus";
import { useInspectMode } from "./useInspectMode";
import { useMockRules } from "./useMockRules";
import { useProxyRoutes } from "./useProxyRoutes";
import { useTrafficLogs } from "./useTrafficLogs";

export function useInjectionAppState() {
  const gateway = useGatewayStatus();
  const proxy = useProxyRoutes(gateway.fetchStatus);
  const mock = useMockRules();
  const traffic = useTrafficLogs();
  const annotations = useAnnotations();
  const inspect = useInspectMode(annotations.fetchAnnotations);
  const dock = useDockDrag();

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
    gateway.fetchStatus();
    proxy.fetchProxyRoutes();
    mock.fetchMockRules();
    traffic.fetchLoggingDomains();
  }, [gateway.fetchStatus, proxy.fetchProxyRoutes, mock.fetchMockRules, traffic.fetchLoggingDomains]);

  useEffect(() => {
    if (isPrxPopoverOpen) {
      proxy.fetchProxyRoutes();
      gateway.fetchStatus();
    }
  }, [isPrxPopoverOpen, proxy.fetchProxyRoutes, gateway.fetchStatus]);

  useEffect(() => {
    if (isMockListOpen) {
      mock.fetchMockRules();
      gateway.fetchStatus();
    }
  }, [isMockListOpen, mock.fetchMockRules, gateway.fetchStatus]);

  useEffect(() => {
    if (isLogPopoverOpen) {
      traffic.fetchLoggingDomains();
    }
  }, [isLogPopoverOpen, traffic.fetchLoggingDomains]);

  useEffect(() => {
    const existing = (window as unknown as { __wt_mocked_requests?: MockedApiEntry[] }).__wt_mocked_requests;
    if (Array.isArray(existing) && existing.length > 0) {
      mock.setMockedRequests((prev) => {
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
        mock.setMockedRequests((prev) => {
          if (prev.some((m) => m.id === detail.id || (m.url === detail.url && m.method === detail.method))) {
            return prev;
          }
          return [detail, ...prev];
        });
      }
    };
    window.addEventListener("wt:mocked-request", handleMockedEvent);
    return () => window.removeEventListener("wt:mocked-request", handleMockedEvent);
  }, [mock.setMockedRequests]);

  return {
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
