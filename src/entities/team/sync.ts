import { normalizeDomainUrl } from "@/entities/domain";
import type { MockRule } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { pullResources, pushResources } from "./api";
import { mockRuleMatchKey } from "./syncDiff";
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
  /** Push only: local mock rule ids to upload (merge into remote by match key). */
  selectedMockRuleIds?: string[];
  /** Pull only: domain match keys to merge from remote. */
  selectedDomainKeys?: string[];
  /** Pull only: mock rule match keys to merge from remote. */
  selectedMockRuleKeys?: string[];
  /** Generic match keys for selective sync (groups, scenarios, links). */
  selectedItemKeys?: string[];
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
    try {
      const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
      const u = new URL(withScheme);
      u.hash = "";
      let path = u.pathname;
      if (path.length > 1 && path.endsWith("/")) {
        path = path.slice(0, -1);
      }
      u.pathname = path;
      return u.href.toLowerCase();
    } catch {
      let cleaned = trimmed.toLowerCase();
      if (cleaned.endsWith("/")) {
        cleaned = cleaned.slice(0, -1);
      }
      return cleaned;
    }
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

function filterLocalMockRules(rules: MockRule[], selectedMockRuleIds?: string[]): MockRule[] {
  if (!selectedMockRuleIds) {
    return rules;
  }
  const selected = new Set(selectedMockRuleIds);
  return rules.filter((r) => selected.has(r.id));
}

async function mergeSelectedMocksIntoRemote(
  workspaceId: string,
  localMocksAll: MockRule[],
  selectedMockRuleIds: string[],
): Promise<MockRule[]> {
  const localSelected = filterLocalMockRules(localMocksAll, selectedMockRuleIds);
  let remoteMocks: MockRule[] = [];
  try {
    const rows = await pullResources(workspaceId);
    remoteMocks = (rows.find((r) => r.kind === "mock_rules")?.payload as MockRule[]) ?? [];
  } catch {
    remoteMocks = [];
  }
  const byKey = new Map(remoteMocks.map((m) => [mockRuleMatchKey(m), m]));
  for (const local of localSelected) {
    const key = mockRuleMatchKey(local);
    const existing = byKey.get(key);
    byKey.set(key, existing ? { ...existing, ...local, id: existing.id } : local);
  }
  return Array.from(byKey.values());
}

async function mergeSelectedDomainsIntoRemote(
  workspaceId: string,
  localDomainsAll: DomainItem[],
  selectedDomainIds: number[],
  opts: WorkspaceSyncOptions,
): Promise<DomainItem[]> {
  const localSelected = filterLocalDomains(localDomainsAll, selectedDomainIds);
  let remoteDomains: DomainItem[] = [];
  try {
    const rows = await pullResources(workspaceId);
    remoteDomains = (rows.find((r) => r.kind === "domains")?.payload as DomainItem[]) ?? [];
  } catch {
    remoteDomains = [];
  }
  const byKey = new Map(remoteDomains.map((d) => [domainMatchKey(d.url, opts.matchKey), d]));
  for (const local of localSelected) {
    const key = domainMatchKey(local.url, opts.matchKey);
    const existing = byKey.get(key);
    byKey.set(key, existing ? { ...existing, ...local, id: existing.id } : local);
  }
  return Array.from(byKey.values());
}

function selectionMatchesKey(selectedKeys: Set<string>, baseKey: string, itemId?: string | number): boolean {
  if (selectedKeys.has(baseKey)) {
    return true;
  }
  if (itemId == null) {
    return false;
  }
  return selectedKeys.has(`${baseKey}#${itemId}`) || selectedKeys.has(String(itemId));
}

function filterRemoteDomainsByKeys(
  remoteDomains: DomainItem[],
  selectedDomainKeys: string[],
  matchKey: DomainMatchKey,
): DomainItem[] {
  const keySet = new Set(selectedDomainKeys);
  return remoteDomains.filter((d) => selectionMatchesKey(keySet, domainMatchKey(d.url, matchKey), d.id));
}

function filterRemoteMocksByKeys(remoteMocks: MockRule[], selectedMockRuleKeys: string[]): MockRule[] {
  const keySet = new Set(selectedMockRuleKeys);
  return remoteMocks.filter((m) => selectionMatchesKey(keySet, mockRuleMatchKey(m), m.id));
}

function collectUsedDomainIds(domains: DomainItem[]): Set<number> {
  const used = new Set<number>();
  for (const d of domains) {
    const id = Number(d.id);
    if (Number.isFinite(id) && id > 0) {
      used.add(id);
    }
  }
  return used;
}

function nextDomainIdSeed(domains: DomainItem[]): number {
  let max = 0;
  for (const d of domains) {
    const id = Number(d.id);
    if (Number.isFinite(id) && id > max) {
      max = id;
    }
  }
  return max + 1;
}

/** Remote workspace ids may overlap local ids — assign a free local id for new imports. */
function assignLocalDomainId(usedIds: Set<number>, nextId: number, remoteId: unknown): { id: number; nextId: number } {
  const remoteNum = Number(remoteId);
  if (Number.isFinite(remoteNum) && remoteNum > 0 && !usedIds.has(remoteNum)) {
    usedIds.add(remoteNum);
    return { id: remoteNum, nextId: Math.max(nextId, remoteNum + 1) };
  }
  let id = nextId;
  while (usedIds.has(id)) {
    id += 1;
  }
  usedIds.add(id);
  return { id, nextId: id + 1 };
}

function appendImportedRemoteDomain(
  merged: DomainItem[],
  rem: DomainItem,
  usedIds: Set<number>,
  nextId: number,
): number {
  const { id, nextId: bumped } = assignLocalDomainId(usedIds, nextId, rem.id);
  merged.push({ ...rem, id });
  return bumped;
}

function mergeRemoteDomainsIntoLocalList(
  localDomains: DomainItem[],
  remoteDomains: DomainItem[],
  opts: WorkspaceSyncOptions,
): DomainItem[] {
  const localByKey = new Map(localDomains.map((d) => [domainMatchKey(d.url, opts.matchKey), d]));
  const merged: DomainItem[] = [...localDomains];
  const usedIds = collectUsedDomainIds(merged);
  let nextId = nextDomainIdSeed(merged);

  for (const remDom of remoteDomains) {
    const key = domainMatchKey(remDom.url, opts.matchKey);
    const existingLocal = localByKey.get(key);
    if (existingLocal) {
      if (opts.overlapPolicy === "keep_target") {
        continue;
      }
      const idx = merged.findIndex((d) => d.id === existingLocal.id);
      if (idx !== -1) {
        merged[idx] = { ...existingLocal, ...remDom, id: existingLocal.id };
      }
      continue;
    }
    nextId = appendImportedRemoteDomain(merged, remDom, usedIds, nextId);
  }

  return merged;
}

function mergeSelectedDomainsIntoLocal(
  localDomains: DomainItem[],
  remoteDomains: DomainItem[],
  selectedDomainKeys: string[],
  opts: WorkspaceSyncOptions,
): DomainItem[] {
  const toPull = filterRemoteDomainsByKeys(remoteDomains, selectedDomainKeys, opts.matchKey);
  const localByKey = new Map(localDomains.map((d) => [domainMatchKey(d.url, opts.matchKey), d]));
  const merged = [...localDomains];
  const usedIds = collectUsedDomainIds(merged);
  let nextId = nextDomainIdSeed(merged);
  for (const rem of toPull) {
    const key = domainMatchKey(rem.url, opts.matchKey);
    const existing = localByKey.get(key);
    if (existing) {
      const idx = merged.findIndex((d) => d.id === existing.id);
      if (idx !== -1) {
        merged[idx] = { ...existing, ...rem, id: existing.id };
      }
    } else {
      nextId = appendImportedRemoteDomain(merged, rem, usedIds, nextId);
    }
  }
  return merged;
}

function mergeSelectedMocksIntoLocal(
  localMocks: MockRule[],
  remoteMocks: MockRule[],
  selectedMockRuleKeys: string[],
): MockRule[] {
  const toPull = filterRemoteMocksByKeys(remoteMocks, selectedMockRuleKeys);
  const localByKey = new Map(localMocks.map((m) => [mockRuleMatchKey(m), m]));
  const merged = [...localMocks];
  for (const rem of toPull) {
    const key = mockRuleMatchKey(rem);
    const existing = localByKey.get(key);
    if (existing) {
      const idx = merged.findIndex((m) => m.id === existing.id);
      if (idx !== -1) {
        merged[idx] = { ...existing, ...rem, id: existing.id };
      }
    } else {
      merged.push(rem);
    }
  }
  return merged;
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
    let domainsPayload = finalDomains;
    if (opts.selectedDomainIds?.length) {
      domainsPayload = await mergeSelectedDomainsIntoRemote(workspaceId, localDomainsAll, opts.selectedDomainIds, opts);
    }
    tasks.push(pushResources(workspaceId, "domains", domainsPayload, userId));
  }
  if (kindSet.has("groups")) {
    let groupsPayload = finalGroups;
    if (opts.selectedItemKeys?.length && kindSet.size === 1 && kindSet.has("groups")) {
      const keySet = new Set(opts.selectedItemKeys);
      const localSelected = (localData.groups as unknown as GroupItem[]).filter((g) => keySet.has(String(g.id)));
      let remoteGroups: GroupItem[] = [];
      try {
        const rows = await pullResources(workspaceId);
        remoteGroups = (rows.find((r) => r.kind === "groups")?.payload as GroupItem[]) ?? [];
      } catch {
        remoteGroups = [];
      }
      const byId = new Map(remoteGroups.map((g) => [String(g.id), g]));
      for (const g of localSelected) {
        byId.set(String(g.id), g);
      }
      groupsPayload = Array.from(byId.values());
    }
    tasks.push(pushResources(workspaceId, "groups", groupsPayload, userId));
  }
  if (kindSet.has("domain_group_links")) {
    let linksPayload = finalLinks;
    if (opts.selectedItemKeys?.length && kindSet.size === 1 && kindSet.has("domain_group_links")) {
      const keySet = new Set(opts.selectedItemKeys);
      const localSelected = (localData.domainGroupLinks as unknown[]).filter((l, i) => {
        const key = JSON.stringify(l) || `local-${i}`;
        return keySet.has(key);
      });
      let remoteLinks: LinkItem[] = [];
      try {
        const rows = await pullResources(workspaceId);
        remoteLinks = (rows.find((r) => r.kind === "domain_group_links")?.payload as LinkItem[]) ?? [];
      } catch {
        remoteLinks = [];
      }
      const byKey = new Map(remoteLinks.map((l, i) => [JSON.stringify(l) || `remote-${i}`, l]));
      for (const l of localSelected) {
        byKey.set(JSON.stringify(l), l as LinkItem);
      }
      linksPayload = Array.from(byKey.values());
    }
    tasks.push(pushResources(workspaceId, "domain_group_links", linksPayload, userId));
  }
  if (kindSet.has("scenarios")) {
    let scenariosPayload = finalScenarios;
    if (opts.selectedItemKeys?.length && kindSet.size === 1 && kindSet.has("scenarios")) {
      const keySet = new Set(opts.selectedItemKeys);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localSelected = ((localData.scenarios ?? []) as any[]).filter((s, i) => keySet.has(s.id ?? `local-${i}`));
      let remoteScenarios: unknown[] = [];
      try {
        const rows = await pullResources(workspaceId);
        remoteScenarios = (rows.find((r) => r.kind === "scenarios")?.payload as unknown[]) ?? [];
      } catch {
        remoteScenarios = [];
      }
      const byKey = new Map(
        remoteScenarios.map((s, i) => {
          const item = s as { id?: string };
          return [item.id ?? `remote-${i}`, s];
        }),
      );
      for (const s of localSelected) {
        const item = s as { id?: string };
        byKey.set(item.id ?? JSON.stringify(s), s);
      }
      scenariosPayload = Array.from(byKey.values());
    }
    tasks.push(pushResources(workspaceId, "scenarios", scenariosPayload, userId));
  }
  if (kindSet.has("mock_rules")) {
    let mocksPayload = finalMockRules;
    if (opts.selectedMockRuleIds?.length) {
      mocksPayload = await mergeSelectedMocksIntoRemote(
        workspaceId,
        (localData.mockRules as MockRule[]) ?? [],
        opts.selectedMockRuleIds,
      );
    }
    tasks.push(pushResources(workspaceId, "mock_rules", mocksPayload, userId));
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
  const remoteMockRules = (byKind.mock_rules as MockRule[]) ?? [];

  let nextDomains = localData.domains as unknown as DomainItem[];
  let nextGroups = localData.groups as unknown as GroupItem[];
  let nextLinks = localData.domainGroupLinks as unknown as LinkItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextScenarios: any[] = localData.scenarios ?? [];
  let nextMockRules: MockRule[] = (localData.mockRules as MockRule[]) ?? [];

  if (opts.mode === "overwrite") {
    if (kindSet.has("domains")) {
      nextDomains = opts.selectedDomainKeys?.length
        ? mergeSelectedDomainsIntoLocal(nextDomains, remoteDomains, opts.selectedDomainKeys, opts)
        : remoteDomains;
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
      nextMockRules = opts.selectedMockRuleKeys?.length
        ? mergeSelectedMocksIntoLocal(nextMockRules, remoteMockRules, opts.selectedMockRuleKeys)
        : remoteMockRules;
    }
  } else if (opts.mode === "append_only") {
    if (kindSet.has("domains")) {
      if (opts.selectedDomainKeys?.length) {
        nextDomains = mergeSelectedDomainsIntoLocal(nextDomains, remoteDomains, opts.selectedDomainKeys, opts);
      } else {
        nextDomains = mergeRemoteDomainsIntoLocalList(nextDomains, remoteDomains, opts);
      }
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
      if (opts.selectedMockRuleKeys?.length) {
        nextMockRules = mergeSelectedMocksIntoLocal(nextMockRules, remoteMockRules, opts.selectedMockRuleKeys);
      } else {
        nextMockRules = [...nextMockRules, ...remoteMockRules];
      }
    }
  } else if (opts.mode === "merge_url") {
    if (kindSet.has("domains")) {
      if (opts.selectedDomainKeys?.length) {
        nextDomains = mergeSelectedDomainsIntoLocal(nextDomains, remoteDomains, opts.selectedDomainKeys, opts);
      } else {
        nextDomains = mergeRemoteDomainsIntoLocalList(nextDomains, remoteDomains, opts);
      }
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
      if (opts.selectedMockRuleKeys?.length) {
        nextMockRules = mergeSelectedMocksIntoLocal(nextMockRules, remoteMockRules, opts.selectedMockRuleKeys);
      } else {
        nextMockRules = [...nextMockRules, ...remoteMockRules];
      }
    }
  } else {
    // merge_id
    if (kindSet.has("domains")) {
      if (opts.selectedDomainKeys?.length) {
        nextDomains = mergeSelectedDomainsIntoLocal(nextDomains, remoteDomains, opts.selectedDomainKeys, opts);
      } else {
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
      if (opts.selectedMockRuleKeys?.length) {
        nextMockRules = mergeSelectedMocksIntoLocal(nextMockRules, remoteMockRules, opts.selectedMockRuleKeys);
      } else {
        nextMockRules = [...nextMockRules, ...remoteMockRules];
      }
    }
  }

  const payload = {
    ...localData,
    version: localData?.version ?? 3,
    schemaVersion: localData?.schemaVersion ?? 3,
    app: localData?.app || "horizon-gateway",
    domains: nextDomains,
    groups: nextGroups,
    domainGroupLinks: nextLinks,
    scenarios: nextScenarios,
    mockRules: nextMockRules,
  };

  // Use overwrite so field updates on matched hosts actually land (merge import only inserts new hosts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const importRes = await commands.importAllSettings(payload as any, "overwrite").then(unwrap);
  if (!importRes.success) {
    throw new Error(importRes.message || "Import failed");
  }

  await notifyHubDataChanged("domains");
  await notifyHubDataChanged("groups");
}

export function syncKinds(): ResourceKind[] {
  return [...DEFAULT_SYNC_KINDS];
}
