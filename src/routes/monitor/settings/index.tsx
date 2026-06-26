import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Search,
  Settings,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import type { DomainGroup, DomainGroupLink } from "@/entities/domain-group";
import type { DomainMonitorWithUrl } from "@/entities/domain-monitor";
import { commands, unwrap } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";
import { H1, P } from "@/shared/ui/typography/typography";
import { en } from "./en";
import { ko } from "./ko";

export const Route = createFileRoute("/monitor/settings/")({
  component: MonitorSettings,
});

// ── ListItem (컴포넌트 바깥 정의 → 리렌더 시 unmount 방지, 스크롤 유지) ──
function ListItem({
  item,
  selected,
  onToggle,
  groupName,
}: {
  item: DomainMonitorWithUrl;
  selected: boolean;
  onToggle: () => void;
  groupName?: string;
}) {
  return (
    <label
      className={clsx(
        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
        selected ? "bg-primary/10 border border-primary/20" : "hover:bg-base-200",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="rounded border-base-300 text-primary focus:ring-primary shrink-0"
      />
      <span className="text-sm font-medium text-base-content/80 truncate flex-1">{item.url}</span>
      {groupName && <span className="text-[10px] text-base-content/40 shrink-0">{groupName}</span>}
    </label>
  );
}

// ── GroupSection: 그룹별 접기/펼치기 섹션 ──
function GroupSection({
  groupName,
  items,
  selectedIds,
  onToggleItem,
}: {
  groupName: string;
  items: DomainMonitorWithUrl[];
  selectedIds: Set<number>;
  onToggleItem: (id: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.domainId));
  const someSelected = items.some((i) => selectedIds.has(i.domainId));

  const handleGroupToggle = () => {
    if (allSelected) {
      // 모두 해제
      for (const i of items) {
        if (selectedIds.has(i.domainId)) {
          onToggleItem(i.domainId);
        }
      }
    } else {
      // 모두 선택
      for (const i of items) {
        if (!selectedIds.has(i.domainId)) {
          onToggleItem(i.domainId);
        }
      }
    }
  };

  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 py-1.5 px-1">
        <button
          type="button"
          className="text-base-content/40 hover:text-base-content/60"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) {
              el.indeterminate = someSelected && !allSelected;
            }
          }}
          onChange={handleGroupToggle}
          className="rounded border-base-300 text-primary focus:ring-primary shrink-0"
        />
        <span className="text-xs font-semibold text-base-content/60 select-none">{groupName}</span>
        <span className="text-[10px] text-base-content/40">({items.length})</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-1 pl-5">
          {items.map((item) => (
            <ListItem
              key={item.domainId}
              item={item}
              selected={selectedIds.has(item.domainId)}
              onToggle={() => onToggleItem(item.domainId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──
function MonitorSettings() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [list, setList] = useState<DomainMonitorWithUrl[]>([]);
  const [groups, setGroups] = useState<DomainGroup[]>([]);
  const [groupLinks, setGroupLinks] = useState<DomainGroupLink[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [monRes, grpRes, linkRes] = await Promise.all([
        commands.getDomainMonitorList().then(unwrap),
        commands.getGroups().then(unwrap),
        commands.getDomainGroupLinks().then(unwrap),
      ]);
      if (monRes.success && monRes.data) {
        setList(monRes.data);
      }
      if (grpRes.success && grpRes.data) {
        setGroups(grpRes.data);
      }
      if (linkRes.success && linkRes.data) {
        setGroupLinks(linkRes.data);
      }
    } catch (e) {
      console.error("fetchAll:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // domainId → groupName[] 매핑 (멀티 그룹 지원)
  const domainToGroupsMap = useMemo(() => {
    const idToName = new Map<number, string>();
    for (const g of groups) {
      idToName.set(g.id, g.name);
    }
    const result = new Map<number, string[]>();
    for (const link of groupLinks) {
      const name = idToName.get(link.group_id);
      if (name) {
        const prev = result.get(link.domain_id) || [];
        result.set(link.domain_id, [...prev, name]);
      }
    }
    return result;
  }, [groups, groupLinks]);

  // 검색 필터
  const filtered = useMemo(() => {
    if (!search.trim()) {
      return list;
    }
    const q = search.trim().toLowerCase();
    return list.filter((item) => {
      const gNames = domainToGroupsMap.get(item.domainId) || [t.defaultGroup];
      return item.url.toLowerCase().includes(q) || gNames.some((n) => n.toLowerCase().includes(q));
    });
  }, [list, search, domainToGroupsMap, t.defaultGroup]);

  const checked = useMemo(() => filtered.filter((d) => d.checkEnabled), [filtered]);
  const unchecked = useMemo(() => filtered.filter((d) => !d.checkEnabled), [filtered]);

  // 그룹별 분류 (멀티 그룹 지원)
  const groupItems = useCallback(
    (items: DomainMonitorWithUrl[]) => {
      const grouped: Record<string, DomainMonitorWithUrl[]> = {};
      for (const item of items) {
        const gNames = domainToGroupsMap.get(item.domainId) || [t.defaultGroup];
        for (const gName of gNames) {
          if (!grouped[gName]) {
            grouped[gName] = [];
          }
          grouped[gName].push(item);
        }
      }
      // Default 그룹을 마지막으로
      const keys = Object.keys(grouped).sort((a, b) => {
        if (a === t.defaultGroup) {
          return 1;
        }
        if (b === t.defaultGroup) {
          return -1;
        }
        return a.localeCompare(b);
      });
      return keys.map((k) => ({ groupName: k, items: grouped[k] }));
    },
    [domainToGroupsMap, t.defaultGroup],
  );

  const checkedGroups = useMemo(() => groupItems(checked), [groupItems, checked]);
  const uncheckedGroups = useMemo(() => groupItems(unchecked), [groupItems, unchecked]);

  const toggleDomain = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllFiltered = (items: DomainMonitorWithUrl[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const d of items) {
        next.add(d.domainId);
      }
      return next;
    });
  };

  const deselectAllFiltered = (items: DomainMonitorWithUrl[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const d of items) {
        next.delete(d.domainId);
      }
      return next;
    });
  };

  const handleDisable = async () => {
    const ids = Array.from(selectedIds).filter((id) => checked.some((d) => d.domainId === id));
    if (ids.length === 0) {
      return;
    }
    try {
      await commands.setDomainMonitorCheckEnabled({ domainIds: ids, enabled: false }).then(unwrap);
      // 성공한 것만 제거
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          next.delete(id);
        }
        return next;
      });
      await fetchAll();
    } catch (e) {
      console.error("set_domain_monitor_check_enabled:", e);
    }
  };

  const handleEnable = async () => {
    const ids = Array.from(selectedIds).filter((id) => unchecked.some((d) => d.domainId === id));
    if (ids.length === 0) {
      return;
    }
    try {
      await commands.setDomainMonitorCheckEnabled({ domainIds: ids, enabled: true }).then(unwrap);
      // 성공한 것만 제거
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          next.delete(id);
        }
        return next;
      });
      await fetchAll();
    } catch (e) {
      console.error("set_domain_monitor_check_enabled:", e);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Settings className="w-5 h-5" />
          </div>
          <H1>{t.title}</H1>
        </div>
        <P className="text-base-content/60">{t.subtitle}</P>
      </header>

      {/* 검색 */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
        <Input
          placeholder={t.searchPlaceholder}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 체크할 도메인 */}
        <Card className="p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <h2 className="font-bold text-base-content">{t.checkedTitle(checked.length)}</h2>
            </div>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => selectAllFiltered(checked)}
                disabled={checked.length === 0}
              >
                {t.selectAll}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => deselectAllFiltered(checked)}>
                {t.deselect}
              </Button>
            </div>
          </div>
          <p className="text-xs text-base-content/50 mb-3">{t.checkedDesc}</p>
          <div className="flex flex-col gap-0.5 max-h-[400px] overflow-y-auto grow">
            {checked.length === 0 ? (
              <p className="text-sm text-base-content/30 py-6 text-center grow flex items-center justify-center">
                {t.noResults(search)}
              </p>
            ) : (
              checkedGroups.map((g) => (
                <GroupSection
                  key={g.groupName}
                  groupName={g.groupName}
                  items={g.items}
                  selectedIds={selectedIds}
                  onToggleItem={toggleDomain}
                />
              ))
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4 w-full gap-2 flex items-center justify-center"
            onClick={handleDisable}
            disabled={!checked.some((d) => selectedIds.has(d.domainId))}
          >
            <ArrowDownCircle className="w-4 h-4 shrink-0" />
            {t.disableBtn(Array.from(selectedIds).filter((id) => checked.some((d) => d.domainId === id)).length)}
          </Button>
        </Card>

        {/* 체크 안할 도메인 */}
        <Card className="p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-base-content/30" />
              <h2 className="font-bold text-base-content">{t.uncheckedTitle(unchecked.length)}</h2>
            </div>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => selectAllFiltered(unchecked)}
                disabled={unchecked.length === 0}
              >
                {t.selectAll}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => deselectAllFiltered(unchecked)}>
                {t.deselect}
              </Button>
            </div>
          </div>
          <p className="text-xs text-base-content/50 mb-3">{t.uncheckedDesc}</p>
          <div className="flex flex-col gap-0.5 max-h-[400px] overflow-y-auto grow">
            {unchecked.length === 0 ? (
              <p className="text-sm text-base-content/30 py-6 text-center grow flex items-center justify-center">
                {search ? t.noResults(search) : t.allCheckedResult}
              </p>
            ) : (
              uncheckedGroups.map((g) => (
                <GroupSection
                  key={g.groupName}
                  groupName={g.groupName}
                  items={g.items}
                  selectedIds={selectedIds}
                  onToggleItem={toggleDomain}
                />
              ))
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            className="mt-4 w-full gap-2 flex items-center justify-center"
            onClick={handleEnable}
            disabled={!unchecked.some((d) => selectedIds.has(d.domainId))}
          >
            <ArrowUpCircle className="w-4 h-4 shrink-0" />
            {t.enableBtn(Array.from(selectedIds).filter((id) => unchecked.some((d) => d.domainId === id)).length)}
          </Button>
        </Card>
      </div>

      {loading && <p className="text-sm text-base-content/50 text-center">{t.loading}</p>}
    </div>
  );
}
