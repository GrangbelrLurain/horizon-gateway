import { useAtom, useAtomValue } from "jotai";
import { fetchLocalRoutes, fetchProxyStatus } from "./api";
import { localRoutesAtom, proxyStatusAtom } from "./store";

export function useProxy() {
  const [localRoutes, setLocalRoutes] = useAtom(localRoutesAtom);
  const [status, setStatus] = useAtom(proxyStatusAtom);
  return {
    localRoutes,
    setLocalRoutes,
    status,
    setStatus,
    running: status?.running ?? false,
    localRoutingEnabled: status?.local_routing_enabled ?? false,
    isActive: !!(status?.running && status?.local_routing_enabled),
    refreshStatus: async () => {
      const data = await fetchProxyStatus();
      setStatus(data);
      return data;
    },
    refreshRoutes: async () => {
      const data = await fetchLocalRoutes();
      setLocalRoutes(data);
      return data;
    },
  };
}

export function useProxyRunning() {
  const status = useAtomValue(proxyStatusAtom);
  return status?.running ?? false;
}

export function useProxyActive() {
  const status = useAtomValue(proxyStatusAtom);
  return !!(status?.running && status?.local_routing_enabled);
}
