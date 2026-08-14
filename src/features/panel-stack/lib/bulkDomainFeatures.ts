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
  for (const url of domainUrls) {
    await commands.setHttpsDecryptHost({ host: extractHost(url), enabled }).then(unwrap);
  }
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
  existingLinks: DomainApiLoggingLink_Serialize[],
): Promise<void> {
  if (domainIds.length === 0) {
    return;
  }
  if (enabled) {
    for (const domainId of domainIds) {
      const link = existingLinks.find((l) => l.domainId === domainId);
      await commands
        .setDomainApiLogging({
          domainId,
          loggingEnabled: true,
          bodyEnabled: link?.bodyEnabled ?? false,
          schemaUrl: link?.schemaUrl ?? null,
        })
        .then(unwrap);
    }
  } else {
    for (const domainId of domainIds) {
      await commands.removeDomainApiLogging({ domainId }).then(unwrap);
    }
  }
  await notifyHubDataChanged("features");
}

export async function setBulkApiBodyLogging(
  domainIds: number[],
  enabled: boolean,
  existingLinks: DomainApiLoggingLink_Serialize[],
): Promise<void> {
  if (domainIds.length === 0) {
    return;
  }
  for (const domainId of domainIds) {
    const link = existingLinks.find((l) => l.domainId === domainId);
    await commands
      .setDomainApiLogging({
        domainId,
        loggingEnabled: link?.loggingEnabled ?? true,
        bodyEnabled: enabled,
        schemaUrl: link?.schemaUrl ?? null,
      })
      .then(unwrap);
  }
  await notifyHubDataChanged("features");
}

export async function setBulkProxy(
  states: { domainId: number; state: DomainFeatureState }[],
  enabled: boolean,
): Promise<{ applied: number; skipped: number }> {
  if (states.length === 0) {
    return { applied: 0, skipped: 0 };
  }

  let applied = 0;
  let skipped = 0;
  for (const { state } of states) {
    if (state.proxyRouteId === undefined) {
      skipped++;
      continue;
    }
    await commands
      .updateLocalRoute({
        id: state.proxyRouteId,
        targetHost: null,
        targetPort: null,
        enabled,
      })
      .then(unwrap);
    applied++;
  }
  if (applied > 0) {
    await notifyHubDataChanged("routes");
  }
  return { applied, skipped };
}

export async function bulkRemoveDomains(domainIds: number[]): Promise<void> {
  for (const id of domainIds) {
    await commands.removeDomains({ id }).then(unwrap);
  }
  await notifyHubDataChanged("domains");
}

export async function bulkAssignGroup(domainIds: number[], groupId: number | null): Promise<void> {
  const groupIds = groupId === null ? [] : [groupId];
  for (const domainId of domainIds) {
    await commands.setDomainGroups({ domainId, groupIds }).then(unwrap);
  }
  await notifyHubDataChanged("groups");
}
