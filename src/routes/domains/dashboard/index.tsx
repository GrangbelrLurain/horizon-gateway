import { createFileRoute, Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import { Check, ChevronDown, Copy, Download, Folder, Globe, LayoutGrid, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { languageAtom } from "@/entities/app/i18n/store";
import { proxyActiveAtom } from "@/entities/app/status/store";
import { domainsAtom } from "@/entities/domain";
import type { DomainFeatureState } from "@/entities/domain/ui";
import { DomainListEmpty, EditDomainModal, GroupSelectModal, VirtualizedDomainList } from "@/entities/domain/ui";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import { groupsAtom, linksAtom } from "@/entities/domain-group";
import { monitorLinksAtom } from "@/entities/domain-monitor";
import { localRoutesAtom } from "@/entities/proxy";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { Badge } from "@/shared/ui/badge/badge";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";
import { LoadingScreen } from "@/shared/ui/loader/LoadingScreen";
import { ConfirmModal } from "@/shared/ui/modal/ConfirmModal";
import { en } from "./en";
import { ko } from "./ko";
import { dashboardFilterGroupIdAtom, dashboardSearchQueryAtom } from "./store";

export const Route = createFileRoute("/domains/dashboard/")({
  component: RouteComponent,
});

const NO_GROUP = 0 as const;

function RouteComponent() {
  const [domains, setDomains] = useAtom(domainsAtom);
  const [groups, setGroups] = useAtom(groupsAtom);
  const [searchQuery, setSearchQuery] = useAtom(dashboardSearchQueryAtom);
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [filterGroupId, setFilterGroupId] = useAtom(dashboardFilterGroupIdAtom);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [groupSelectDomain, setGroupSelectDomain] = useState<Domain | null>(null);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);
  const [links, setLinks] = useAtom(linksAtom);
  const [deleteDomainId, setDeleteDomainId] = useState<number | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Feature data
  const [monitorLinks, setMonitorLinks] = useAtom(monitorLinksAtom);
  const [apiLoggingLinks, setApiLoggingLinks] = useAtom(apiLoggingLinksAtom);
  const [localRoutes, setLocalRoutes] = useAtom(localRoutesAtom);
  const proxyActive = useAtomValue(proxyActiveAtom);

  // ── Maps ─────────────────────────────────────────────────────────────────────

  const domainGroupIds = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const l of links) {
      map.set(l.domain_id, [...(map.get(l.domain_id) ?? []), l.group_id]);
    }
    return map;
  }, [links]);

  // monitor: domainId → checkEnabled
  const monitorMap = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const m of monitorLinks) {
      map.set(m.domainId, m.checkEnabled);
    }
    return map;
  }, [monitorLinks]);

  // apiLogging: domainId → loggingEnabled
  const apiLoggingMap = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const a of apiLoggingLinks) {
      map.set(a.domainId, a.loggingEnabled ?? false);
    }
    return map;
  }, [apiLoggingLinks]);

  // proxy: domainHost → { id, enabled }
  const proxyRouteMap = useMemo(() => {
    const map = new Map<string, { id: number; enabled: boolean }>();
    for (const r of localRoutes) {
      if (r.domain) {
        map.set(r.domain.toLowerCase(), { id: r.id, enabled: r.enabled });
      }
    }
    return map;
  }, [localRoutes]);

  // ── Fetchers ──────────────────────────────────────────────────────────────────

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    try {
      const response = await commands.getDomains().then(unwrap);
      setDomains(response.data ?? []);
    } catch (err) {
      console.error("Failed to fetch domains:", err);
    } finally {
      setLoading(false);
    }
  }, [setDomains]);

  const fetchGroups = useCallback(async () => {
    try {
      const response = await commands.getGroups().then(unwrap);
      setGroups(response.data ?? []);
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  }, [setGroups]);

  const fetchLinks = useCallback(async () => {
    try {
      const response = await commands.getDomainGroupLinks().then(unwrap);
      setLinks(response.data ?? []);
    } catch (err) {
      console.error("Failed to fetch links:", err);
    }
  }, [setLinks]);

  const fetchFeatureData = useCallback(async () => {
    try {
      const [monitorRes, apiLoggingRes, routesRes] = await Promise.all([
        commands.getDomainMonitorList().then(unwrap),
        commands.getDomainApiLoggingLinks().then(unwrap),
        commands.getLocalRoutes().then(unwrap),
      ]);
      if (monitorRes.success) {
        setMonitorLinks(monitorRes.data ?? []);
      }
      if (apiLoggingRes.success) {
        setApiLoggingLinks(apiLoggingRes.data ?? []);
      }
      if (routesRes.success) {
        setLocalRoutes(routesRes.data ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch feature data:", err);
    }
  }, [setApiLoggingLinks, setLocalRoutes, setMonitorLinks]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);
  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);
  useEffect(() => {
    fetchFeatureData();
  }, [fetchFeatureData]);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const getGroupName = useCallback(
    (domainId: number) => {
      const ids = domainGroupIds.get(domainId) ?? [];
      if (ids.length === 0) {
        return t.noGroup;
      }
      const g = groups.find((x) => x.id === ids[0]);
      return g?.name ?? `Group #${ids[0]}`;
    },
    [groups, domainGroupIds, t.noGroup],
  );

  const getFeatureState = useCallback(
    (domainId: number): DomainFeatureState => {
      // Resolve hostname from domain URL for proxy lookup
      const domain = domains.find((d) => d.id === domainId);
      let domainHost: string | undefined;
      if (domain) {
        try {
          const u = new URL(domain.url.startsWith("http") ? domain.url : `https://${domain.url}`);
          domainHost = u.hostname.toLowerCase();
        } catch {
          domainHost = domain.url.toLowerCase();
        }
      }

      const proxyRoute = domainHost ? proxyRouteMap.get(domainHost) : undefined;

      return {
        monitorEnabled: monitorMap.has(domainId) ? monitorMap.get(domainId) : undefined,
        proxyEnabled: proxyRoute?.enabled,
        proxyRouteId: proxyRoute?.id,
        apiLoggingEnabled: apiLoggingMap.has(domainId) ? apiLoggingMap.get(domainId) : undefined,
      };
    },
    [domains, monitorMap, proxyRouteMap, apiLoggingMap],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const handleUpdateGroup = useCallback(
    async (domain: Domain, newGroupId: number | null) => {
      setUpdatingId(domain.id);
      try {
        await commands
          .setDomainGroups({
            domainId: domain.id,
            groupIds: newGroupId != null ? [newGroupId] : [],
          })
          .then(unwrap);
        await fetchLinks();
      } catch (err) {
        console.error("Failed to update domain group:", err);
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchLinks],
  );

  const handleDeleteDomain = useCallback(
    async (id: number) => {
      await commands.removeDomains({ id }).then(unwrap);
      fetchDomains();
    },
    [fetchDomains],
  );

  const handleSaveEdit = useCallback(
    async (domain: Domain, updates: { url?: string; groupId?: number | null }) => {
      setUpdatingId(domain.id);
      try {
        if (updates.url !== undefined) {
          await commands.updateDomainById({ id: domain.id, url: updates.url }).then(unwrap);
        }
        if (updates.groupId !== undefined) {
          await commands
            .setDomainGroups({
              domainId: domain.id,
              groupIds: updates.groupId != null ? [updates.groupId] : [],
            })
            .then(unwrap);
        }
        await fetchDomains();
        await fetchLinks();
      } catch (err) {
        console.error("Failed to save domain:", err);
      } finally {
        setUpdatingId(null);
        setEditDomain(null);
      }
    },
    [fetchDomains, fetchLinks],
  );

  const handleClearAll = async () => {
    try {
      await commands.clearAllDomains().then(unwrap);
      fetchDomains();
    } catch (err) {
      console.error("Failed to clear domains:", err);
    }
  };

  const downloadJson = async () => {
    if (domains.length === 0) {
      return;
    }
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: `watchtower-domains-${new Date().toISOString().slice(0, 10)}.json`,
      });
      if (path) {
        await writeTextFile(path, JSON.stringify(domains, null, 2));
        alert(t.alertExportSuccess);
      }
    } catch (err) {
      console.error("Failed to save JSON:", err);
      const data = JSON.stringify(domains, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `watchtower-domains-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // ── Filtering & Virtualizing ──────────────────────────────────────────────────

  const filteredDomains = domains.filter((d) => {
    const matchesSearch = d.url.toLowerCase().includes(searchQuery.toLowerCase());
    const groupIds = domainGroupIds.get(d.id) ?? [];
    const matchesGroup =
      filterGroupId === NO_GROUP || (filterGroupId === -1 && groupIds.length === 0) || groupIds.includes(filterGroupId);
    return matchesSearch && matchesGroup;
  });

  const handleCopy = useCallback(
    async (type: "domain-group" | "group-domains") => {
      setIsDropdownOpen(false);
      if (filteredDomains.length === 0) {
        return;
      }

      let text = "";
      if (type === "domain-group") {
        text = filteredDomains
          .map((d) => {
            const ids = domainGroupIds.get(d.id) ?? [];
            const groupNames = ids.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean) as string[];
            const groupStr = groupNames.length > 0 ? groupNames.join(", ") : t.noGroup;
            return `${d.url} (${groupStr})`;
          })
          .join("\n");
      } else if (type === "group-domains") {
        const grouped: Record<string, string[]> = {};
        for (const d of filteredDomains) {
          const ids = domainGroupIds.get(d.id) ?? [];
          if (ids.length === 0) {
            const noGroupName = t.noGroup;
            if (!grouped[noGroupName]) {
              grouped[noGroupName] = [];
            }
            grouped[noGroupName].push(d.url);
          } else {
            for (const id of ids) {
              const g = groups.find((x) => x.id === id);
              const groupName = g?.name ?? `Group #${id}`;
              if (!grouped[groupName]) {
                grouped[groupName] = [];
              }
              grouped[groupName].push(d.url);
            }
          }
        }
        text = Object.entries(grouped)
          .map(([groupName, urls]) => `${groupName}:\n${urls.map((url) => `- ${url}`).join("\n")}`)
          .join("\n\n");
      }

      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error("Failed to copy text:", err);
        }
      }
    },
    [filteredDomains, domainGroupIds, groups, t.noGroup],
  );

  const listParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredDomains.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 116 + 12, // expanded row height (badges + gap)
    overscan: 10,
  });

  // ── Feature T ─────────────────────────────────────────────────────────────────
  const featureT = {
    featureMonitor: t.featureMonitor,
    featureProxy: t.featureProxy,
    featureApiLogging: t.featureApiLogging,
    featureOn: t.featureOn,
    featureOff: t.featureOff,
    featureTogglingOn: t.featureTogglingOn,
    featureTogglingOff: t.featureTogglingOff,
    featureProxyGlobalOff: t.featureProxyGlobalOff,
    featureProxyGlobalOffLink: t.featureProxyGlobalOffLink,
    proxyRouteModalTitle: t.proxyRouteModalTitle,
    proxyRouteModalDesc: t.proxyRouteModalDesc,
    proxyRouteTargetHost: t.proxyRouteTargetHost,
    proxyRouteTargetPort: t.proxyRouteTargetPort,
    proxyRouteAdd: t.proxyRouteAdd,
    proxyRouteCancel: t.proxyRouteCancel,
    proxyRouteAdding: t.proxyRouteAdding,
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8">
      <AnimatePresence>
        {loading && <LoadingScreen key="domains-loader" onCancel={() => setLoading(false)} />}
      </AnimatePresence>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Globe className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-base-content">{t.title}</h1>
          </div>
          <p className="text-base-content/60">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/domains/groups">
            <Button variant="secondary" className="gap-2 flex items-center">
              <LayoutGrid className="w-4 h-4 inline-block" /> {t.btnGroups}
            </Button>
          </Link>
          <Link to="/domains/regist">
            <Button variant="primary" className="gap-2 shadow-lg shadow-blue-500/20 flex items-center">
              <Plus className="w-4 h-4 inline-block" /> {t.btnDomain}
            </Button>
          </Link>
        </div>
      </header>

      <Card className="p-2 md:p-4 bg-base-100/50 backdrop-blur-sm border-base-300">
        <div className="flex flex-col md:flex-row gap-4 mb-6 p-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <Input
              type="text"
              placeholder={t.searchPlaceholder}
              className="w-full pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-base-content/40" />
              <select
                className="bg-base-100 border border-base-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer text-base-content"
                value={filterGroupId === NO_GROUP ? "" : filterGroupId === -1 ? "none" : filterGroupId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setFilterGroupId(NO_GROUP);
                  } else if (v === "none") {
                    setFilterGroupId(-1);
                  } else {
                    setFilterGroupId(Number(v));
                  }
                }}
              >
                <option value="">{t.filterAllGroups}</option>
                <option value="none">{t.filterNoGroup}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {domains.length > 0 && (
              <>
                <div className="relative inline-block text-left" ref={dropdownRef}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2 h-9 flex items-center font-bold tracking-tight bg-base-100"
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-success" />
                        <span className="text-success">{t.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        {t.btnCopy}
                        <ChevronDown className="w-3.5 h-3.5 text-base-content/40" />
                      </>
                    )}
                  </Button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-60 bg-base-100 border border-base-300 rounded-xl shadow-xl z-50 py-1 overflow-hidden backdrop-blur-md bg-base-100/95">
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-base-200 text-base-content transition-colors flex flex-col gap-0.5 cursor-pointer"
                        onClick={() => handleCopy("domain-group")}
                      >
                        <span className="font-semibold text-base-content">{t.copyDomainGroup}</span>
                        <span className="text-[10px] text-base-content/50">domain (Group A, Group B)</span>
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-base-200 border-t border-base-200 text-base-content transition-colors flex flex-col gap-0.5 cursor-pointer"
                        onClick={() => handleCopy("group-domains")}
                      >
                        <span className="font-semibold text-base-content">{t.copyGroupDomains}</span>
                        <span className="text-[10px] text-base-content/50">Group:\n- domain</span>
                      </button>
                    </div>
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 h-9 flex items-center font-bold tracking-tight bg-base-100"
                  onClick={downloadJson}
                >
                  <Download className="w-4 h-4" /> {t.exportJson}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="gap-2 h-9 flex items-center font-bold tracking-tight"
                  onClick={() => setIsClearAllConfirmOpen(true)}
                >
                  <Trash2 className="w-4 h-4" /> {t.clearAll}
                </Button>
              </>
            )}
            <Badge
              variant={{ color: "blue" }}
              className="flex items-center gap-2 h-9 px-4 font-black uppercase tracking-widest text-[10px]"
            >
              {t.total}: {domains.length}
            </Badge>
          </div>
        </div>

        {filteredDomains.length > 0 ? (
          <VirtualizedDomainList
            filteredDomains={filteredDomains}
            rowVirtualizer={rowVirtualizer}
            listParentRef={listParentRef}
            getGroupName={getGroupName}
            getFeatureState={getFeatureState}
            proxyActive={proxyActive}
            featureT={featureT}
            updatingId={updatingId}
            onSelectGroup={setGroupSelectDomain}
            onEdit={setEditDomain}
            onDelete={setDeleteDomainId}
            onRefreshFeatures={fetchFeatureData}
          />
        ) : (
          <DomainListEmpty
            searchQuery={searchQuery}
            translations={{
              searchTitle: t.listEmptySearchTitle,
              searchDesc: t.listEmptySearchDesc,
              noDomainsTitle: t.listEmptyNoDomainsTitle,
              noDomainsDesc: t.listEmptyNoDomainsDesc,
              addDomainBtn: t.listEmptyAddDomainBtn,
            }}
          />
        )}
      </Card>

      <GroupSelectModal
        isOpen={groupSelectDomain !== null}
        onClose={() => setGroupSelectDomain(null)}
        domain={groupSelectDomain}
        groups={groups}
        selectedGroupIds={domainGroupIds.get(groupSelectDomain?.id ?? 0) ?? []}
        onSelectGroup={(domain: Domain, groupId: number | null) => {
          handleUpdateGroup(domain, groupId);
          setGroupSelectDomain(null);
        }}
        translations={{
          title: t.groupModalTitle,
          desc: t.groupModalDesc,
          noGroup: t.groupModalNoGroup,
          empty: t.groupModalEmpty,
        }}
      />

      <EditDomainModal
        isOpen={editDomain !== null}
        onClose={() => setEditDomain(null)}
        domain={editDomain}
        groups={groups}
        selectedGroupIds={domainGroupIds.get(editDomain?.id ?? 0) ?? []}
        onSave={handleSaveEdit}
        translations={{
          title: t.editModalTitle,
          desc: t.editModalDesc,
          urlLabel: t.editModalUrlLabel,
          groupLabel: t.editModalGroupLabel,
          save: t.editModalSave,
          noGroup: t.groupModalNoGroup,
          empty: t.groupModalEmpty,
          cancel: t.editModalCancel,
        }}
      />

      <ConfirmModal
        isOpen={deleteDomainId !== null}
        onClose={() => setDeleteDomainId(null)}
        onConfirm={() => deleteDomainId && handleDeleteDomain(deleteDomainId)}
        title={t.confirmDeleteTitle || "Delete Domain"}
        message={t.confirmDelete}
        confirmText={t.confirmDeleteAction || "Delete"}
        cancelText={t.editModalCancel}
        type="danger"
      />

      <ConfirmModal
        isOpen={isClearAllConfirmOpen}
        onClose={() => setIsClearAllConfirmOpen(false)}
        onConfirm={handleClearAll}
        title={t.confirmClearAllTitle || "Clear All Domains"}
        message={t.confirmClearAll}
        confirmText={t.confirmClearAllAction || "Clear All"}
        cancelText={t.editModalCancel}
        type="danger"
      />
    </div>
  );
}
