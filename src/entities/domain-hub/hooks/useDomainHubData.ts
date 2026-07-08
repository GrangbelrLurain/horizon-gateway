import { useAtom, useAtomValue } from "jotai";
import { useCallback, useMemo, useState } from "react";
import { proxyActiveAtom } from "@/entities/app";
import type { DomainFeatureState } from "@/entities/domain";
import { domainsAtom } from "@/entities/domain";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import { groupsAtom, linksAtom } from "@/entities/domain-group";
import { monitorLinksAtom } from "@/entities/domain-monitor";
import { localRoutesAtom } from "@/entities/proxy";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import type { HubDataChangedReason } from "@/shared/lib/tauri/hubEvents";
import { useHubDataSubscription } from "../lib/hubDataSubscription";

export function useDomainHubData() {
  const [domains, setDomains] = useAtom(domainsAtom);
  const [groups, setGroups] = useAtom(groupsAtom);
  const [links, setLinks] = useAtom(linksAtom);
  const [monitorLinks, setMonitorLinks] = useAtom(monitorLinksAtom);
  const [apiLoggingLinks, setApiLoggingLinks] = useAtom(apiLoggingLinksAtom);
  const [localRoutes, setLocalRoutes] = useAtom(localRoutesAtom);
  const proxyActive = useAtomValue(proxyActiveAtom);
  const [loading, setLoading] = useState(true);

  const domainGroupIds = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const l of links) {
      map.set(l.domain_id, [...(map.get(l.domain_id) ?? []), l.group_id]);
    }
    return map;
  }, [links]);

  const monitorMap = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const m of monitorLinks) {
      map.set(m.domainId, m.checkEnabled);
    }
    return map;
  }, [monitorLinks]);

  const apiLoggingMap = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const a of apiLoggingLinks) {
      map.set(a.domainId, a.loggingEnabled ?? false);
    }
    return map;
  }, [apiLoggingLinks]);

  const proxyRouteMap = useMemo(() => {
    const map = new Map<string, { id: number; enabled: boolean; targetHost: string; targetPort: number }>();
    for (const r of localRoutes) {
      if (r.domain) {
        map.set(r.domain.toLowerCase(), {
          id: r.id,
          enabled: r.enabled,
          targetHost: r.target_host,
          targetPort: r.target_port,
        });
      }
    }
    return map;
  }, [localRoutes]);

  const refreshByReason = useCallback(
    async (reason?: HubDataChangedReason) => {
      const needsAll = !reason;

      try {
        if (needsAll || reason === "domains") {
          const domainsRes = await commands.getDomains().then(unwrap);
          if (domainsRes.success) {
            setDomains(domainsRes.data ?? []);
          }
        }

        if (needsAll || reason === "groups") {
          const [groupsRes, linksRes] = await Promise.all([
            commands.getGroups().then(unwrap),
            commands.getDomainGroupLinks().then(unwrap),
          ]);
          if (groupsRes.success) {
            setGroups(groupsRes.data ?? []);
          }
          if (linksRes.success) {
            setLinks(linksRes.data ?? []);
          }
        }

        if (needsAll || reason === "features") {
          const [monitorRes, apiRes] = await Promise.all([
            commands.getDomainMonitorList().then(unwrap),
            commands.getDomainApiLoggingLinks().then(unwrap),
          ]);
          if (monitorRes.success) {
            setMonitorLinks(monitorRes.data ?? []);
          }
          if (apiRes.success) {
            setApiLoggingLinks(apiRes.data ?? []);
          }
        }

        if (needsAll || reason === "routes") {
          const routesRes = await commands.getLocalRoutes().then(unwrap);
          if (routesRes.success) {
            setLocalRoutes(routesRes.data ?? []);
          }
        }
      } catch (err) {
        console.error("useDomainHubData:", err);
      }
    },
    [setApiLoggingLinks, setDomains, setGroups, setLinks, setLocalRoutes, setMonitorLinks],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await refreshByReason();
    } finally {
      setLoading(false);
    }
  }, [refreshByReason]);

  const handleHubDataChanged = useCallback(
    async (reason?: HubDataChangedReason) => {
      if (!reason) {
        await fetchAll();
        return;
      }
      await refreshByReason(reason);
    },
    [fetchAll, refreshByReason],
  );

  useHubDataSubscription(handleHubDataChanged);

  const getDomainHost = useCallback((domain: Domain) => {
    try {
      const u = new URL(domain.url.startsWith("http") ? domain.url : `https://${domain.url}`);
      return u.hostname.toLowerCase();
    } catch {
      return domain.url.toLowerCase();
    }
  }, []);

  const getFeatureState = useCallback(
    (domainId: number): DomainFeatureState => {
      const domain = domains.find((d) => d.id === domainId);
      const domainHost = domain ? getDomainHost(domain) : undefined;
      const proxyRoute = domainHost ? proxyRouteMap.get(domainHost) : undefined;

      return {
        monitorEnabled: monitorMap.has(domainId) ? monitorMap.get(domainId) : undefined,
        proxyEnabled: proxyRoute?.enabled,
        proxyRouteId: proxyRoute?.id,
        apiLoggingEnabled: apiLoggingMap.has(domainId) ? apiLoggingMap.get(domainId) : undefined,
      };
    },
    [apiLoggingMap, domains, getDomainHost, monitorMap, proxyRouteMap],
  );

  const getGroupName = useCallback(
    (domainId: number, noGroupLabel: string) => {
      const ids = domainGroupIds.get(domainId) ?? [];
      if (ids.length === 0) {
        return noGroupLabel;
      }
      const g = groups.find((x) => x.id === ids[0]);
      return g?.name ?? `Group #${ids[0]}`;
    },
    [domainGroupIds, groups],
  );

  const getGroupId = useCallback(
    (domainId: number) => {
      const ids = domainGroupIds.get(domainId) ?? [];
      return ids[0] ?? null;
    },
    [domainGroupIds],
  );

  const getProxyRoute = useCallback(
    (domain: Domain) => {
      const host = getDomainHost(domain);
      return proxyRouteMap.get(host);
    },
    [getDomainHost, proxyRouteMap],
  );

  return {
    domains,
    groups,
    links,
    loading,
    proxyActive,
    domainGroupIds,
    fetchAll,
    getFeatureState,
    getGroupName,
    getGroupId,
    getDomainHost,
    getProxyRoute,
  };
}
