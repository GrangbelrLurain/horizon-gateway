import { normalizeDomainUrl } from "@/entities/domain";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { pullResources, pushResources } from "./api";
import type { ResourceKind } from "./types";

export type SyncMode = "merge_url" | "append_only" | "overwrite" | "merge_id";

const SYNC_KINDS: ResourceKind[] = ["domains", "groups", "domain_group_links", "scenarios", "mock_rules"];

interface DomainItem {
  id: number;
  url: string;
  enabled?: boolean;
  [key: string]: unknown;
}

interface GroupItem {
  id: number | string;
  name: string;
  [key: string]: unknown;
}

interface LinkItem {
  domain_id: number;
  group_id: number | string;
  [key: string]: unknown;
}

/** Push local domains/groups/mocks to workspace with specified SyncMode. */
export async function pushWorkspaceSync(
  workspaceId: string,
  userId: string,
  mode: SyncMode = "merge_url",
): Promise<void> {
  const res = await commands.exportAllSettings().then(unwrap);
  if (!res.success || !res.data) {
    throw new Error(res.message || "Export failed");
  }
  const localData = res.data;

  let finalDomains = localData.domains as unknown as DomainItem[];
  let finalGroups = localData.groups as unknown as GroupItem[];
  let finalLinks = localData.domainGroupLinks as unknown as LinkItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalScenarios: any[] = localData.scenarios ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalMockRules: any[] = localData.mockRules ?? [];

  if (mode !== "overwrite") {
    // Fetch remote to merge before pushing
    try {
      const remoteRows = await pullResources(workspaceId);
      if (remoteRows.length > 0) {
        const byKind = Object.fromEntries(remoteRows.map((r) => [r.kind, r.payload])) as Partial<
          Record<ResourceKind, unknown>
        >;
        const remoteDomains = (byKind.domains as DomainItem[]) ?? [];
        const remoteGroups = (byKind.groups as GroupItem[]) ?? [];
        const remoteLinks = (byKind.domain_group_links as LinkItem[]) ?? [];
        const remoteScenarios = (byKind.scenarios as unknown[]) ?? [];
        const remoteMockRules = (byKind.mock_rules as unknown[]) ?? [];

        if (mode === "append_only") {
          // Push only local domains whose URL doesn't exist on remote
          const remoteUrlSet = new Set(remoteDomains.map((d) => normalizeDomainUrl(d.url)));
          const localNewDomains = (localData.domains as unknown as DomainItem[]).filter(
            (d) => !remoteUrlSet.has(normalizeDomainUrl(d.url)),
          );
          finalDomains = [...remoteDomains, ...localNewDomains];

          const groupMap = new Map(remoteGroups.map((g) => [g.id, g]));
          for (const g of localData.groups as unknown as GroupItem[]) {
            if (!groupMap.has(g.id)) {
              groupMap.set(g.id, g);
            }
          }
          finalGroups = Array.from(groupMap.values());
          finalLinks = [...remoteLinks, ...(localData.domainGroupLinks as unknown as LinkItem[])];
          finalScenarios = [...remoteScenarios, ...(localData.scenarios ?? [])];
          finalMockRules = [...remoteMockRules, ...(localData.mockRules ?? [])];
        } else if (mode === "merge_url") {
          // URL-based merge: Match by hostname, local overrides remote settings
          const remoteByUrl = new Map(remoteDomains.map((d) => [normalizeDomainUrl(d.url), d]));
          const mergedDomains: DomainItem[] = [...remoteDomains];

          for (const localDom of localData.domains as unknown as DomainItem[]) {
            const normUrl = normalizeDomainUrl(localDom.url);
            const existingRemote = remoteByUrl.get(normUrl);
            if (existingRemote) {
              const idx = mergedDomains.findIndex((d) => d.id === existingRemote.id);
              if (idx !== -1) {
                mergedDomains[idx] = { ...existingRemote, ...localDom, id: existingRemote.id };
              }
            } else {
              mergedDomains.push(localDom);
            }
          }
          finalDomains = mergedDomains;

          const groupMap = new Map(remoteGroups.map((g) => [g.id, g]));
          for (const g of localData.groups as unknown as GroupItem[]) {
            groupMap.set(g.id, g);
          }
          finalGroups = Array.from(groupMap.values());
          finalLinks = [...remoteLinks, ...(localData.domainGroupLinks as unknown as LinkItem[])];
          finalScenarios = [...remoteScenarios, ...(localData.scenarios ?? [])];
          finalMockRules = [...remoteMockRules, ...(localData.mockRules ?? [])];
        }
      }
    } catch (e) {
      console.warn("pushWorkspaceSync: remote fetch for merge skipped:", e);
    }
  }

  await Promise.all([
    pushResources(workspaceId, "domains", finalDomains, userId),
    pushResources(workspaceId, "groups", finalGroups, userId),
    pushResources(workspaceId, "domain_group_links", finalLinks, userId),
    pushResources(workspaceId, "scenarios", finalScenarios, userId),
    pushResources(workspaceId, "mock_rules", finalMockRules, userId),
  ]);
}

/** Pull workspace resources and merge into local settings using specified SyncMode. */
export async function pullWorkspaceSync(workspaceId: string, mode: SyncMode = "merge_url"): Promise<void> {
  const rows = await pullResources(workspaceId);
  if (rows.length === 0) {
    throw new Error("No remote resources found in this workspace.");
  }

  const byKind = Object.fromEntries(rows.map((r) => [r.kind, r.payload])) as Partial<Record<ResourceKind, unknown>>;

  const localRes = await commands.exportAllSettings().then(unwrap);
  if (!localRes.success || !localRes.data) {
    throw new Error(localRes.message || "Local export failed");
  }
  const localData = localRes.data;

  const remoteDomains = (byKind.domains as DomainItem[]) ?? [];
  const remoteGroups = (byKind.groups as GroupItem[]) ?? [];
  const remoteLinks = (byKind.domain_group_links as LinkItem[]) ?? [];
  const remoteScenarios = (byKind.scenarios as unknown[]) ?? [];
  const remoteMockRules = (byKind.mock_rules as unknown[]) ?? [];

  if (mode === "overwrite") {
    const payload = {
      ...localData,
      domains: remoteDomains,
      groups: remoteGroups,
      domainGroupLinks: remoteLinks,
      scenarios: remoteScenarios,
      mockRules: remoteMockRules,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commands.importAllSettings(payload as any, "overwrite").then(unwrap);
  } else if (mode === "append_only") {
    const localUrlSet = new Set((localData.domains as unknown as DomainItem[]).map((d) => normalizeDomainUrl(d.url)));
    const newRemoteDomains = remoteDomains.filter((d) => !localUrlSet.has(normalizeDomainUrl(d.url)));

    const payload = {
      ...localData,
      domains: [...(localData.domains as unknown as DomainItem[]), ...newRemoteDomains],
      groups: Array.from(
        new Map([
          ...(localData.groups as unknown as GroupItem[]).map((g) => [g.id, g] as [number | string, GroupItem]),
          ...remoteGroups.map((g) => [g.id, g] as [number | string, GroupItem]),
        ]).values(),
      ),
      domainGroupLinks: [...(localData.domainGroupLinks as unknown as LinkItem[]), ...remoteLinks],
      scenarios: [...(localData.scenarios ?? []), ...remoteScenarios],
      mockRules: [...(localData.mockRules ?? []), ...remoteMockRules],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commands.importAllSettings(payload as any, "merge").then(unwrap);
  } else if (mode === "merge_url") {
    const localDomains = localData.domains as unknown as DomainItem[];
    const localByUrl = new Map(localDomains.map((d) => [normalizeDomainUrl(d.url), d]));
    const mergedDomains: DomainItem[] = [...localDomains];

    for (const remDom of remoteDomains) {
      const normUrl = normalizeDomainUrl(remDom.url);
      const existingLocal = localByUrl.get(normUrl);
      if (existingLocal) {
        const idx = mergedDomains.findIndex((d) => d.id === existingLocal.id);
        if (idx !== -1) {
          mergedDomains[idx] = { ...existingLocal, ...remDom, id: existingLocal.id };
        }
      } else {
        mergedDomains.push(remDom);
      }
    }

    const payload = {
      ...localData,
      domains: mergedDomains,
      groups: Array.from(
        new Map([
          ...(localData.groups as unknown as GroupItem[]).map((g) => [g.id, g] as [number | string, GroupItem]),
          ...remoteGroups.map((g) => [g.id, g] as [number | string, GroupItem]),
        ]).values(),
      ),
      domainGroupLinks: [...(localData.domainGroupLinks as unknown as LinkItem[]), ...remoteLinks],
      scenarios: [...(localData.scenarios ?? []), ...remoteScenarios],
      mockRules: [...(localData.mockRules ?? []), ...remoteMockRules],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commands.importAllSettings(payload as any, "merge").then(unwrap);
  } else {
    const payload = {
      ...localData,
      domains: remoteDomains,
      groups: remoteGroups,
      domainGroupLinks: remoteLinks,
      scenarios: remoteScenarios,
      mockRules: remoteMockRules,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commands.importAllSettings(payload as any, "merge").then(unwrap);
  }

  await notifyHubDataChanged("domains");
}

export function syncKinds(): ResourceKind[] {
  return [...SYNC_KINDS];
}
