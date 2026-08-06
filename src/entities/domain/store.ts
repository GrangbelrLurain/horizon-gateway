import { commands, unwrap } from "@/shared/api";
import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import type { Domain } from "./types";

export const domainsAtom = atomWithBroadcast<Domain[]>("global-domains", []);

export interface DuplicateGroup {
  normalizedUrl: string;
  displayUrl: string;
  domains: Domain[];
  suggestedPrimaryId: number;
}

export type DuplicateMergePolicy = "merge_smart" | "keep_latest" | "keep_oldest";

/** Standardize domain URL for duplication comparison */
export function normalizeDomainUrl(url: string): string {
  let cleaned = url.trim().toLowerCase();
  if (cleaned.startsWith("http://")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("https://")) {
    cleaned = cleaned.slice(8);
  }
  if (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

/** Group domains by normalized URL and return duplicate clusters */
export function findDuplicateDomains(domains: Domain[]): DuplicateGroup[] {
  const map = new Map<string, Domain[]>();

  for (const d of domains) {
    const norm = normalizeDomainUrl(d.url);
    if (!norm) {
      continue;
    }
    const list = map.get(norm) ?? [];
    list.push(d);
    map.set(norm, list);
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [normUrl, list] of map.entries()) {
    if (list.length > 1) {
      const sorted = [...list].sort((a, b) => a.id - b.id);
      duplicates.push({
        normalizedUrl: normUrl,
        displayUrl: list[0].url,
        domains: list,
        suggestedPrimaryId: sorted[0].id,
      });
    }
  }

  return duplicates;
}

/**
 * Merges duplicate domains based on policy and specified primary domain IDs per group.
 * Re-allocates group links and local routes to primary domain ID, then deletes secondary duplicates.
 */
export async function executeDuplicateMerge(
  groups: DuplicateGroup[],
  policy: DuplicateMergePolicy,
  primaryIdMap: Record<string, number>,
): Promise<{ mergedGroupCount: number; deletedDomainCount: number }> {
  const secondaryIdsToRemove: number[] = [];

  const exportRes = await commands.exportAllSettings().then(unwrap);
  if (!exportRes.success || !exportRes.data) {
    throw new Error(exportRes.message || "Failed to export settings for merging.");
  }
  const settings = exportRes.data;

  const links = [...settings.domainGroupLinks];
  const routes = [...settings.localRoutes];

  for (const g of groups) {
    let chosenPrimaryId = primaryIdMap[g.normalizedUrl];

    if (!chosenPrimaryId) {
      if (policy === "keep_latest") {
        const sorted = [...g.domains].sort((a, b) => b.id - a.id);
        chosenPrimaryId = sorted[0].id;
      } else {
        const sorted = [...g.domains].sort((a, b) => a.id - b.id);
        chosenPrimaryId = sorted[0].id;
      }
    }

    const secondaries = g.domains.filter((d) => d.id !== chosenPrimaryId);
    const secIds = secondaries.map((d) => d.id);
    secondaryIdsToRemove.push(...secIds);

    for (let i = 0; i < links.length; i++) {
      if (secIds.includes(links[i].domain_id)) {
        const existsOnPrimary = links.some((l) => l.domain_id === chosenPrimaryId && l.group_id === links[i].group_id);
        if (!existsOnPrimary) {
          links[i] = { ...links[i], domain_id: chosenPrimaryId };
        }
      }
    }

    for (let i = 0; i < routes.length; i++) {
      if (routes[i].domain_id != null && secIds.includes(routes[i].domain_id as number)) {
        const existsOnPrimary = routes.some((r) => r.domain_id === chosenPrimaryId);
        if (!existsOnPrimary) {
          routes[i] = { ...routes[i], domain_id: chosenPrimaryId };
        }
      }
    }
  }

  if (secondaryIdsToRemove.length === 0) {
    return { mergedGroupCount: 0, deletedDomainCount: 0 };
  }

  const secSet = new Set(secondaryIdsToRemove);
  const remainingDomains = settings.domains.filter((d) => !secSet.has(d.id));

  const uniqueLinks = links.filter(
    (l, idx, self) =>
      !secSet.has(l.domain_id) &&
      self.findIndex((other) => other.domain_id === l.domain_id && other.group_id === l.group_id) === idx,
  );

  const newSettings = {
    ...settings,
    domains: remainingDomains,
    domainGroupLinks: uniqueLinks,
    localRoutes: routes.filter((r) => r.domain_id == null || !secSet.has(r.domain_id as number)),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await commands.importAllSettings(newSettings as any, "overwrite").then(unwrap);
  await notifyHubDataChanged("domains");
  await notifyHubDataChanged("groups");
  await notifyHubDataChanged("routes");

  return { mergedGroupCount: groups.length, deletedDomainCount: secondaryIdsToRemove.length };
}
