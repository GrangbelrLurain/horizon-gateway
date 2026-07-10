import clsx from "clsx";
import { useAtomValue } from "jotai";
import { Globe, Pencil, Trash2 } from "lucide-react";
import { memo } from "react";
import type { DomainFeatureState } from "@/entities/domain";
import {
  domainBulkAnchorAtomFamily,
  domainBulkCheckedAtomFamily,
  domainNavSelectedAtomFamily,
} from "../lib/bulkSelectionAtoms";
import { domainListBulkModeAtom } from "../store";
import { useDomainListInteraction } from "./DomainListInteractionContext";

function FeatureBadge({
  label,
  shortLabel,
  active,
  title,
}: {
  label: string;
  shortLabel: string;
  active: boolean;
  title: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-0.5 rounded text-[8px] font-black leading-none",
        active ? "bg-success/20 text-success ring-1 ring-success/30" : "bg-base-content/8 text-base-content/25",
      )}
      aria-label={`${label}: ${active ? "ON" : "OFF"}`}
    >
      {shortLabel}
    </span>
  );
}

function FeatureBadges({
  state,
  labels,
}: {
  state: DomainFeatureState;
  labels: { monitor: string; proxy: string; api: string };
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <FeatureBadge
        shortLabel="M"
        label={labels.monitor}
        active={state.monitorEnabled === true}
        title={`${labels.monitor}: ${state.monitorEnabled === true ? "ON" : "OFF"}`}
      />
      <FeatureBadge
        shortLabel="P"
        label={labels.proxy}
        active={state.proxyEnabled === true}
        title={`${labels.proxy}: ${state.proxyEnabled === true ? "ON" : "OFF"}`}
      />
      <FeatureBadge
        shortLabel="A"
        label={labels.api}
        active={state.apiLoggingEnabled === true}
        title={`${labels.api}: ${state.apiLoggingEnabled === true ? "ON" : "OFF"}`}
      />
    </div>
  );
}

function DomainListItem({
  domainId,
  displayUrl,
  featureState,
}: {
  domainId: number;
  displayUrl: string;
  featureState: DomainFeatureState;
}) {
  const bulkMode = useAtomValue(domainListBulkModeAtom);
  const navSelected = useAtomValue(domainNavSelectedAtomFamily(domainId));
  const bulkChecked = useAtomValue(domainBulkCheckedAtomFamily(domainId));
  const isAnchor = useAtomValue(domainBulkAnchorAtomFamily(domainId));
  const { onPointer, onEditDomain, onDeleteDomain, badgeLabels } = useDomainListInteraction();
  const highlighted = bulkMode ? bulkChecked : navSelected;

  return (
    <div className="group relative flex items-center">
      <button
        type="button"
        onMouseDown={(e) => {
          if (e.shiftKey) {
            e.preventDefault();
          }
        }}
        onClick={(e) =>
          onPointer(domainId, {
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
          })
        }
        className={clsx(
          "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left select-none border",
          bulkMode ? "pr-3" : "pr-14",
          highlighted
            ? bulkMode
              ? "bg-primary/10 border-primary/25 text-primary"
              : "bg-primary/15 border-primary/30 text-primary"
            : "hover:bg-base-200 border-transparent text-base-content/80",
          isAnchor && bulkMode && "ring-2 ring-primary/35 ring-offset-1 ring-offset-base-100",
        )}
      >
        {bulkMode && (
          <input
            type="checkbox"
            className="checkbox checkbox-xs checkbox-primary shrink-0 pointer-events-none"
            readOnly
            tabIndex={-1}
            checked={bulkChecked}
          />
        )}
        <Globe className={clsx("w-3.5 h-3.5 shrink-0", highlighted ? "text-primary" : "text-base-content/30")} />
        <span className="text-xs font-bold truncate flex-1 min-w-0">{displayUrl}</span>
        {!bulkMode && <FeatureBadges state={featureState} labels={badgeLabels} />}
      </button>
      {!bulkMode && (
        <div className="absolute right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditDomain(domainId);
            }}
            className="p-1 rounded-md hover:bg-base-300 text-base-content/50 hover:text-primary"
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteDomain(domainId);
            }}
            className="p-1 rounded-md hover:bg-error/10 text-base-content/50 hover:text-error"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export const MemoDomainListItem = memo(DomainListItem, (prev, next) => {
  return (
    prev.domainId === next.domainId &&
    prev.displayUrl === next.displayUrl &&
    prev.featureState.monitorEnabled === next.featureState.monitorEnabled &&
    prev.featureState.proxyEnabled === next.featureState.proxyEnabled &&
    prev.featureState.apiLoggingEnabled === next.featureState.apiLoggingEnabled
  );
});
