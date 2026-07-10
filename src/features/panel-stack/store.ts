import { atom } from "jotai";
import type { SchemaProperty } from "@/features/sandbox";
import { atomWithWindowStorage } from "@/shared/lib/jotai/window-storage";
import type { HandoffTarget, HubHandoff } from "./lib/hubHandoff";
import type { PanelEntry } from "./types";

export type JsonSchemaHandoffSeed = {
  title: string;
  description: string;
  properties: SchemaProperty[];
  sampleJson: string;
};

export type SchemaExplorerHandoffSeed = {
  domainId?: number;
  method: string;
  path: string;
  sourceLabel?: string;
};

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
/** Transient UI state — not persisted (avoids localStorage sync on every toggle). */
export const domainListBulkModeAtom = atom(false);
export const domainListBulkSelectedIdsAtom = atom<ReadonlySet<number>>(new Set<number>());
/** Filtered domain ids in list order — used for range select / copy ordering */
export const domainListFilteredIdsAtom = atom<number[]>([]);
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
/** Pending handoff payload for cross-panel / cross-surface transfers */
export const hubHandoffAtom = atom<HubHandoff | null>(null);
export const hubHandoffConsumedIdAtom = atom<string | null>(null);
export const hubJsonSchemaSeedAtom = atom<JsonSchemaHandoffSeed | null>(null);
export const hubSchemaExplorerSeedAtom = atom<SchemaExplorerHandoffSeed | null>(null);
/** Host filter seed when opening global API logs from domain context bar */
export const hubApiLogsHostSeedAtom = atom<string | null>(null);
/** Navigation target from a handoff received via hubEvents (hub window only) */
export const hubHandoffRemoteTargetAtom = atom<HandoffTarget | null>(null);
