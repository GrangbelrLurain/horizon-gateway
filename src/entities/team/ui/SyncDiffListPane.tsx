import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Loader2,
  Minus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { DEFAULT_SYNC_OPTIONS, type DomainMatchKey, type WorkspaceSyncOptions } from "../sync";
import {
  buildSyncDiffFromSnapshot,
  countDiffByStatus,
  defaultSelectableKeys,
  KIND_LABELS,
  type SyncDiffItem,
  type SyncDiffStatus,
  type SyncSnapshot,
  visibleItemsForAction,
} from "../syncDiff";
import type { ResourceKind } from "../types";
import { emptyCatalogCounts, type SyncCatalogCounts } from "./SyncCatalogPane";

type DiffFilter = "all" | SyncDiffStatus;

const STATUS_META: Record<SyncDiffStatus, { ko: string; en: string; className: string; icon: React.ReactNode }> = {
  local_only: {
    ko: "로컬만",
    en: "Local only",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    icon: <ArrowUpFromLine className="w-3 h-3" />,
  },
  remote_only: {
    ko: "서버만",
    en: "Remote only",
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    icon: <ArrowDownToLine className="w-3 h-3" />,
  },
  same: {
    ko: "동일",
    en: "Same",
    className: "bg-base-300/50 text-base-content/50",
    icon: <Check className="w-3 h-3" />,
  },
  conflict: {
    ko: "충돌",
    en: "Conflict",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

interface SyncDiffListPaneProps {
  lang: "ko" | "en";
  action: "push" | "pull";
  kind: ResourceKind;
  snapshot: SyncSnapshot | null;
  snapshotLoading?: boolean;
  busy?: boolean;
  onCountsChange: (kind: ResourceKind, counts: SyncCatalogCounts) => void;
  onRefresh: () => void;
  onSync: (options: WorkspaceSyncOptions) => void;
}

export function SyncDiffListPane({
  lang,
  action,
  kind,
  snapshot,
  snapshotLoading,
  busy,
  onCountsChange,
  onRefresh,
  onSync,
}: SyncDiffListPaneProps) {
  const [items, setItems] = useState<SyncDiffItem[]>([]);
  const [localCount, setLocalCount] = useState(0);
  const [remoteCount, setRemoteCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DiffFilter>("all");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [matchKey, setMatchKey] = useState<DomainMatchKey>(DEFAULT_SYNC_OPTIONS.matchKey);
  const onCountsChangeRef = useRef(onCountsChange);
  onCountsChangeRef.current = onCountsChange;

  const loading = snapshotLoading || snapshot == null;

  useEffect(() => {
    if (!snapshot) {
      setItems([]);
      setLocalCount(0);
      setRemoteCount(0);
      setSelectedKeys(new Set());
      return;
    }

    try {
      const result = buildSyncDiffFromSnapshot(snapshot, kind, { matchKey });
      setItems(result.items);
      setLocalCount(result.localCount);
      setRemoteCount(result.remoteCount);
      onCountsChangeRef.current(kind, {
        kind,
        localCount: result.localCount,
        remoteCount: result.remoteCount,
        byStatus: countDiffByStatus(result.items),
      });
      setSelectedKeys(new Set(defaultSelectableKeys(action, result.items)));
    } catch (e) {
      console.warn("SyncDiffListPane:", e);
      setItems([]);
      setLocalCount(0);
      setRemoteCount(0);
      onCountsChangeRef.current(kind, emptyCatalogCounts(kind));
      setSelectedKeys(new Set());
    }
  }, [snapshot, kind, matchKey, action]);

  useEffect(() => {
    setSearch("");
    setFilter("all");
  }, [kind, action]);

  useEffect(() => {
    setSelectedKeys(new Set(defaultSelectableKeys(action, items)));
  }, [action]);

  const actionItems = useMemo(() => visibleItemsForAction(action, items), [action, items]);

  const filterOptions = useMemo((): DiffFilter[] => {
    if (action === "push") {
      return ["all", "local_only", "conflict", "same"];
    }
    return ["all", "remote_only", "conflict", "same"];
  }, [action]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return actionItems.filter((item) => {
      if (filter !== "all" && item.status !== filter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        item.label.toLowerCase().includes(q) ||
        (item.detail?.toLowerCase().includes(q) ?? false) ||
        (item.conflictDetail?.toLowerCase().includes(q) ?? false) ||
        (item.localDetail?.toLowerCase().includes(q) ?? false) ||
        (item.remoteDetail?.toLowerCase().includes(q) ?? false) ||
        item.key.toLowerCase().includes(q)
      );
    });
  }, [actionItems, search, filter]);

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectableFiltered = filtered.filter((i) => i.status !== "same");

  const selectAllFiltered = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const item of selectableFiltered) {
        next.add(item.key);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  const buildOptions = (): WorkspaceSyncOptions => {
    const keys = [...selectedKeys];
    const base: WorkspaceSyncOptions = {
      ...DEFAULT_SYNC_OPTIONS,
      matchKey,
      kinds: [kind],
    };

    if (action === "push") {
      if (kind === "domains") {
        const ids = items
          .filter((i) => selectedKeys.has(i.key) && typeof i.localId === "number")
          .map((i) => i.localId as number);
        return { ...base, selectedDomainIds: ids };
      }
      if (kind === "mock_rules") {
        const ids = items
          .filter((i) => selectedKeys.has(i.key) && typeof i.localId === "string")
          .map((i) => i.localId as string);
        return { ...base, selectedMockRuleIds: ids };
      }
      return { ...base, selectedItemKeys: keys };
    }

    if (kind === "domains") {
      return { ...base, selectedDomainKeys: keys };
    }
    if (kind === "mock_rules") {
      return { ...base, selectedMockRuleKeys: keys };
    }
    return { ...base, selectedItemKeys: keys };
  };

  const emptyState = useMemo((): { title: string; hint?: string } => {
    const kindLabel = KIND_LABELS[kind][lang];
    const hasSearch = search.trim().length > 0;
    const hasStatusFilter = filter !== "all";

    if (hasSearch || hasStatusFilter) {
      return {
        title: lang === "ko" ? "조건에 맞는 항목이 없습니다" : "No matching items",
        hint:
          lang === "ko"
            ? "검색어·필터를 바꾸거나 「전체」를 선택해 보세요."
            : "Try a different search or filter, or choose All.",
      };
    }

    if (localCount === 0 && remoteCount === 0) {
      return {
        title: lang === "ko" ? `${kindLabel} 없음` : `No ${kindLabel.toLowerCase()}`,
        hint:
          lang === "ko"
            ? "로컬·서버 모두 등록된 항목이 없습니다. 앱에서 먼저 추가하거나 다른 쪽에서 Pull 하세요."
            : "Nothing on local or server. Add items in the app or Pull from the other side.",
      };
    }

    if (action === "push" && localCount === 0 && remoteCount > 0) {
      return {
        title: lang === "ko" ? "Push할 로컬 항목 없음" : "Nothing local to push",
        hint:
          lang === "ko"
            ? `서버에 ${remoteCount}개 있습니다. Pull 탭에서 가져올 수 있습니다.`
            : `${remoteCount} on server — switch to Pull to import them.`,
      };
    }

    if (action === "pull" && remoteCount === 0 && localCount > 0) {
      return {
        title: lang === "ko" ? "Pull할 서버 항목 없음" : "Nothing on server to pull",
        hint:
          lang === "ko"
            ? `로컬에 ${localCount}개 있습니다. Push 탭에서 올릴 수 있습니다.`
            : `${localCount} locally — switch to Push to upload them.`,
      };
    }

    return {
      title: lang === "ko" ? "표시할 항목이 없습니다" : "No items to show",
    };
  }, [action, filter, kind, lang, localCount, remoteCount, search]);

  const canSync = !busy && !loading && selectedKeys.size > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-[360px] bg-base-100">
      <div className="shrink-0 px-3 py-2 border-b border-base-300 flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
          {lang === "ko"
            ? `3. ${KIND_LABELS[kind].ko} · ${action === "push" ? "Push (로컬→서버)" : "Pull (서버→로컬)"}`
            : `3. ${KIND_LABELS[kind].en} · ${action === "push" ? "Push (local→remote)" : "Pull (remote→local)"}`}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/35" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "ko" ? "검색…" : "Search…"}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || busy}
            className="p-1.5 rounded-md border border-base-300 text-base-content/50 hover:text-base-content hover:bg-base-200 disabled:opacity-40"
            title={lang === "ko" ? "새로고침" : "Refresh"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {filterOptions.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                filter === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-base-300 text-base-content/50 hover:bg-base-200"
              }`}
            >
              {f === "all" ? (lang === "ko" ? "전체" : "All") : STATUS_META[f as SyncDiffStatus][lang]}
            </button>
          ))}
        </div>

        {kind === "domains" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-base-content/45 font-bold uppercase tracking-wider">
                {lang === "ko" ? "매칭" : "Match"}
              </span>
              {(["hostname", "host_port", "exact_url"] as DomainMatchKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMatchKey(k)}
                  className={`px-2 py-0.5 rounded-md border font-bold ${
                    matchKey === k
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-base-300 text-base-content/50"
                  }`}
                >
                  {k === "hostname"
                    ? lang === "ko"
                      ? "호스트"
                      : "Host"
                    : k === "host_port"
                      ? lang === "ko"
                        ? "호스트:포트"
                        : "Host:port"
                      : "URL"}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-base-content/40 leading-relaxed">
              {matchKey === "hostname"
                ? lang === "ko"
                  ? "같은 호스트면 1개로 묶습니다. URL이 달라도 enabled만 비교합니다."
                  : "Groups by host; compares enabled only even if URLs differ."
                : matchKey === "host_port"
                  ? lang === "ko"
                    ? "호스트:포트 기준으로 묶습니다. URL 경로 차이는 참고 정보만 표시합니다."
                    : "Groups by host:port; path differences show as info only."
                  : lang === "ko"
                    ? "URL 전체가 같아야 같은 항목입니다. http/https·슬래시 차이는 정규화합니다."
                    : "Full URL must match; http/https and trailing slashes are normalized."}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 border-b border-base-200 text-[10px] text-base-content/45 shrink-0">
        <span>
          {filtered.length} {lang === "ko" ? "항목" : "items"} · {selectedKeys.size}{" "}
          {lang === "ko" ? "선택" : "selected"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAllFiltered}
            disabled={selectableFiltered.length === 0}
            className="hover:text-base-content font-bold disabled:opacity-40"
          >
            {lang === "ko" ? "필터 전체 선택" : "Select filtered"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedKeys.size === 0}
            className="hover:text-base-content font-bold disabled:opacity-40"
          >
            {lang === "ko" ? "해제" : "Clear"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12 text-base-content/40">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-base-content/40 gap-2 px-4">
            <Minus className="w-6 h-6 opacity-30" />
            <p className="text-xs font-medium text-base-content/55">{emptyState.title}</p>
            {emptyState.hint && <p className="text-[10px] leading-relaxed max-w-[280px]">{emptyState.hint}</p>}
            {(localCount > 0 || remoteCount > 0) && (
              <p className="text-[10px] font-mono mt-1">
                {lang === "ko" ? "로컬" : "Local"} {localCount} · {lang === "ko" ? "서버" : "Remote"} {remoteCount}
              </p>
            )}
          </div>
        ) : (
          filtered.map((item) => {
            const meta = STATUS_META[item.status];
            const checked = selectedKeys.has(item.key);
            const disabled = item.status === "same";
            return (
              <label
                key={item.key}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  checked ? "border-primary/40 bg-primary/5" : "border-base-200 hover:bg-base-200/40"
                } ${disabled ? "opacity-60 cursor-default" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || busy}
                  onChange={() => !disabled && toggleKey(item.key)}
                  className="checkbox checkbox-xs checkbox-primary mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold truncate ${
                        kind === "domain_group_links" ? "font-mono text-[11px]" : ""
                      }`}
                    >
                      {item.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meta.className}`}
                    >
                      {meta.icon}
                      {meta[lang]}
                    </span>
                  </div>
                  {item.detail && (
                    <p
                      className={`text-[10px] truncate mt-0.5 ${
                        kind === "domain_group_links"
                          ? "text-base-content/65 font-medium"
                          : "text-base-content/45 font-mono"
                      }`}
                    >
                      {kind === "domain_group_links"
                        ? `${lang === "ko" ? "그룹" : "Group"}: ${item.detail}`
                        : item.detail}
                    </p>
                  )}
                  {item.infoDetail && (
                    <p className="text-[10px] text-base-content/50 mt-1 leading-snug">{item.infoDetail}</p>
                  )}
                  {item.status === "conflict" && item.conflictDetail && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-snug">
                      {item.conflictDetail}
                    </p>
                  )}
                  {item.status === "conflict" && (item.localDetail || item.remoteDetail) && (
                    <div className="mt-1 flex flex-col gap-0.5 text-[9px] font-mono leading-snug">
                      {item.remoteDetail && (
                        <span className="text-violet-600 dark:text-violet-400 truncate">
                          {lang === "ko" ? "서버" : "Remote"}: {item.remoteDetail}
                        </span>
                      )}
                      {item.localDetail && (
                        <span className="text-sky-600 dark:text-sky-400 truncate">
                          {lang === "ko" ? "로컬" : "Local"}: {item.localDetail}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </label>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-base-300 p-3 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          disabled={!canSync}
          onClick={() => onSync(buildOptions())}
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : action === "push" ? (
            <>
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              {lang === "ko" ? `선택 Push (${selectedKeys.size})` : `Push selected (${selectedKeys.size})`}
            </>
          ) : (
            <>
              <ArrowDownToLine className="w-3.5 h-3.5" />
              {lang === "ko" ? `선택 Pull (${selectedKeys.size})` : `Pull selected (${selectedKeys.size})`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
