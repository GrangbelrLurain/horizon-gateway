import { useCallback, useMemo, useState } from "react";
import { fetchProxyRoutesApi, toggleProxyRouteApi } from "../api/gateway";
import type { LocalRoute } from "../types";

export function useProxyRoutes(fetchStatus: () => void) {
  const [proxyRoutes, setProxyRoutes] = useState<LocalRoute[]>([]);
  const [showAllProxyRoutes, setShowAllProxyRoutes] = useState(false);

  const matchedProxyRoutes = useMemo(() => {
    if (showAllProxyRoutes) {
      return proxyRoutes;
    }
    const currentHost = window.location.hostname.toLowerCase();
    return proxyRoutes.filter((r) => {
      const d = (r.domain || "").toLowerCase();
      return d === currentHost;
    });
  }, [proxyRoutes, showAllProxyRoutes]);

  const fetchProxyRoutes = useCallback(() => {
    fetchProxyRoutesApi()
      .then((data) => setProxyRoutes(data))
      .catch(() => {});
  }, []);

  const handleToggleProxyRoute = async (id: number, enabled: boolean) => {
    await toggleProxyRouteApi(id, enabled);
    fetchProxyRoutes();
    fetchStatus();
  };

  return {
    proxyRoutes,
    showAllProxyRoutes,
    setShowAllProxyRoutes,
    matchedProxyRoutes,
    fetchProxyRoutes,
    handleToggleProxyRoute,
  };
}
