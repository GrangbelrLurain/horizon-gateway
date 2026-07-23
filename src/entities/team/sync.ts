import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { pullResources, pushResources } from "./api";
import type { ResourceKind } from "./types";

const SYNC_KINDS: ResourceKind[] = ["domains", "groups", "domain_group_links", "scenarios", "mock_rules"];

/** Push local domains/groups/mocks (no CA/tokens/logs) to the workspace. */
export async function pushWorkspaceSync(workspaceId: string, userId: string): Promise<void> {
  const res = await commands.exportAllSettings().then(unwrap);
  if (!res.success || !res.data) {
    throw new Error(res.message || "Export failed");
  }
  const data = res.data;
  await Promise.all([
    pushResources(workspaceId, "domains", data.domains, userId),
    pushResources(workspaceId, "groups", data.groups, userId),
    pushResources(workspaceId, "domain_group_links", data.domainGroupLinks, userId),
    pushResources(workspaceId, "scenarios", data.scenarios ?? [], userId),
    pushResources(workspaceId, "mock_rules", data.mockRules ?? [], userId),
  ]);
}

/** Pull workspace resources and merge into local settings. */
export async function pullWorkspaceSync(workspaceId: string): Promise<void> {
  const rows = await pullResources(workspaceId);
  if (rows.length === 0) {
    throw new Error("No remote resources");
  }

  const byKind = Object.fromEntries(rows.map((r) => [r.kind, r.payload])) as Partial<Record<ResourceKind, unknown>>;

  const local = await commands.exportAllSettings().then(unwrap);
  if (!local.success || !local.data) {
    throw new Error(local.message || "Local export failed");
  }

  const payload = {
    ...local.data,
    domains: (byKind.domains as typeof local.data.domains) ?? local.data.domains,
    groups: (byKind.groups as typeof local.data.groups) ?? local.data.groups,
    domainGroupLinks: (byKind.domain_group_links as typeof local.data.domainGroupLinks) ?? local.data.domainGroupLinks,
    scenarios: (byKind.scenarios as typeof local.data.scenarios) ?? local.data.scenarios ?? [],
    mockRules: (byKind.mock_rules as typeof local.data.mockRules) ?? local.data.mockRules ?? [],
  };

  await commands.importAllSettings(payload, "merge").then(unwrap);
  await notifyHubDataChanged("domains");
}

export function syncKinds(): ResourceKind[] {
  return [...SYNC_KINDS];
}
