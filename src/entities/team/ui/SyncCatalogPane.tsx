import { Globe, Layers, Link2, ListTree, Zap } from "lucide-react";
import type { ReactNode } from "react";
import type { SyncDiffStatus } from "../syncDiff";
import { countDiffByStatus, KIND_LABELS, SYNC_CATALOG_KINDS } from "../syncDiff";
import type { ResourceKind } from "../types";

const KIND_ICONS: Record<ResourceKind, ReactNode> = {
  domains: <Globe className="w-3.5 h-3.5" />,
  mock_rules: <Zap className="w-3.5 h-3.5" />,
  groups: <Layers className="w-3.5 h-3.5" />,
  scenarios: <ListTree className="w-3.5 h-3.5" />,
  domain_group_links: <Link2 className="w-3.5 h-3.5" />,
};

export interface SyncCatalogCounts {
  kind: ResourceKind;
  localCount: number;
  remoteCount: number;
  byStatus: Record<SyncDiffStatus, number>;
}

interface SyncCatalogPaneProps {
  lang: "ko" | "en";
  activeKind: ResourceKind;
  onSelectKind: (kind: ResourceKind) => void;
  counts: Partial<Record<ResourceKind, SyncCatalogCounts>>;
  loading?: boolean;
}

export function SyncCatalogPane({ lang, activeKind, onSelectKind, counts, loading }: SyncCatalogPaneProps) {
  return (
    <div className="flex flex-col h-full min-h-0 w-[240px] min-w-[220px] shrink-0 border-r border-base-300 bg-base-100">
      <div className="px-3 py-2 border-b border-base-300 bg-base-200/60 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
          {lang === "ko" ? "1. 카테고리" : "1. Category"}
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1">
        {SYNC_CATALOG_KINDS.map((kind) => {
          const c = counts[kind];
          const diffCount =
            (c?.byStatus.local_only ?? 0) + (c?.byStatus.remote_only ?? 0) + (c?.byStatus.conflict ?? 0);
          const active = activeKind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onSelectKind(kind)}
              className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all flex flex-col gap-1 ${
                active
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-transparent hover:bg-base-200/70"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold flex items-center gap-1.5 truncate">
                  <span className={active ? "text-primary" : "text-base-content/50"}>{KIND_ICONS[kind]}</span>
                  {KIND_LABELS[kind][lang]}
                </span>
                {diffCount > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                    {diffCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-base-content/45 font-medium">
                <span>
                  {lang === "ko" ? "로컬" : "Local"} {loading && active ? "…" : (c?.localCount ?? "—")}
                </span>
                <span>·</span>
                <span>
                  {lang === "ko" ? "서버" : "Remote"} {loading && active ? "…" : (c?.remoteCount ?? "—")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function emptyCatalogCounts(kind: ResourceKind): SyncCatalogCounts {
  return {
    kind,
    localCount: 0,
    remoteCount: 0,
    byStatus: countDiffByStatus([]),
  };
}
