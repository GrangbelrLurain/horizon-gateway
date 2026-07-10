import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { memo, useRef } from "react";
import type { DomainFeatureState } from "@/entities/domain";
import {
  DOMAIN_LIST_DOMAIN_ROW_HEIGHT,
  DOMAIN_LIST_GROUP_HEADER_HEIGHT,
  type DomainListVirtualRow,
} from "../lib/domainListVirtualRows";
import { MemoDomainListItem } from "./DomainListItem";

type VirtualizedGroupedDomainListProps = {
  virtualRows: DomainListVirtualRow[];
  domainListMeta: Map<number, { displayUrl: string; featureState: DomainFeatureState }>;
  collapsedGroups: ReadonlySet<number | "none">;
  onToggleGroup: (groupId: number | "none") => void;
};

function GroupHeader({
  label,
  count,
  collapsed,
  showFolderIcon,
  onToggle,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  showFolderIcon: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] font-black uppercase tracking-widest text-base-content/40 hover:text-base-content/60"
    >
      {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {showFolderIcon && <Folder className="w-3 h-3" />}
      {label}
      <span className="ml-auto">{count}</span>
    </button>
  );
}

function VirtualRowContent({
  row,
  collapsedGroups,
  domainListMeta,
  onToggleGroup,
}: {
  row: DomainListVirtualRow;
  collapsedGroups: ReadonlySet<number | "none">;
  domainListMeta: Map<number, { displayUrl: string; featureState: DomainFeatureState }>;
  onToggleGroup: (groupId: number | "none") => void;
}) {
  if (row.kind === "header") {
    return (
      <GroupHeader
        label={row.label}
        count={row.count}
        collapsed={collapsedGroups.has(row.groupId)}
        showFolderIcon={row.groupId !== "none"}
        onToggle={() => onToggleGroup(row.groupId)}
      />
    );
  }

  const meta = domainListMeta.get(row.domainId);
  if (!meta) {
    return null;
  }

  return (
    <div className="mt-0.5">
      <MemoDomainListItem domainId={row.domainId} displayUrl={meta.displayUrl} featureState={meta.featureState} />
    </div>
  );
}

export const VirtualizedGroupedDomainList = memo(function VirtualizedGroupedDomainListInner({
  virtualRows,
  domainListMeta,
  collapsedGroups,
  onToggleGroup,
}: VirtualizedGroupedDomainListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      virtualRows[index]?.kind === "header" ? DOMAIN_LIST_GROUP_HEADER_HEIGHT : DOMAIN_LIST_DOMAIN_ROW_HEIGHT,
    overscan: 12,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto p-2 min-h-0 select-none">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = virtualRows[virtualRow.index];
          if (!row) {
            return null;
          }
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className={clsx("absolute top-0 left-0 w-full", row.kind === "domain" && "pb-0.5")}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <VirtualRowContent
                row={row}
                collapsedGroups={collapsedGroups}
                domainListMeta={domainListMeta}
                onToggleGroup={onToggleGroup}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
