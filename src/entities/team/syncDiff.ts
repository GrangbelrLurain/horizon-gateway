import type { DomainGroupLink, MockRule, Scenario } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { pullResources } from "./api";
import { type DomainMatchKey, domainMatchKey, type WorkspaceSyncOptions } from "./sync";
import type { ResourceKind } from "./types";

export type SyncDiffStatus = "local_only" | "remote_only" | "same" | "conflict";

export interface SyncDiffItem {
  key: string;
  status: SyncDiffStatus;
  label: string;
  detail?: string;
  /** Human-readable diff when status is conflict. */
  conflictDetail?: string;
  /** Non-blocking note (e.g. URL differs under host matching). */
  infoDetail?: string;
  localDetail?: string;
  remoteDetail?: string;
  localId?: number | string;
  remoteId?: number | string;
}

export interface SyncDiffResult {
  kind: ResourceKind;
  items: SyncDiffItem[];
  localCount: number;
  remoteCount: number;
}

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

interface LinkResolveContext {
  domainUrlById: Map<number, string>;
  groupNameById: Map<number, string>;
  matchKey: DomainMatchKey;
}

export const SYNC_CATALOG_KINDS: ResourceKind[] = [
  "domains",
  "mock_rules",
  "groups",
  "scenarios",
  "domain_group_links",
];

export const SYNC_DIFF_KINDS: ResourceKind[] = ["domains", "mock_rules"];

export const KIND_LABELS: Record<ResourceKind, { ko: string; en: string }> = {
  domains: { ko: "도메인", en: "Domains" },
  mock_rules: { ko: "Mock 규칙", en: "Mock rules" },
  groups: { ko: "그룹", en: "Groups" },
  scenarios: { ko: "시나리오", en: "Scenarios" },
  domain_group_links: { ko: "그룹 연결", en: "Group links" },
};

export function mockRuleMatchKey(rule: Pick<MockRule, "method" | "url_pattern">): string {
  return `${(rule.method ?? "GET").toUpperCase()} ${(rule.url_pattern ?? "").trim()}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function fmtValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "ON" : "OFF";
  }
  return String(value);
}

function diffRecordFields(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  fields: { key: string; label: string }[],
): string {
  const parts: string[] = [];
  for (const { key, label } of fields) {
    const lv = local[key];
    const rv = remote[key];
    if (stableJson(lv) !== stableJson(rv)) {
      parts.push(`${label}: ${fmtValue(rv)} → ${fmtValue(lv)}`);
    }
  }
  return parts.join(" · ");
}

function summarizeRecord(record: Record<string, unknown>, fields: { key: string; label: string }[]): string {
  return fields.map(({ key, label }) => `${label}=${fmtValue(record[key])}`).join(", ");
}

function domainComparable(d: DomainItem, _matchKey: DomainMatchKey): unknown {
  // Host-based matching treats rows as the same domain entry; only settings matter.
  return { enabled: d.enabled ?? true };
}

const DOMAIN_DIFF_FIELDS = [{ key: "enabled", label: "enabled" }] as const;

function mockComparable(m: MockRule): unknown {
  return {
    name: m.name,
    method: m.method,
    url_pattern: m.url_pattern,
    host: m.host,
    response_status: m.response_status,
    response_body: m.response_body,
    enabled: m.enabled,
    scenario_id: m.scenario_id,
  };
}

const MOCK_DIFF_FIELDS = [
  { key: "name", label: "name" },
  { key: "method", label: "method" },
  { key: "url_pattern", label: "pattern" },
  { key: "enabled", label: "enabled" },
  { key: "response_status", label: "status" },
] as const;

const SCENARIO_DIFF_FIELDS = [
  { key: "name", label: "name" },
  { key: "description", label: "desc" },
  { key: "enabled", label: "enabled" },
] as const;

function scenarioComparable(s: Scenario): Record<string, unknown> {
  return {
    name: s.name,
    description: s.description ?? "",
    enabled: s.enabled,
  };
}

function groupComparable(g: GroupItem): unknown {
  return { name: g.name };
}

function buildDomainUrlLookup(local: DomainItem[], remote: DomainItem[]): Map<number, string> {
  const lookup = new Map<number, string>();
  for (const d of [...local, ...remote]) {
    lookup.set(d.id, d.url);
  }
  return lookup;
}

function buildGroupNameLookup(local: GroupItem[], remote: GroupItem[]): Map<number, string> {
  const lookup = new Map<number, string>();
  for (const g of [...local, ...remote]) {
    lookup.set(Number(g.id), g.name);
  }
  return lookup;
}

function buildLinkResolveContext(
  localDomains: DomainItem[],
  remoteDomains: DomainItem[],
  localGroups: GroupItem[],
  remoteGroups: GroupItem[],
  matchKey: DomainMatchKey,
): LinkResolveContext {
  return {
    domainUrlById: buildDomainUrlLookup(localDomains, remoteDomains),
    groupNameById: buildGroupNameLookup(localGroups, remoteGroups),
    matchKey,
  };
}

function resolveDomainUrl(domainId: number, ctx: LinkResolveContext): string {
  return ctx.domainUrlById.get(domainId) ?? `#domain-${domainId}`;
}

function resolveGroupName(groupId: number, ctx: LinkResolveContext): string {
  return ctx.groupNameById.get(groupId) ?? `#group-${groupId}`;
}

function linkMatchKey(link: DomainGroupLink, ctx: LinkResolveContext): string {
  const url = resolveDomainUrl(link.domain_id, ctx);
  const groupName = resolveGroupName(link.group_id, ctx);
  const hostKey = domainMatchKey(url, ctx.matchKey);
  return `${hostKey}::${normalizeName(groupName)}`;
}

function linkComparable(link: DomainGroupLink, ctx: LinkResolveContext): string {
  return linkMatchKey(link, ctx);
}

function linkLabel(link: DomainGroupLink, ctx: LinkResolveContext): { label: string; detail: string } {
  const url = resolveDomainUrl(link.domain_id, ctx);
  const groupName = resolveGroupName(link.group_id, ctx);
  return { label: url, detail: groupName };
}

async function loadLocalExport() {
  const res = await commands.exportAllSettings().then(unwrap);
  if (!res.success || !res.data) {
    throw new Error(res.message || "Export failed");
  }
  return res.data;
}

async function loadRemoteByKind(workspaceId: string): Promise<Partial<Record<ResourceKind, unknown[]>>> {
  try {
    const rows = await pullResources(workspaceId);
    return Object.fromEntries(rows.map((r) => [r.kind, r.payload as unknown[]])) as Partial<
      Record<ResourceKind, unknown[]>
    >;
  } catch {
    return {};
  }
}

interface DiffSide {
  key: string;
  label: string;
  detail?: string;
  localId?: number | string;
  remoteId?: number | string;
  payload: unknown;
  summary?: string;
}

function buildPairDiff(
  localMap: Map<string, DiffSide>,
  remoteMap: Map<string, DiffSide>,
  conflictFields?: { key: string; label: string }[],
): SyncDiffItem[] {
  const keys = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const items: SyncDiffItem[] = [];

  for (const key of keys) {
    const local = localMap.get(key);
    const remote = remoteMap.get(key);
    if (local && remote) {
      const same = stableJson(local.payload) === stableJson(remote.payload);
      const localPayload = local.payload as Record<string, unknown>;
      const remotePayload = remote.payload as Record<string, unknown>;
      items.push({
        key,
        status: same ? "same" : "conflict",
        label: local.label || remote.label,
        detail: local.detail || remote.detail,
        localId: local.localId,
        remoteId: remote.remoteId,
        conflictDetail:
          !same && conflictFields
            ? diffRecordFields(localPayload, remotePayload, conflictFields)
            : !same
              ? local.summary && remote.summary
                ? `${remote.summary} ↔ ${local.summary}`
                : undefined
              : undefined,
        localDetail: local.summary ?? local.detail,
        remoteDetail: remote.summary ?? remote.detail,
      });
    } else if (local) {
      items.push({
        key,
        status: "local_only",
        label: local.label,
        detail: local.detail,
        localDetail: local.summary ?? local.detail,
        localId: local.localId,
      });
    } else if (remote) {
      items.push({
        key,
        status: "remote_only",
        label: remote.label,
        detail: remote.detail,
        remoteDetail: remote.summary ?? remote.detail,
        remoteId: remote.remoteId,
      });
    }
  }

  return items.sort((a, b) => a.label.localeCompare(b.label) || (a.detail ?? "").localeCompare(b.detail ?? ""));
}

function buildDomainDiff(
  localDomains: DomainItem[],
  remoteDomains: DomainItem[],
  matchKey: DomainMatchKey,
): SyncDiffItem[] {
  const localMap = new Map(
    localDomains.map((d) => {
      const key = domainMatchKey(d.url, matchKey);
      return [
        key,
        {
          key,
          label: d.url,
          detail: matchKey === "exact_url" ? undefined : `match(${matchKey}): ${key}`,
          localId: d.id,
          payload: domainComparable(d, matchKey),
          summary: d.url,
        },
      ];
    }),
  );
  const remoteMap = new Map(
    remoteDomains.map((d) => {
      const key = domainMatchKey(d.url, matchKey);
      return [
        key,
        {
          key,
          label: d.url,
          detail: matchKey === "exact_url" ? undefined : `match(${matchKey}): ${key}`,
          remoteId: d.id,
          payload: domainComparable(d, matchKey),
          summary: d.url,
        },
      ];
    }),
  );

  const items = buildPairDiff(localMap, remoteMap, [...DOMAIN_DIFF_FIELDS]);

  return items.map((item) => {
    const local = localMap.get(item.key);
    const remote = remoteMap.get(item.key);
    if (!local || !remote) {
      return item;
    }

    const localUrl = local.summary ?? local.label;
    const remoteUrl = remote.summary ?? remote.label;
    const urlsDiffer = localUrl !== remoteUrl;

    if (urlsDiffer && matchKey !== "exact_url") {
      const urlNote =
        matchKey === "hostname"
          ? `same host, different URL`
          : matchKey === "host_port"
            ? `same host:port, different URL`
            : `different URL`;
      return {
        ...item,
        infoDetail: `${urlNote} · local=${localUrl} · remote=${remoteUrl}`,
        localDetail: localUrl,
        remoteDetail: remoteUrl,
        conflictDetail:
          item.status === "conflict"
            ? [item.conflictDetail, `url: ${remoteUrl} → ${localUrl}`].filter(Boolean).join(" · ")
            : item.conflictDetail,
      };
    }

    if (item.status === "conflict" && matchKey === "exact_url" && urlsDiffer) {
      return {
        ...item,
        conflictDetail: [`url: ${remoteUrl} → ${localUrl}`, item.conflictDetail].filter(Boolean).join(" · "),
        localDetail: localUrl,
        remoteDetail: remoteUrl,
      };
    }

    if (item.status === "conflict") {
      return {
        ...item,
        localDetail: localUrl,
        remoteDetail: remoteUrl,
      };
    }

    return item;
  });
}

function buildMockDiff(localMocks: MockRule[], remoteMocks: MockRule[]): SyncDiffItem[] {
  const localMap = new Map(
    localMocks.map((m) => [
      mockRuleMatchKey(m),
      {
        key: mockRuleMatchKey(m),
        label: m.name || m.url_pattern,
        detail: `${m.method} ${m.url_pattern}`,
        localId: m.id,
        payload: mockComparable(m),
        summary: summarizeRecord(mockComparable(m) as Record<string, unknown>, [...MOCK_DIFF_FIELDS]),
      },
    ]),
  );
  const remoteMap = new Map(
    remoteMocks.map((m) => [
      mockRuleMatchKey(m),
      {
        key: mockRuleMatchKey(m),
        label: m.name || m.url_pattern,
        detail: `${m.method} ${m.url_pattern}`,
        remoteId: m.id,
        payload: mockComparable(m),
        summary: summarizeRecord(mockComparable(m) as Record<string, unknown>, [...MOCK_DIFF_FIELDS]),
      },
    ]),
  );
  return buildPairDiff(localMap, remoteMap, [...MOCK_DIFF_FIELDS]);
}

function buildGroupDiff(localGroups: GroupItem[], remoteGroups: GroupItem[]): SyncDiffItem[] {
  const localMap = new Map(
    localGroups.map((g) => [
      normalizeName(g.name),
      {
        key: normalizeName(g.name),
        label: g.name,
        localId: g.id,
        payload: groupComparable(g),
      },
    ]),
  );
  const remoteMap = new Map(
    remoteGroups.map((g) => [
      normalizeName(g.name),
      {
        key: normalizeName(g.name),
        label: g.name,
        remoteId: g.id,
        payload: groupComparable(g),
      },
    ]),
  );
  return buildPairDiff(localMap, remoteMap, [{ key: "name", label: "name" }]);
}

function buildScenarioDiff(localScenarios: Scenario[], remoteScenarios: Scenario[]): SyncDiffItem[] {
  const localMap = new Map(
    localScenarios.map((s) => {
      const key = normalizeName(s.name);
      const payload = scenarioComparable(s);
      return [
        key,
        {
          key,
          label: s.name,
          detail: s.description ?? undefined,
          localId: s.id,
          payload,
          summary: summarizeRecord(payload, [...SCENARIO_DIFF_FIELDS]),
        },
      ];
    }),
  );
  const remoteMap = new Map(
    remoteScenarios.map((s) => {
      const key = normalizeName(s.name);
      const payload = scenarioComparable(s);
      return [
        key,
        {
          key,
          label: s.name,
          detail: s.description ?? undefined,
          remoteId: s.id,
          payload,
          summary: summarizeRecord(payload, [...SCENARIO_DIFF_FIELDS]),
        },
      ];
    }),
  );
  return buildPairDiff(localMap, remoteMap, [...SCENARIO_DIFF_FIELDS]);
}

function buildLinkDiff(
  localLinks: DomainGroupLink[],
  remoteLinks: DomainGroupLink[],
  ctx: LinkResolveContext,
): SyncDiffItem[] {
  const localMap = new Map(
    localLinks.map((link) => {
      const key = linkMatchKey(link, ctx);
      const { label, detail } = linkLabel(link, ctx);
      return [
        key,
        {
          key,
          label,
          detail,
          payload: linkComparable(link, ctx),
          summary: `${label} · ${detail}`,
        },
      ];
    }),
  );
  const remoteMap = new Map(
    remoteLinks.map((link) => {
      const key = linkMatchKey(link, ctx);
      const { label, detail } = linkLabel(link, ctx);
      return [
        key,
        {
          key,
          label,
          detail,
          payload: linkComparable(link, ctx),
          summary: `${label} · ${detail}`,
        },
      ];
    }),
  );
  return buildPairDiff(localMap, remoteMap);
}

/** Items selectable for push/pull (excludes already-in-sync rows). */
export function filterItemsForAction(action: "push" | "pull", items: SyncDiffItem[]): SyncDiffItem[] {
  if (action === "push") {
    return items.filter((i) => i.status === "local_only" || i.status === "conflict");
  }
  return items.filter((i) => i.status === "remote_only" || i.status === "conflict");
}

/** Items shown in the list for the current direction (includes synced rows). */
export function visibleItemsForAction(action: "push" | "pull", items: SyncDiffItem[]): SyncDiffItem[] {
  if (action === "push") {
    return items.filter((i) => i.status !== "remote_only");
  }
  return items.filter((i) => i.status !== "local_only");
}

/** Cached local export + remote workspace resources (single fetch pair). */
export interface SyncSnapshot {
  localData: NonNullable<Awaited<ReturnType<typeof loadLocalExport>>>;
  remoteByKind: Partial<Record<ResourceKind, unknown[]>>;
}

export async function loadSyncSnapshot(workspaceId: string): Promise<SyncSnapshot> {
  const [localData, remoteByKind] = await Promise.all([loadLocalExport(), loadRemoteByKind(workspaceId)]);
  return { localData, remoteByKind };
}

export function buildSyncDiffFromSnapshot(
  snapshot: SyncSnapshot,
  kind: ResourceKind,
  options?: Pick<WorkspaceSyncOptions, "matchKey">,
): SyncDiffResult {
  const matchKey = options?.matchKey ?? "hostname";
  const { localData, remoteByKind } = snapshot;

  const localDomains = (localData.domains as unknown as DomainItem[]) ?? [];
  const remoteDomains = (remoteByKind.domains as DomainItem[]) ?? [];
  const localGroups = (localData.groups as unknown as GroupItem[]) ?? [];
  const remoteGroups = (remoteByKind.groups as GroupItem[]) ?? [];

  switch (kind) {
    case "domains": {
      const items = buildDomainDiff(localDomains, remoteDomains, matchKey);
      return { kind, items, localCount: localDomains.length, remoteCount: remoteDomains.length };
    }
    case "mock_rules": {
      const local = (localData.mockRules as MockRule[]) ?? [];
      const remote = (remoteByKind.mock_rules as MockRule[]) ?? [];
      const items = buildMockDiff(local, remote);
      return { kind, items, localCount: local.length, remoteCount: remote.length };
    }
    case "groups": {
      const items = buildGroupDiff(localGroups, remoteGroups);
      return { kind, items, localCount: localGroups.length, remoteCount: remoteGroups.length };
    }
    case "scenarios": {
      const local = (localData.scenarios as Scenario[]) ?? [];
      const remote = (remoteByKind.scenarios as Scenario[]) ?? [];
      const items = buildScenarioDiff(local, remote);
      return { kind, items, localCount: local.length, remoteCount: remote.length };
    }
    case "domain_group_links": {
      const local = (localData.domainGroupLinks as DomainGroupLink[]) ?? [];
      const remote = (remoteByKind.domain_group_links as DomainGroupLink[]) ?? [];
      const linkCtx = buildLinkResolveContext(localDomains, remoteDomains, localGroups, remoteGroups, matchKey);
      const items = buildLinkDiff(local, remote, linkCtx);
      return { kind, items, localCount: local.length, remoteCount: remote.length };
    }
    default:
      return { kind, items: [], localCount: 0, remoteCount: 0 };
  }
}

export function buildCatalogCountsFromSnapshot(
  snapshot: SyncSnapshot,
  matchKey: DomainMatchKey = "hostname",
): Partial<
  Record<
    ResourceKind,
    { kind: ResourceKind; localCount: number; remoteCount: number; byStatus: Record<SyncDiffStatus, number> }
  >
> {
  return Object.fromEntries(
    SYNC_CATALOG_KINDS.map((kind) => {
      const result = buildSyncDiffFromSnapshot(snapshot, kind, { matchKey });
      return [
        kind,
        {
          kind,
          localCount: result.localCount,
          remoteCount: result.remoteCount,
          byStatus: countDiffByStatus(result.items),
        },
      ];
    }),
  );
}

/** Compare local vs workspace resources for one kind (loads from server each call). */
export async function buildSyncDiff(
  workspaceId: string,
  kind: ResourceKind,
  options?: Pick<WorkspaceSyncOptions, "matchKey">,
): Promise<SyncDiffResult> {
  const snapshot = await loadSyncSnapshot(workspaceId);
  return buildSyncDiffFromSnapshot(snapshot, kind, options);
}

export function countDiffByStatus(items: SyncDiffItem[]): Record<SyncDiffStatus, number> {
  return items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { local_only: 0, remote_only: 0, same: 0, conflict: 0 } as Record<SyncDiffStatus, number>,
  );
}

/** Default selectable keys for push/pull from diff rows. */
export function defaultSelectableKeys(action: "push" | "pull", items: SyncDiffItem[]): string[] {
  return filterItemsForAction(action, items).map((i) => i.key);
}
