import type { VirtualItem } from "@tanstack/react-virtual";
import type { Domain } from "@/entities/domain";
import type { DomainFeatureState } from "./DomainFeatureBadges";
import type { DomainRowProps } from "./DomainRow";
import { DomainRow } from "./DomainRow";

export interface VirtualizedDomainListProps {
  filteredDomains: Domain[];
  rowVirtualizer: {
    getVirtualItems: () => VirtualItem[];
    getTotalSize: () => number;
    measureElement: (el: HTMLElement | null) => void;
  };
  listParentRef: React.RefObject<HTMLDivElement | null>;
  getGroupName: (domainId: number) => string;
  getFeatureState: (domainId: number) => DomainFeatureState;
  proxyActive: boolean;
  featureT: DomainRowProps["featureT"];
  updatingId: number | null;
  onSelectGroup: (domain: Domain) => void;
  onEdit: (domain: Domain) => void;
  onDelete: (domainId: number) => void;
  onRefreshFeatures: () => void;
}

export function VirtualizedDomainList({
  filteredDomains,
  rowVirtualizer,
  listParentRef,
  getGroupName,
  getFeatureState,
  proxyActive,
  featureT,
  updatingId,
  onSelectGroup,
  onEdit,
  onDelete,
  onRefreshFeatures,
}: VirtualizedDomainListProps) {
  return (
    <div
      ref={listParentRef}
      className="overflow-auto max-h-[calc(100vh-320px)] rounded-3xl border-none no-scrollbar relative"
    >
      <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const domain = filteredDomains[virtualRow.index];
          return (
            <div
              key={domain.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute top-0 left-0 w-full px-2 pt-1.5 pb-4"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <DomainRow
                domain={domain}
                groupName={getGroupName(domain.id)}
                isUpdating={updatingId === domain.id}
                featureState={getFeatureState(domain.id)}
                proxyActive={proxyActive}
                featureT={featureT}
                onSelectGroup={() => onSelectGroup(domain)}
                onEdit={() => onEdit(domain)}
                onDelete={() => onDelete(domain.id)}
                onRefreshFeatures={onRefreshFeatures}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
