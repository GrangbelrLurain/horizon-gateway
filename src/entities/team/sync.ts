import { normalizeDomainUrl } from "@/entities/domain";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { pullResources, pushResources } from "./api";
import type { ResourceKind } from "./types";

export type SyncMode = "merge_url" | "append_only" | "overwrite" | "merge_id";

/** How domain identity is compared across devices. */
export type DomainMatchKey = "hostname" | "host_port" | "exact_url";

/**
 * When a domain matches on both sides:
 * - `update_source`: push uses local, pull uses remote
 * - `keep_target`: push keeps remote, pull keeps local
 */
export type SyncOverlapPolicy = "update_source" | "keep_target";

export interface WorkspaceSyncOptions {
  mode: SyncMode;
  matchKey: DomainMatchKey;
  overlapPolicy: SyncOverlapPolicy;
  /** Resource kinds to sync. Omitted kinds are left untouched on the destination. */
  kinds: ResourceKind[];
  /**
   * Push only: local domain ids to include in the upload set.
   * `undefined` = all local domains eligible for the selected mode.
   */
  selectedDomainIds?: number[];
}

export const DEFAULT_SYNC_KINDS: ResourceKind[] = [
  "domains",
  "groups",
  "domain_group_links",
  "scenarios",
  "mock_rules",
];

export const DEFAULT_SYNC_OPTIONS: WorkspaceSyncOptions = {
  mode: "merge_url",
  matchKey: "hostname",
  overlapPolicy: "update_source",
  kinds: [...DEFAULT_SYNC_KINDS],
};

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

export type PushDomainChangeKind = "add" | "update" | "unchanged";

export interface PushDomainPreviewItem {
  localId: number;
  url: string;
  matchKey: string;
  kind: PushDomainChangeKind;
  remoteId?: number;
}

export interface PushSyncPreview {
  domains: PushDomainPreviewItem[];
  remoteDomainCount: number;
}

/** Build a stable match key for domain comparison. */
export function domainMatchKey(url: string, key: DomainMatchKey = "hostname"): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  if (key === "exact_url") {
    let cleaned = trimmed.toLowerCase();
    if (cleaned.endsWith("/")) {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
  }

  try {
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    const host = u.hostname.toLowerCase().replace(/\.$/, "");
    if (key === "hostname") {
      return host;
    }
    const port = u.port;
    const isDefault = !port || (u.protocol === "https:" && port === "443") || (u.protocol === "http:" && port === "80");
    return isDefault ? host : `${host}:${port}`;
  } catch {
    return normalizeDomainUrl(trimmed);
  }
}

function normalizeOptions(options?: Partial<WorkspaceSyncOptions> | SyncMode): WorkspaceSyncOptions {
  if (typeof options === "string") {
    return { ...DEFAULT_SYNC_OPTIONS, mode: options };
  }
  return {
    ...DEFAULT_SYNC_OPTIONS,
    ...options,
    kinds: options?.kinds?.length ? [...options.kinds] : [...DEFAULT_SYNC_KINDS],
  };
}

function filterLocalDomains(domains: DomainItem[], selectedDomainIds?: number[]): DomainItem[] {
  if (!selectedDomainIds) {
    return domains;
  }
  const selected = new Set(selectedDomainIds);
  return domains.filter((d) => selected.has(d.id));
}

/** Preview which local domains would be added/updated on push. */
export async function buildPushSyncPreview(
  workspaceId: string,
  options?: Partial<WorkspaceSyncOptions>,
): Promise<PushSyncPreview> {
  const opts = normalizeOptions(options);
  const res = await commands.exportAllSettings().then(unwrap);
  if (!res.success || !res.data) {
    throw new Error(res.message || "Export failed");
  }
  const localDomains = res.data.domains as unknown as DomainItem[];

  let remoteDomains: DomainItem[] = [];
  try {
    const remoteRows = await pullResources(workspaceId);
    const byKind = Object.fromEntries(remoteRows.map((r) => [r.kind, r.payload])) as Partial<
      Record<ResourceKind, unknown>
    >;
    remoteDomains = (byKind.domains as DomainItem[]) ?? [];
  } catch {
    remoteDomains = [];
  }

  const remoteByKey = new Map(remoteDomains.map((d) => [domainMatchKey(d.url, opts.matchKey), d]));
  const domains: PushDomainPreviewItem[] = localDomains.map((local) => {
    const key = domainMatchKey(local.url, opts.matchKey);
    const remote = key ? remoteByKey.get(key) : undefined;
    let kind: PushDomainChangeKind = "add";
    if (remote) {
      kind = opts.overlapPolicy === "update_source" ? "update" : "unchanged";
    }
    if (opts.mode === "append_only" && remote) {
      kind = "unchanged";
    }
    if (opts.mode === "overwrite") {
      kind = remote ? "update" : "add";
    }
    return {
      localId: local.id,
      url: local.url,
      matchKey: key,
      kind,
      remoteId: remote?.id,
    };
  });

  return { domains, remoteDomainCount: remoteDomains.length };
}

/** Push local domains/groups/mocks to workspace with specified options. */
export async function pushWorkspaceSync(
  workspaceId: string,
  userId: string,
  options?: Partial<WorkspaceSyncOptions> | SyncMode,
): Promise<void> {
  const opts = normalizeOptions(options);
  const kindSet = new Set(opts.kinds);

  const res = await commands.exportAllSettings().then(unwrap);
  if (!res.success || !res.data) {
    throw new Error(res.message || "Export failed");
  }
  const localData = res.data;
  const localDomainsAll = localData.domains as unknown as DomainItem[];
  const localDomains = filterLocalDomains(localDomainsAll, opts.selectedDomainIds);

  let finalDomains = localDomains;
  let finalGroups = localData.groups as unknown as GroupItem[];
  let finalLinks = localData.domainGroupLinks as unknown as LinkItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalScenarios: any[] = localData.scenarios ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalMockRules: any[] = localData.mockRules ?? [];

  if (opts.mode !== "overwrite") {
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

        if (opts.mode === "append_only") {
          const remoteUrlSet = new Set(remoteDomains.map((d) => domainMatchKey(d.url, opts.matchKey)));
          const localNewDomains = localDomains.filter((d) => !remoteUrlSet.has(domainMatchKey(d.url, opts.matchKey)));
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
        } else if (opts.mode === "merge_url") {
          const remoteByKey = new Map(remoteDomains.map((d) => [domainMatchKey(d.url, opts.matchKey), d]));
          const mergedDomains: DomainItem[] = [...remoteDomains];

          for (const localDom of localDomains) {
            const key = domainMatchKey(localDom.url, opts.matchKey);
            const existingRemote = remoteByKey.get(key);
            if (existingRemote) {
              if (opts.overlapPolicy === "keep_target") {
                continue;
              }
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
        } else if (opts.mode === "merge_id") {
          const remoteById = new Map(remoteDomains.map((d) => [d.id, d]));
          const mergedDomains: DomainItem[] = [...remoteDomains];
          for (const localDom of localDomains) {
            const existing = remoteById.get(localDom.id);
            if (existing) {
              if (opts.overlapPolicy === "keep_target") {
                continue;
              }
              const idx = mergedDomains.findIndex((d) => d.id === existing.id);
              if (idx !== -1) {
                mergedDomains[idx] = { ...existing, ...localDom, id: existing.id };
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
  } else if (opts.selectedDomainIds) {
    // Overwrite with a filtered domain set still replaces remote domains payload entirely.
    finalDomains = localDomains;
  }

  const tasks: Promise<unknown>[] = [];
  if (kindSet.has("domains")) {
    tasks.push(pushResources(workspaceId, "domains", finalDomains, userId));
  }
  if (kindSet.has("groups")) {
    tasks.push(pushResources(workspaceId, "groups", finalGroups, userId));
  }
  if (kindSet.has("domain_group_links")) {
    tasks.push(pushResources(workspaceId, "domain_group_links", finalLinks, userId));
  }
  if (kindSet.has("scenarios")) {
    tasks.push(pushResources(workspaceId, "scenarios", finalScenarios, userId));
  }
  if (kindSet.has("mock_rules")) {
    tasks.push(pushResources(workspaceId, "mock_rules", finalMockRules, userId));
  }
  await Promise.all(tasks);
}

/** Pull workspace resources and merge into local settings using specified options. */
export async function pullWorkspaceSync(
  workspaceId: string,
  options?: Partial<WorkspaceSyncOptions> | SyncMode,
): Promise<void> {
  const opts = normalizeOptions(options);
  const kindSet = new Set(opts.kinds);

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

  let nextDomains = localData.domains as unknown as DomainItem[];
  let nextGroups = localData.groups as unknown as GroupItem[];
  let nextLinks = localData.domainGroupLinks as unknown as LinkItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextScenarios: any[] = localData.scenarios ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextMockRules: any[] = localData.mockRules ?? [];

  if (opts.mode === "overwrite") {
    if (kindSet.has("domains")) {
      nextDomains = remoteDomains;
    }
    if (kindSet.has("groups")) {
      nextGroups = remoteGroups;
    }
    if (kindSet.has("domain_group_links")) {
      nextLinks = remoteLinks;
    }
    if (kindSet.has("scenarios")) {
      nextScenarios = remoteScenarios;
    }
    if (kindSet.has("mock_rules")) {
      nextMockRules = remoteMockRules;
    }
  } else if (opts.mode === "append_only") {
    if (kindSet.has("domains")) {
      const localUrlSet = new Set(nextDomains.map((d) => domainMatchKey(d.url, opts.matchKey)));
      const newRemoteDomains = remoteDomains.filter((d) => !localUrlSet.has(domainMatchKey(d.url, opts.matchKey)));
      nextDomains = [...nextDomains, ...newRemoteDomains];
    }
    if (kindSet.has("groups")) {
      nextGroups = Array.from(
        new Map([
          ...nextGroups.map((g) => [g.id, g] as [number | string, GroupItem]),
          ...remoteGroups.map((g) => [g.id, g] as [number | string, GroupItem]),
        ]).values(),
      );
    }
    if (kindSet.has("domain_group_links")) {
      nextLinks = [...nextLinks, ...remoteLinks];
    }
    if (kindSet.has("scenarios")) {
      nextScenarios = [...nextScenarios, ...remoteScenarios];
    }
    if (kindSet.has("mock_rules")) {
      nextMockRules = [...nextMockRules, ...remoteMockRules];
    }
  } else if (opts.mode === "merge_url") {
    if (kindSet.has("domains")) {
      const localByKey = new Map(nextDomains.map((d) => [domainMatchKey(d.url, opts.matchKey), d]));
      const mergedDomains: DomainItem[] = [...nextDomains];
      for (const remDom of remoteDomains) {
        const key = domainMatchKey(remDom.url, opts.matchKey);
        const existingLocal = localByKey.get(key);
        if (existingLocal) {
          if (opts.overlapPolicy === "keep_target") {
            continue;
          }
          const idx = mergedDomains.findIndex((d) => d.id === existingLocal.id);
          if (idx !== -1) {
            mergedDomains[idx] = { ...existingLocal, ...remDom, id: existingLocal.id };
          }
        } else {
          mergedDomains.push(remDom);
        }
      }
      nextDomains = mergedDomains;
    }
    if (kindSet.has("groups")) {
      nextGroups = Array.from(
        new Map([
          ...nextGroups.map((g) => [g.id, g] as [number | string, GroupItem]),
          ...remoteGroups.map((g) => [g.id, g] as [number | string, GroupItem]),
        ]).values(),
      );
    }
    if (kindSet.has("domain_group_links")) {
      nextLinks = [...nextLinks, ...remoteLinks];
    }
    if (kindSet.has("scenarios")) {
      nextScenarios = [...nextScenarios, ...remoteScenarios];
    }
    if (kindSet.has("mock_rules")) {
      nextMockRules = [...nextMockRules, ...remoteMockRules];
    }
  } else {
    // merge_id
    if (kindSet.has("domains")) {
      const localById = new Map(nextDomains.map((d) => [d.id, d]));
      const mergedDomains: DomainItem[] = [...nextDomains];
      for (const remDom of remoteDomains) {
        const existingLocal = localById.get(remDom.id);
        if (existingLocal) {
          if (opts.overlapPolicy === "keep_target") {
            continue;
          }
          const idx = mergedDomains.findIndex((d) => d.id === existingLocal.id);
          if (idx !== -1) {
            mergedDomains[idx] = { ...existingLocal, ...remDom, id: existingLocal.id };
          }
        } else {
          mergedDomains.push(remDom);
        }
      }
      nextDomains = mergedDomains;
    }
    if (kindSet.has("groups")) {
      nextGroups = Array.from(
        new Map([
          ...nextGroups.map((g) => [g.id, g] as [number | string, GroupItem]),
          ...remoteGroups.map((g) => [g.id, g] as [number | string, GroupItem]),
        ]).values(),
      );
    }
    if (kindSet.has("domain_group_links")) {
      nextLinks = [...nextLinks, ...remoteLinks];
    }
    if (kindSet.has("scenarios")) {
      nextScenarios = [...nextScenarios, ...remoteScenarios];
    }
    if (kindSet.has("mock_rules")) {
      nextMockRules = [...nextMockRules, ...remoteMockRules];
    }
  }

  const payload = {
    ...localData,
    domains: nextDomains,
    groups: nextGroups,
    domainGroupLinks: nextLinks,
    scenarios: nextScenarios,
    mockRules: nextMockRules,
  };

  // Use overwrite so field updates on matched hosts actually land (merge import only inserts new hosts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await commands.importAllSettings(payload as any, "overwrite").then(unwrap);

  await notifyHubDataChanged("domains");
  await notifyHubDataChanged("groups");
}

export function syncKinds(): ResourceKind[] {
  return [...DEFAULT_SYNC_KINDS];
}
