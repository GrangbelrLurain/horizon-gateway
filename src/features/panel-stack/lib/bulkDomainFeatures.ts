import type { DomainFeatureState } from "@/entities/domain";
import type { DomainApiLoggingLink_Serialize } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";

export type BulkFeatureKey = "monitor" | "proxy" | "api" | "scriptInjection" | "httpsDecrypt";

export async function setBulkScriptInjection(domainUrls: string[], enabled: boolean): Promise<void> {
  if (domainUrls.length === 0) {
    return;
  }
  const currentRes = await commands.getInjectionDomains().then(unwrap);
  const currentList = currentRes.success && currentRes.data ? currentRes.data : [];
  const extractHost = (url: string) => {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      return u.hostname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  };
  const hostsToModify = domainUrls.map(extractHost);
  let updated: string[];
  if (enabled) {
    const newHosts = hostsToModify.filter((h) => !currentList.some((item) => item.toLowerCase() === h));
    updated = [...currentList, ...newHosts];
  } else {
    updated = currentList.filter(
      (item) => !hostsToModify.some((h) => item.toLowerCase() === h || h.endsWith(`.${item.toLowerCase()}`)),
    );
  }
  await commands.setInjectionDomains({ domains: updated }).then(unwrap);
  await notifyHubDataChanged("features");
}

export async function setBulkHttpsDecrypt(domainUrls: string[], enabled: boolean): Promise<void> {
  if (domainUrls.length === 0) {
    return;
  }
  const extractHost = (url: string) => {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      return u.hostname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  };
  const hosts = Array.from(new Set(domainUrls.map(extractHost)));
  await commands.setHttpsDecryptHost({ hosts, enabled }).then(unwrap);
  await notifyHubDataChanged("features");
}

export async function setBulkMonitor(domainIds: number[], enabled: boolean): Promise<void> {
  if (domainIds.length === 0) {
    return;
  }
  await commands.setDomainMonitorCheckEnabled({ domainIds, enabled }).then(unwrap);
  await notifyHubDataChanged("features");
}

export async function setBulkApiLogging(
  domainIds: number[],
  enabled: boolean,
  _existingLinks: DomainApiLoggingLink_Serialize[],
): Promise<void> {
  if (domainIds.length === 0) {
    return;
  }
  if (enabled) {
    await commands
      .setDomainApiLogging({
        domainIds,
        loggingEnabled: true,
        bodyEnabled: false,
        schemaUrl: null,
      })
      .then(unwrap);
  } else {
    await commands.removeDomainApiLogging({ domainIds }).then(unwrap);
  }
  await notifyHubDataChanged("features");
}

export async function setBulkApiBodyLogging(
  domainIds: number[],
  enabled: boolean,
  _existingLinks: DomainApiLoggingLink_Serialize[],
): Promise<void> {
  if (domainIds.length === 0) {
    return;
  }
  await commands
    .setDomainApiLogging({
      domainIds,
      loggingEnabled: true,
      bodyEnabled: enabled,
      schemaUrl: null,
    })
    .then(unwrap);
  await notifyHubDataChanged("features");
}

export async function setBulkProxy(
  states: { domainId: number; state: DomainFeatureState }[],
  enabled: boolean,
): Promise<{ applied: number; skipped: number }> {
  if (states.length === 0) {
    return { applied: 0, skipped: 0 };
  }

  const routeIds: number[] = [];
  let skipped = 0;
  for (const { state } of states) {
    if (state.proxyRouteId === undefined) {
      skipped++;
    } else {
      routeIds.push(state.proxyRouteId);
    }
  }

  if (routeIds.length > 0) {
    await commands
      .updateLocalRoute({
        ids: routeIds,
        targetHost: null,
        targetPort: null,
        enabled,
      })
      .then(unwrap);
    await notifyHubDataChanged("routes");
  }

  return { applied: routeIds.length, skipped };
}

export async function bulkRemoveDomains(domainIds: number[]): Promise<void> {
  if (domainIds.length === 0) {
    return;
  }
  await commands.removeDomains({ ids: domainIds }).then(unwrap);
  await notifyHubDataChanged("domains");
}

export async function bulkAssignGroup(domainIds: number[], groupId: number | null): Promise<void> {
  if (domainIds.length === 0) {
    return;
  }
  const groupIds = groupId === null ? [] : [groupId];
  await commands.setDomainGroups({ domainIds, groupIds }).then(unwrap);
  await notifyHubDataChanged("groups");
}
