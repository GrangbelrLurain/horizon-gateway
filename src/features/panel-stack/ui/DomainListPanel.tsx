import clsx from "clsx";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { ChevronLeft, Folder, Globe, ListChecks, Plus, Search, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { languageAtom, usePromiseModal } from "@/entities/app";
import type { DomainFeatureState } from "@/entities/domain";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { LoadingScreen } from "@/shared/ui/loader/LoadingScreen";
import { ConfirmModal } from "@/shared/ui/modal/ConfirmModal";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import {
  type BulkPointerModifiers,
  mergeRangeIntoSelection,
  rangeIdsBetween,
  toggleInSelection,
} from "../lib/bulkSelection";
import { domainListBulkAnchorIdAtom } from "../lib/bulkSelectionAtoms";
import { buildDomainListVirtualRows } from "../lib/domainListVirtualRows";
import {
  type DomainFeatureFilterMode,
  type DomainFeatureKey,
  domainListBulkModeAtom,
  domainListBulkSelectedIdsAtom,
  domainListFeatureFilterAtom,
  domainListFeatureRequireAtom,
  domainListFilteredIdsAtom,
  domainListGroupFilterAtom,
  domainListOverlayOpenAtom,
  domainListPinnedOpenAtom,
  domainListSearchAtom,
  domainListSortAtom,
  panelOverlayOpenAtom,
} from "../store";
import { CollapseOverlay } from "./CollapseOverlay";
import { CollapseStrip } from "./CollapseStrip";
import { DomainEditModal } from "./DomainEditModal";
import { DomainListBulkToolbar } from "./DomainListBulkToolbar";
import { DomainListInteractionContext } from "./DomainListInteractionContext";
import { VirtualizedGroupedDomainList } from "./VirtualizedGroupedDomainList";

interface DomainListPanelProps {
  selectedDomainId: number | null;
  onSelectDomain: (id: number) => void;
  onClearDomain: () => void;
  onAddDomain: () => void;
  onManageGroups: () => void;
  onEnterBulkMode: () => void;
  onExitBulkMode: () => void;
  activePanelsCount?: number;
}

const DOMAIN_LIST_WIDTH = "w-[420px] min-w-[360px]";

function isDomainListStrip(activePanelsCount: number, bulkMode: boolean, pinned: boolean): boolean {
  if (bulkMode) {
    return false;
  }
  return activePanelsCount >= 4 && !pinned;
}

function getActiveFeatureCount(state: DomainFeatureState): number {
  return [state.monitorEnabled === true, state.proxyEnabled === true, state.apiLoggingEnabled === true].filter(Boolean)
    .length;
}

function isDomainActive(state: DomainFeatureState): boolean {
  return getActiveFeatureCount(state) > 0;
}

function isDomainInactive(state: DomainFeatureState): boolean {
  return getActiveFeatureCount(state) === 0;
}

function getDomainHostname(domain: Domain): string {
  try {
    const u = new URL(domain.url.startsWith("http") ? domain.url : `https://${domain.url}`);
    return u.hostname;
  } catch {
    return domain.url;
  }
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[9px] font-black uppercase tracking-widest text-base-content/35 px-0.5 shrink-0">
        {label}
      </span>
      <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-thin">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap shrink-0",
        active ? "bg-primary/20 text-primary" : "bg-base-200 text-base-content/50 hover:bg-base-300",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DomainListPanel({
  selectedDomainId,
  onSelectDomain,
  onClearDomain,
  onAddDomain,
  onManageGroups,
  onEnterBulkMode,
  onExitBulkMode,
  activePanelsCount = 0,
}: DomainListPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const { alert: showAlert } = usePromiseModal();
  const [search, setSearch] = useAtom(domainListSearchAtom);
  const [groupFilter, setGroupFilter] = useAtom(domainListGroupFilterAtom);
  const [featureFilter, setFeatureFilter] = useAtom(domainListFeatureFilterAtom);
  const [featureRequire, setFeatureRequire] = useAtom(domainListFeatureRequireAtom);
  const [sortMode, setSortMode] = useAtom(domainListSortAtom);
  const [bulkMode] = useAtom(domainListBulkModeAtom);
  const setSelectedIds = useSetAtom(domainListBulkSelectedIdsAtom);
  const setBulkAnchorId = useSetAtom(domainListBulkAnchorIdAtom);
  const store = useStore();
  const setFilteredIds = useSetAtom(domainListFilteredIdsAtom);
  const [overlayOpen, setOverlayOpen] = useAtom(domainListOverlayOpenAtom);
  const [listPinned, setListPinned] = useAtom(domainListPinnedOpenAtom);
  const setPanelOverlayOpen = useSetAtom(panelOverlayOpenAtom);
  const { domains, groups, loading, getFeatureState, getGroupId, fetchAll } = useDomainHubData();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number | "none">>(new Set());
  const [editDomain, setEditDomain] = useState<Domain | null>(null);
  const [deleteDomain, setDeleteDomain] = useState<Domain | null>(null);
  const domainsRef = useRef(domains);
  domainsRef.current = domains;

  useEffect(() => {
    if (!bulkMode) {
      setBulkAnchorId(null);
    }
  }, [bulkMode, setBulkAnchorId]);

  const idToUrl = useMemo(() => new Map(domains.map((d) => [d.id, d.url])), [domains]);

  const handleEditDomain = useCallback((id: number) => {
    const domain = domainsRef.current.find((d) => d.id === id);
    if (domain) {
      setEditDomain(domain);
    }
  }, []);

  const handleDeleteDomain = useCallback((id: number) => {
    const domain = domainsRef.current.find((d) => d.id === id);
    if (domain) {
      setDeleteDomain(domain);
    }
  }, []);

  const badgeLabels = useMemo(
    () => ({
      monitor: t.featureBadgeMonitor,
      proxy: t.featureBadgeProxy,
      api: t.featureBadgeApi,
    }),
    [t],
  );

  const toggleFeatureRequire = (key: DomainFeatureKey) => {
    setFeatureRequire((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const matchesFeatureRequire = useCallback((state: DomainFeatureState, require: DomainFeatureKey[]) => {
    if (require.length === 0) {
      return true;
    }
    return require.every((key) => {
      if (key === "monitor") {
        return state.monitorEnabled === true;
      }
      if (key === "proxy") {
        return state.proxyEnabled === true;
      }
      return state.apiLoggingEnabled === true;
    });
  }, []);

  const filteredDomains = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = domains.filter((d) => {
      if (q && !d.url.toLowerCase().includes(q)) {
        return false;
      }
      const gid = getGroupId(d.id);
      if (groupFilter === "none") {
        if (gid !== null) {
          return false;
        }
      } else if (groupFilter !== "all" && gid !== groupFilter) {
        return false;
      }

      const state = getFeatureState(d.id);
      if (featureFilter === "active" && !isDomainActive(state)) {
        return false;
      }
      if (featureFilter === "inactive" && !isDomainInactive(state)) {
        return false;
      }
      if (!matchesFeatureRequire(state, featureRequire)) {
        return false;
      }
      return true;
    });

    return [...items].sort((a, b) => {
      if (sortMode === "name") {
        return getDomainHostname(a).localeCompare(getDomainHostname(b));
      }
      const diff = getActiveFeatureCount(getFeatureState(b.id)) - getActiveFeatureCount(getFeatureState(a.id));
      if (diff !== 0) {
        return diff;
      }
      return getDomainHostname(a).localeCompare(getDomainHostname(b));
    });
  }, [
    domains,
    search,
    groupFilter,
    featureFilter,
    featureRequire,
    sortMode,
    getGroupId,
    getFeatureState,
    matchesFeatureRequire,
  ]);

  const grouped = useMemo(() => {
    const map = new Map<number | "none", Domain[]>();
    for (const d of filteredDomains) {
      const gid = getGroupId(d.id) ?? "none";
      map.set(gid, [...(map.get(gid) ?? []), d]);
    }
    return map;
  }, [filteredDomains, getGroupId]);

  const sortedGroups = useMemo(() => {
    if (sortMode !== "activity") {
      return groups;
    }
    const groupsWithIndex = groups.map((g, idx) => ({ g, idx }));
    groupsWithIndex.sort((a, b) => {
      const aItems = grouped.get(a.g.id) ?? [];
      const bItems = grouped.get(b.g.id) ?? [];

      const aHasActive = aItems.some((d) => isDomainActive(getFeatureState(d.id)));
      const bHasActive = bItems.some((d) => isDomainActive(getFeatureState(d.id)));

      if (aHasActive && !bHasActive) {
        return -1;
      }
      if (!aHasActive && bHasActive) {
        return 1;
      }
      return a.idx - b.idx;
    });
    return groupsWithIndex.map((x) => x.g);
  }, [groups, sortMode, grouped, getFeatureState]);

  /** 화면에 보이는 그룹 순서 — Shift+클릭 범위 선택 / URL 복사 순서 */
  const displayOrderedDomainIds = useMemo(() => {
    const ids: number[] = [];
    for (const g of sortedGroups) {
      const items = grouped.get(g.id);
      if (!items) {
        continue;
      }
      for (const d of items) {
        ids.push(d.id);
      }
    }
    const ungrouped = grouped.get("none");
    if (ungrouped) {
      for (const d of ungrouped) {
        ids.push(d.id);
      }
    }
    return ids;
  }, [sortedGroups, grouped]);

  const filteredDomainIds = useMemo(() => filteredDomains.map((d) => d.id), [filteredDomains]);

  useEffect(() => {
    setFilteredIds(displayOrderedDomainIds);
  }, [displayOrderedDomainIds, setFilteredIds]);

  const applyRangeSelection = useCallback(
    (anchorId: number, targetId: number) => {
      const rangeIds = rangeIdsBetween(displayOrderedDomainIds, anchorId, targetId);
      setSelectedIds((prev: ReadonlySet<number>) => mergeRangeIntoSelection(prev, rangeIds));
    },
    [displayOrderedDomainIds, setSelectedIds],
  );

  const handleBulkPointer = useCallback(
    (id: number, mods: BulkPointerModifiers) => {
      const ctrl = mods.ctrlKey || mods.metaKey;
      const anchor = store.get(domainListBulkAnchorIdAtom);

      if (mods.shiftKey) {
        if (anchor != null) {
          applyRangeSelection(anchor, id);
        } else {
          setSelectedIds(new Set([id]));
        }
      } else if (ctrl) {
        setSelectedIds((prev: ReadonlySet<number>) => toggleInSelection(prev, id));
      } else {
        setSelectedIds(new Set([id]));
      }
      setBulkAnchorId(id);
    },
    [applyRangeSelection, setBulkAnchorId, setSelectedIds, store],
  );

  const handleListPointer = useCallback(
    (id: number, mods: BulkPointerModifiers) => {
      if (mods.shiftKey) {
        const anchor = bulkMode ? store.get(domainListBulkAnchorIdAtom) : selectedDomainId;
        if (!bulkMode) {
          onEnterBulkMode();
        }
        if (anchor != null) {
          applyRangeSelection(anchor, id);
        } else {
          setSelectedIds(new Set([id]));
        }
        setBulkAnchorId(id);
      } else if (bulkMode) {
        handleBulkPointer(id, mods);
      } else {
        onSelectDomain(id);
      }
      setOverlayOpen(false);
    },
    [
      bulkMode,
      selectedDomainId,
      onEnterBulkMode,
      applyRangeSelection,
      setSelectedIds,
      setBulkAnchorId,
      handleBulkPointer,
      onSelectDomain,
      setOverlayOpen,
      store,
    ],
  );

  const handlersRef = useRef({
    onPointer: handleListPointer,
    onEditDomain: handleEditDomain,
    onDeleteDomain: handleDeleteDomain,
  });
  handlersRef.current = {
    onPointer: handleListPointer,
    onEditDomain: handleEditDomain,
    onDeleteDomain: handleDeleteDomain,
  };

  const interactionValue = useMemo(
    () => ({
      onPointer: (id: number, mods: BulkPointerModifiers) => handlersRef.current.onPointer(id, mods),
      onEditDomain: (id: number) => handlersRef.current.onEditDomain(id),
      onDeleteDomain: (id: number) => handlersRef.current.onDeleteDomain(id),
      badgeLabels,
    }),
    [badgeLabels],
  );

  const domainListMeta = useMemo(() => {
    const meta = new Map<number, { displayUrl: string; featureState: DomainFeatureState }>();
    for (const d of filteredDomains) {
      meta.set(d.id, {
        displayUrl: getDomainHostname(d),
        featureState: getFeatureState(d.id),
      });
    }
    return meta;
  }, [filteredDomains, getFeatureState]);

  const stripMode = isDomainListStrip(activePanelsCount, bulkMode, listPinned);
  const showListCollapse = listPinned && activePanelsCount >= 4;

  const selectedHostInitial = useMemo(() => {
    if (selectedDomainId == null) {
      return null;
    }
    const d = domains.find((x) => x.id === selectedDomainId);
    if (!d) {
      return null;
    }
    return getDomainHostname(d).charAt(0).toUpperCase();
  }, [selectedDomainId, domains]);

  const toggleGroup = useCallback((gid: number | "none") => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) {
        next.delete(gid);
      } else {
        next.add(gid);
      }
      return next;
    });
  }, []);

  const virtualRows = useMemo(
    () => buildDomainListVirtualRows(sortedGroups, grouped, collapsedGroups, t.ungrouped),
    [sortedGroups, grouped, collapsedGroups, t.ungrouped],
  );

  const handleDelete = async () => {
    if (!deleteDomain) {
      return;
    }
    try {
      await commands.removeDomains({ id: deleteDomain.id }).then(unwrap);
      if (selectedDomainId === deleteDomain.id) {
        onClearDomain();
      }
      await fetchAll();
      await notifyHubDataChanged("domains");
    } catch (e) {
      console.error(e);
      await showAlert(t.errorGeneric, t.saveFailed, "danger");
    } finally {
      setDeleteDomain(null);
    }
  };

  const setFeatureMode = (mode: DomainFeatureFilterMode) => {
    setFeatureFilter(mode);
  };

  const listSection =
    filteredDomains.length === 0 ? (
      <div className="flex-1 overflow-y-auto p-2 min-h-0 select-none">
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <Globe className="w-8 h-8 text-base-content/20 mb-3" />
          <p className="text-xs font-bold text-base-content/60">{t.noDomains}</p>
          <p className="text-[10px] text-base-content/40 mt-1">{t.noDomainsDesc}</p>
          {!bulkMode && (
            <Button variant="primary" size="sm" className="mt-4 gap-1" onClick={onAddDomain}>
              <Plus className="w-3.5 h-3.5" />
              {t.addDomain}
            </Button>
          )}
        </div>
      </div>
    ) : (
      <DomainListInteractionContext.Provider value={interactionValue}>
        <VirtualizedGroupedDomainList
          virtualRows={virtualRows}
          domainListMeta={domainListMeta}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
        />
      </DomainListInteractionContext.Provider>
    );

  if (loading && domains.length === 0) {
    return (
      <div
        className={clsx(
          DOMAIN_LIST_WIDTH,
          "h-full border-r border-base-300 bg-base-100 flex items-center justify-center shrink-0",
        )}
      >
        <LoadingScreen />
      </div>
    );
  }

  const filterSection = (
    <>
      <FilterRow label={t.filterGroupLabel}>
        <FilterChip active={groupFilter === "all"} onClick={() => setGroupFilter("all")}>
          {t.filterAll}
        </FilterChip>
        <FilterChip active={groupFilter === "none"} onClick={() => setGroupFilter("none")}>
          {t.filterNoGroup}
        </FilterChip>
        {groups.map((g) => (
          <FilterChip key={g.id} active={groupFilter === g.id} onClick={() => setGroupFilter(g.id)}>
            {g.name}
          </FilterChip>
        ))}
      </FilterRow>

      <FilterRow label={t.filterFeatureLabel}>
        <FilterChip active={featureFilter === "all"} onClick={() => setFeatureMode("all")}>
          {t.filterAll}
        </FilterChip>
        <FilterChip active={featureFilter === "active"} onClick={() => setFeatureMode("active")}>
          {t.filterFeatureActive}
        </FilterChip>
        <FilterChip active={featureFilter === "inactive"} onClick={() => setFeatureMode("inactive")}>
          {t.filterFeatureInactive}
        </FilterChip>
        <span className="w-px h-4 bg-base-300 shrink-0 self-center mx-0.5" aria-hidden />
        {(["monitor", "proxy", "api"] as const).map((key) => (
          <FilterChip
            key={key}
            active={featureRequire.includes(key)}
            onClick={() => toggleFeatureRequire(key)}
            className="min-w-[22px] px-1.5"
          >
            {key === "monitor" ? "M" : key === "proxy" ? "P" : "A"}
          </FilterChip>
        ))}
      </FilterRow>

      <FilterRow label={t.filterSortLabel}>
        <FilterChip active={sortMode === "activity"} onClick={() => setSortMode("activity")}>
          {t.sortByActivity}
        </FilterChip>
        <FilterChip active={sortMode === "name"} onClick={() => setSortMode("name")}>
          {t.sortByName}
        </FilterChip>
      </FilterRow>
    </>
  );

  const footerSection = !bulkMode ? (
    <div className="p-2 border-t border-base-300 space-y-1 shrink-0">
      <Button variant="primary" size="sm" className="w-full gap-1.5 h-8 text-xs" onClick={onAddDomain}>
        <Plus className="w-3.5 h-3.5" />
        {t.addDomain}
      </Button>
      <Button variant="secondary" size="sm" className="w-full gap-1.5 h-8 text-xs" onClick={onManageGroups}>
        <Folder className="w-3.5 h-3.5" />
        {t.manageGroups}
      </Button>
    </div>
  ) : null;

  const modals = (
    <>
      <DomainEditModal
        domain={editDomain}
        onClose={() => setEditDomain(null)}
        onSaved={async () => {
          await fetchAll();
          await notifyHubDataChanged("domains");
          await notifyHubDataChanged("groups");
        }}
      />
      <ConfirmModal
        isOpen={deleteDomain !== null}
        onClose={() => setDeleteDomain(null)}
        onConfirm={handleDelete}
        title={t.domainDeleteTitle}
        message={deleteDomain ? t.domainDeleteMessage(deleteDomain.url) : ""}
        confirmText={t.domainDeleteConfirm}
        cancelText={t.domainEditCancel}
        type="danger"
      />
    </>
  );

  const renderListPanel = (overlay?: { onClose: () => void }) => (
    <div className={clsx(DOMAIN_LIST_WIDTH, "h-full border-r border-base-300 bg-base-100 flex flex-col shrink-0")}>
      <div className="p-3 border-b border-base-300 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-sm font-black text-base-content">{t.domains}</h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-base-content/40">
              {filteredDomains.length}/{domains.length}
            </span>
            {overlay ? (
              <button
                type="button"
                onClick={overlay.onClose}
                className="p-1 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors"
                title={t.domainListCollapse}
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <>
                {showListCollapse && (
                  <button
                    type="button"
                    onClick={() => setListPinned(false)}
                    className="p-1 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors"
                    title={t.domainListCollapse}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <Button
                  variant={bulkMode ? "primary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 gap-1 text-[10px] font-bold"
                  onClick={() => {
                    if (bulkMode) {
                      onExitBulkMode();
                    } else {
                      setSelectedIds(new Set());
                      setBulkAnchorId(null);
                      onEnterBulkMode();
                    }
                  }}
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  {bulkMode ? t.bulkModeExit : t.bulkModeEnter}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-8 h-8 text-xs rounded-lg"
          />
        </div>

        {filterSection}

        {bulkMode && <DomainListBulkToolbar filteredDomainIds={filteredDomainIds} idToUrl={idToUrl} />}
      </div>

      {listSection}
      {footerSection}
    </div>
  );

  if (stripMode) {
    return (
      <>
        <CollapseStrip
          title={t.domains}
          icon={Globe}
          pinExpandLabel={t.sidebarPinExpand}
          onPinExpand={() => {
            setPanelOverlayOpen(null);
            setOverlayOpen(false);
            setListPinned(true);
          }}
          onOverlay={() => {
            setPanelOverlayOpen(null);
            setOverlayOpen(true);
          }}
          badge={
            selectedHostInitial ? (
              <span className="w-6 h-6 rounded-md bg-primary/15 text-primary text-[10px] font-black flex items-center justify-center">
                {selectedHostInitial}
              </span>
            ) : undefined
          }
        />
        <CollapseOverlay
          open={overlayOpen}
          onClose={() => setOverlayOpen(false)}
          widthPx={420}
          ariaLabel={t.domainListCollapse}
        >
          {renderListPanel({ onClose: () => setOverlayOpen(false) })}
        </CollapseOverlay>
        {modals}
      </>
    );
  }

  return (
    <>
      {renderListPanel()}
      {modals}
    </>
  );
}
