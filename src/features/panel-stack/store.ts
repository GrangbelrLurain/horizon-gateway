import { atom } from "jotai";
import { atomWithWindowStorage } from "@/shared/lib/jotai/window-storage";
import type { PanelEntry } from "./types";

export type DomainFeatureFilterMode = "all" | "active" | "inactive";
export type DomainFeatureKey = "monitor" | "proxy" | "api";
export type DomainListSortMode = "activity" | "name";

export const selectedDomainIdAtom = atom<number | null>(null);
export const panelStackAtom = atom<PanelEntry[]>([]);
export const domainListSearchAtom = atomWithWindowStorage("domain-list-search", "");
export const domainListGroupFilterAtom = atomWithWindowStorage<number | "all" | "none">(
  "domain-list-group-filter",
  "all",
);
export const domainListFeatureFilterAtom = atomWithWindowStorage<DomainFeatureFilterMode>(
  "domain-list-feature-filter",
  "all",
);
export const domainListFeatureRequireAtom = atomWithWindowStorage<DomainFeatureKey[]>(
  "domain-list-feature-require",
  [],
);
export const domainListSortAtom = atomWithWindowStorage<DomainListSortMode>("domain-list-sort", "activity");
export const domainApiLogsSearchAtom = atomWithWindowStorage("domain-api-logs-search", "");
export const domainApiLogsMethodAtom = atomWithWindowStorage<string>("domain-api-logs-method", "ALL");
export const domainListBulkModeAtom = atomWithWindowStorage("domain-list-bulk-mode", false);
export const domainListBulkSelectedIdsAtom = atom<number[]>([]);
export const domainListBulkSnapshotAtom = atom<{ domainId: number; panels: PanelEntry[] } | null>(null);
export const collapsedPanelsAtom = atom<Record<string, boolean>>({});
/** User manually expanded panels — auto-collapse skips these */
export const manualExpandedPanelsAtom = atom<Set<string>>(new Set<string>());
/** Collapsed panel overlay — panel id key */
export const panelOverlayOpenAtom = atom<string | null>(null);
/** Domain list overlay (strip tab click) */
export const domainListOverlayOpenAtom = atom(false);
/** Domain list pinned inline at deep depth (strip > click) */
export const domainListPinnedOpenAtom = atom(false);
