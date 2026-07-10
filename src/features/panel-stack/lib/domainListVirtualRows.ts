import type { Domain } from "@/shared/api";

export type DomainListVirtualRow =
  | { kind: "header"; groupId: number | "none"; label: string; count: number }
  | { kind: "domain"; domainId: number };

export const DOMAIN_LIST_GROUP_HEADER_HEIGHT = 28;
export const DOMAIN_LIST_DOMAIN_ROW_HEIGHT = 46;

export function buildDomainListVirtualRows(
  sortedGroups: { id: number; name: string }[],
  grouped: Map<number | "none", Domain[]>,
  collapsedGroups: ReadonlySet<number | "none">,
  ungroupedLabel: string,
): DomainListVirtualRow[] {
  const rows: DomainListVirtualRow[] = [];

  for (const g of sortedGroups) {
    const items = grouped.get(g.id);
    if (!items?.length) {
      continue;
    }
    rows.push({ kind: "header", groupId: g.id, label: g.name, count: items.length });
    if (!collapsedGroups.has(g.id)) {
      for (const d of items) {
        rows.push({ kind: "domain", domainId: d.id });
      }
    }
  }

  const ungrouped = grouped.get("none");
  if (ungrouped?.length) {
    rows.push({ kind: "header", groupId: "none", label: ungroupedLabel, count: ungrouped.length });
    if (!collapsedGroups.has("none")) {
      for (const d of ungrouped) {
        rows.push({ kind: "domain", domainId: d.id });
      }
    }
  }

  return rows;
}
