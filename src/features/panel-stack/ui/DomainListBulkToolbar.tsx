import clsx from "clsx";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useState } from "react";
import { languageAtom } from "@/entities/app";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { copyTextToClipboard, formatSelectedDomainUrls, selectionFromIds } from "../lib/bulkSelection";
import { domainListBulkAnchorIdAtom, domainListBulkSelectedCountAtom } from "../lib/bulkSelectionAtoms";
import { domainListBulkSelectedIdsAtom, domainListFilteredIdsAtom } from "../store";

type DomainListBulkToolbarProps = {
  filteredDomainIds: number[];
  idToUrl: Map<number, string>;
};

export function DomainListBulkToolbar({ filteredDomainIds, idToUrl }: DomainListBulkToolbarProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const selectedCount = useAtomValue(domainListBulkSelectedCountAtom);
  const setSelectedIds = useSetAtom(domainListBulkSelectedIdsAtom);
  const setBulkAnchorId = useSetAtom(domainListBulkAnchorIdAtom);
  const orderedIds = useAtomValue(domainListFilteredIdsAtom);
  const store = useStore();
  const [copyFeedback, setCopyFeedback] = useState(false);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(selectionFromIds(filteredDomainIds));
    const last = filteredDomainIds[filteredDomainIds.length - 1];
    setBulkAnchorId(last ?? null);
  }, [filteredDomainIds, setBulkAnchorId, setSelectedIds]);

  const clearBulkSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkAnchorId(null);
  }, [setBulkAnchorId, setSelectedIds]);

  const copySelectedUrls = useCallback(async () => {
    const selectedIds = store.get(domainListBulkSelectedIdsAtom);
    if (selectedIds.size === 0) {
      return;
    }
    const text = formatSelectedDomainUrls(orderedIds, selectedIds, idToUrl);
    if (!text) {
      return;
    }
    try {
      await copyTextToClipboard(text);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 1500);
    } catch (e) {
      console.error(e);
    }
  }, [idToUrl, orderedIds, store]);

  return (
    <div className="space-y-1 pt-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <button
            type="button"
            className="text-[10px] font-bold text-primary hover:underline"
            onClick={selectAllFiltered}
          >
            {t.bulkSelectAll}
          </button>
          {selectedCount > 0 && (
            <>
              <span className="text-base-content/20">·</span>
              <button
                type="button"
                className="text-[10px] font-bold text-base-content/50 hover:underline"
                onClick={clearBulkSelection}
              >
                {t.bulkClearSelection}
              </button>
              <span className="text-base-content/20">·</span>
              <button
                type="button"
                className={clsx(
                  "text-[10px] font-bold hover:underline",
                  copyFeedback ? "text-success" : "text-base-content/50",
                )}
                onClick={() => void copySelectedUrls()}
              >
                {copyFeedback ? t.bulkCopied : t.bulkCopyUrls}
              </button>
            </>
          )}
        </div>
        {selectedCount > 0 && (
          <span className="text-[10px] font-bold text-base-content/40 shrink-0">{t.bulkSelected(selectedCount)}</span>
        )}
      </div>
      <p className="text-[9px] text-base-content/35 px-0.5">{t.bulkSelectionHint}</p>
    </div>
  );
}
