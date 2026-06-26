import { createFileRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import {
  ArrowLeftCircle,
  ArrowRightCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Settings,
  Wifi,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import type { Domain } from "@/entities/domain";
import { domainsAtom } from "@/entities/domain";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import { groupsAtom, linksAtom } from "@/entities/domain-group";
import { commands, unwrap } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";
import { H1, P } from "@/shared/ui/typography/typography";
import { en } from "./en";
import { ko } from "./ko";
import { apiSettingsSearchAtom } from "./store";

export const Route = createFileRoute("/apis/settings/")({
  component: ApisSettingsPage,
});

// ── ListItem (컴포넌트 바깥 → 리렌더 시 스크롤 유지) ──
function ListItem({ domain, selected, onToggle }: { domain: Domain; selected: boolean; onToggle: () => void }) {
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
      <span className="text-sm font-medium text-base-content/80 truncate flex-1">{domain.url}</span>
    </label>
  );
}

// ── GroupSection ──
function GroupSection({
  groupName,
  domains,
  selectedIds,
  onToggleItem,
}: {
  groupName: string;
  domains: Domain[];
  selectedIds: Set<number>;
  onToggleItem: (id: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const allSelected = domains.length > 0 && domains.every((d) => selectedIds.has(d.id));
  const someSelected = domains.some((d) => selectedIds.has(d.id));

  const handleGroupToggle = () => {
    if (allSelected) {
      for (const d of domains) {
        if (selectedIds.has(d.id)) {
          onToggleItem(d.id);
        }
      }
    } else {
      for (const d of domains) {
        if (!selectedIds.has(d.id)) {
          onToggleItem(d.id);
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
        <span className="text-[10px] text-base-content/40">({domains.length})</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-1 pl-5">
          {domains.map((d) => (
            <ListItem key={d.id} domain={d} selected={selectedIds.has(d.id)} onToggle={() => onToggleItem(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
// ── Main ──
function ApisSettingsPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [domains, setDomains] = useAtom(domainsAtom);
  const [links, setLinks] = useAtom(apiLoggingLinksAtom);
  const [groups, setGroups] = useAtom(groupsAtom);
  const [groupLinks, setGroupLinks] = useAtom(linksAtom);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useAtom(apiSettingsSearchAtom);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [domRes, linkRes, grpRes, glRes] = await Promise.all([
        commands.getDomains().then(unwrap),
        commands.getDomainApiLoggingLinks().then(unwrap),
        commands.getGroups().then(unwrap),
        commands.getDomainGroupLinks().then(unwrap),
      ]);
      if (domRes.success && domRes.data) {
        setDomains(domRes.data);
      }
      if (linkRes.success && linkRes.data) {
        setLinks(linkRes.data);
      }
      if (grpRes.success && grpRes.data) {
        setGroups(grpRes.data);
      }
      if (glRes.success && glRes.data) {
        setGroupLinks(glRes.data);
      }
    } catch (e) {
      console.error("fetchAll:", e);
    } finally {
      setLoading(false);
    }
  }, [setDomains, setGroupLinks, setGroups, setLinks]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const registeredIds = useMemo(() => new Set(links.map((l) => l.domainId)), [links]);

  // domainId → groupName[] 매핑 (멀티 그룹 지원)
  const domainGroupMap = useMemo(() => {
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
  const filterDomains = useCallback(
    (items: Domain[]) => {
      if (!search.trim()) {
        return items;
      }
      const q = search.trim().toLowerCase();
      return items.filter((d) => {
        const gNames = domainGroupMap.get(d.id) || [t.defaultGroup];
        return d.url.toLowerCase().includes(q) || gNames.some((n) => n.toLowerCase().includes(q));
      });
    },
    [search, domainGroupMap, t.defaultGroup],
  );

  const registered = useMemo(
    () => filterDomains(domains.filter((d) => registeredIds.has(d.id))),
    [domains, registeredIds, filterDomains],
  );
  const unregistered = useMemo(
    () => filterDomains(domains.filter((d) => !registeredIds.has(d.id))),
    [domains, registeredIds, filterDomains],
  );

  // 그룹별 분류 (멀티 그룹 지원)
  const groupDomains = useCallback(
    (items: Domain[]) => {
      const grouped: Record<string, Domain[]> = {};
      for (const d of items) {
        const gNames = domainGroupMap.get(d.id) || [t.defaultGroup];
        for (const gName of gNames) {
          if (!grouped[gName]) {
            grouped[gName] = [];
          }
          grouped[gName].push(d);
        }
      }
      const keys = Object.keys(grouped).sort((a, b) => {
        if (a === t.defaultGroup) {
          return 1;
        }
        if (b === t.defaultGroup) {
          return -1;
        }
        return a.localeCompare(b);
      });
      return keys.map((k) => ({ groupName: k, domains: grouped[k] }));
    },
    [domainGroupMap, t.defaultGroup],
  );

  const registeredGroups = useMemo(() => groupDomains(registered), [groupDomains, registered]);
  const unregisteredGroups = useMemo(() => groupDomains(unregistered), [groupDomains, unregistered]);

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

  const selectAllFiltered = (items: Domain[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const d of items) {
        next.add(d.id);
      }
      return next;
    });
  };

  const deselectAllFiltered = (items: Domain[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const d of items) {
        next.delete(d.id);
      }
      return next;
    });
  };

  // 등록 해제 (왼쪽 → 오른쪽)
  const handleUnregister = async () => {
    const ids = Array.from(selectedIds).filter((id) =>
      registeredGroups.some((g) => g.domains.some((d) => d.id === id)),
    );
    if (ids.length === 0) {
      return;
    }
    try {
      for (const id of ids) {
        await commands.removeDomainApiLogging({ domainId: id }).then(unwrap);
      }
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
      console.error("unregister:", e);
    }
  };

  // 등록 (오른쪽 → 왼쪽)
  const handleRegister = async () => {
    const ids = Array.from(selectedIds).filter((id) =>
      unregisteredGroups.some((g) => g.domains.some((d) => d.id === id)),
    );
    if (ids.length === 0) {
      return;
    }
    try {
      for (const id of ids) {
        await commands
          .setDomainApiLogging({
            domainId: id,
            loggingEnabled: true,
            bodyEnabled: false,
            schemaUrl: null,
          })
          .then(unwrap);
      }
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
      console.error("register:", e);
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
        {/* 등록된 도메인 */}
        <Card className="p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-base-content">{t.registeredTitle(registered.length)}</h2>
            </div>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => selectAllFiltered(registered)}
                disabled={registered.length === 0}
              >
                {t.selectAll}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => deselectAllFiltered(registered)}>
                {t.deselectAll}
              </Button>
            </div>
          </div>
          <p className="text-xs text-base-content/50 mb-3">{t.registeredSubtitle}</p>
          <div className="flex flex-col gap-0.5 max-h-[400px] overflow-y-auto grow">
            {registered.length === 0 ? (
              <p className="text-sm text-base-content/30 py-6 text-center grow flex items-center justify-center">
                {search ? t.noSearchResults : t.noRegisteredDomains}
              </p>
            ) : (
              registeredGroups.map((g) => (
                <GroupSection
                  key={g.groupName}
                  groupName={g.groupName}
                  domains={g.domains}
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
            onClick={handleUnregister}
            disabled={!registered.some((d) => selectedIds.has(d.id))}
          >
            <ArrowRightCircle className="w-4 h-4 shrink-0" />
            {t.unregisterSelected(Array.from(selectedIds).filter((id) => registered.some((d) => d.id === id)).length)}
          </Button>
        </Card>

        {/* 미등록 도메인 */}
        <Card className="p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-base-content/30" />
              <h2 className="font-bold text-base-content">{t.unregisteredTitle(unregistered.length)}</h2>
            </div>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => selectAllFiltered(unregistered)}
                disabled={unregistered.length === 0}
              >
                {t.selectAll}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => deselectAllFiltered(unregistered)}>
                {t.deselectAll}
              </Button>
            </div>
          </div>
          <p className="text-xs text-base-content/50 mb-3">{t.unregisteredSubtitle}</p>
          <div className="flex flex-col gap-0.5 max-h-[400px] overflow-y-auto grow">
            {unregistered.length === 0 ? (
              <p className="text-sm text-base-content/30 py-6 text-center grow flex items-center justify-center">
                {search ? t.noSearchResults : t.allDomainsRegistered}
              </p>
            ) : (
              unregisteredGroups.map((g) => (
                <GroupSection
                  key={g.groupName}
                  groupName={g.groupName}
                  domains={g.domains}
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
            onClick={handleRegister}
            disabled={!unregistered.some((d) => selectedIds.has(d.id))}
          >
            <ArrowLeftCircle className="w-4 h-4 shrink-0" />
            {t.registerSelected(Array.from(selectedIds).filter((id) => unregistered.some((d) => d.id === id)).length)}
          </Button>
        </Card>
      </div>

      {loading && <p className="text-sm text-base-content/50 text-center">{t.loading}</p>}
    </div>
  );
}
