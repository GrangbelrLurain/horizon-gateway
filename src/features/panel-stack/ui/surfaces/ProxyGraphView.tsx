import { useVirtualizer } from "@tanstack/react-virtual";
import { useAtom, useAtomValue } from "jotai";
import { Check, Edit2, Plus, RefreshCw, Search, Trash2, Workflow, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { languageAtom } from "@/entities/app";
import { ProxyRouteModal } from "@/entities/domain";
import { localRoutesAtom } from "@/entities/proxy";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { ConfirmModal } from "@/shared/ui/modal/ConfirmModal";
import { useDomainHubData } from "../../hooks/useDomainHubData";
import { en } from "../../i18n/en";
import { ko } from "../../i18n/ko";

interface PathData {
  id: number;
  domainId: number;
  targetKey: string;
  enabled: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export function ProxyGraphView() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;

  const { domains, fetchAll, getGroupName, getDomainHost } = useDomainHubData();
  const [localRoutes] = useAtom(localRoutesAtom);

  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredDomainId, setHoveredDomainId] = useState<number | null>(null);
  const [hoveredTargetKey, setHoveredTargetKey] = useState<string | null>(null);

  // Modals / Editing state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDomainForModal, setSelectedDomainForModal] = useState<Domain | null>(null);
  const [routeToDelete, setRouteToDelete] = useState<number | null>(null);

  // Inline edit state
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);
  const [editHost, setEditHost] = useState("");
  const [editPort, setEditPort] = useState("");
  const [saving, setSaving] = useState(false);

  // Layout refs
  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<PathData[]>([]);

  // Unique Targets calculation
  const uniqueTargets = useMemo(() => {
    const targetsMap = new Map<string, { host: string; port: number; routes: typeof localRoutes }>();
    for (const r of localRoutes) {
      const key = `${r.target_host}:${r.target_port}`;
      const existing = targetsMap.get(key);
      if (existing) {
        existing.routes.push(r);
      } else {
        targetsMap.set(key, { host: r.target_host, port: r.target_port, routes: [r] });
      }
    }
    return Array.from(targetsMap.values());
  }, [localRoutes]);

  // Filtering domains
  const filteredDomains = useMemo(() => {
    return domains
      .filter((d) => {
        const host = getDomainHost(d);
        const groupName = getGroupName(d.id, t.ungrouped);
        const route = localRoutes.find((r) => r.domain_id === d.id);
        const targetStr = route ? `${route.target_host}:${route.target_port}` : "";

        const matchSearch =
          host.includes(searchTerm.toLowerCase()) ||
          groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          targetStr.toLowerCase().includes(searchTerm.toLowerCase());
        return matchSearch;
      })
      .sort((a, b) => {
        const routeA = localRoutes.find((r) => r.domain_id === a.id);
        const routeB = localRoutes.find((r) => r.domain_id === b.id);

        const getWeight = (r: typeof routeA) => {
          if (!r) {
            return 0;
          }
          return r.enabled ? 2 : 1;
        };

        const weightA = getWeight(routeA);
        const weightB = getWeight(routeB);

        if (weightA !== weightB) {
          return weightB - weightA;
        }

        // Secondary sort: alphabetically by host name
        const hostA = getDomainHost(a);
        const hostB = getDomainHost(b);
        return hostA.localeCompare(hostB);
      });
  }, [domains, getDomainHost, getGroupName, t.ungrouped, localRoutes, searchTerm]);

  // Filter unique targets based on filtered domains or search term
  const filteredTargets = useMemo(() => {
    return uniqueTargets.filter((target) => {
      const key = `${target.host}:${target.port}`;
      // Check if target matches search directly
      if (key.toLowerCase().includes(searchTerm.toLowerCase())) {
        return true;
      }
      // Or check if any of the domains connected to it are in the filtered domains
      return target.routes.some((r) => filteredDomains.some((d) => d.id === r.domain_id));
    });
  }, [uniqueTargets, filteredDomains, searchTerm]);

  // Virtualizer for the left column (domains)
  const rowVirtualizer = useVirtualizer({
    count: filteredDomains.length,
    getScrollElement: () => leftColRef.current,
    estimateSize: () => 64, // 52px card + 12px gap
    overscan: 5,
  });

  // Function to calculate and update SVG path coordinates
  const updatePaths = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();

    const newPaths: PathData[] = [];

    localRoutes.forEach((route) => {
      // Ensure the domain and target nodes exist in the current filtered lists
      const domainEl = document.getElementById(`domain-anchor-${route.domain_id}`);
      const targetEl = document.getElementById(`target-anchor-${route.target_host}-${route.target_port}`);

      if (domainEl && targetEl) {
        const dRect = domainEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        const fromX = dRect.right - containerRect.left;
        const fromY = dRect.top + dRect.height / 2 - containerRect.top;
        const toX = tRect.left - containerRect.left;
        const toY = tRect.top + tRect.height / 2 - containerRect.top;

        newPaths.push({
          id: route.id,
          domainId: route.domain_id ?? 0,
          targetKey: `${route.target_host}:${route.target_port}`,
          enabled: route.enabled,
          fromX,
          fromY,
          toX,
          toY,
        });
      }
    });

    setPaths(newPaths);
  }, [localRoutes]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Recalculate paths on resize, scroll, or data change
  useEffect(() => {
    const rightCol = rightColRef.current;
    const leftCol = leftColRef.current;

    const handleScroll = () => {
      requestAnimationFrame(updatePaths);
    };

    rightCol?.addEventListener("scroll", handleScroll);
    leftCol?.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);
    requestAnimationFrame(updatePaths);

    return () => {
      rightCol?.removeEventListener("scroll", handleScroll);
      leftCol?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [updatePaths, virtualItems.length]);

  // Toggle Route Active state
  const handleToggleRoute = async (routeId: number, currentEnabled: boolean) => {
    try {
      await commands.setLocalRouteEnabled({ id: routeId, enabled: !currentEnabled }).then(unwrap);
      await fetchAll();
      await notifyHubDataChanged("routes");
    } catch (e) {
      console.error("setLocalRouteEnabled error:", e);
    }
  };

  // Delete Route
  const handleDeleteRoute = async () => {
    if (routeToDelete === null) {
      return;
    }
    try {
      await commands.removeLocalRoute({ id: routeToDelete }).then(unwrap);
      await fetchAll();
      await notifyHubDataChanged("routes");
    } catch (e) {
      console.error("removeLocalRoute error:", e);
    } finally {
      setRouteToDelete(null);
    }
  };

  // Edit Route
  const handleStartEdit = (route: (typeof localRoutes)[0]) => {
    setEditingRouteId(route.id);
    setEditHost(route.target_host);
    setEditPort(String(route.target_port));
  };

  const handleSaveEdit = async (routeId: number) => {
    const portNum = Number(editPort);
    if (!editHost.trim() || Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return;
    }
    setSaving(true);
    try {
      await commands
        .updateLocalRoute({
          id: routeId,
          targetHost: editHost.trim(),
          targetPort: portNum,
          enabled: null, // Keep current status
        })
        .then(unwrap);
      await fetchAll();
      await notifyHubDataChanged("routes");
      setEditingRouteId(null);
    } catch (e) {
      console.error("updateLocalRoute error:", e);
    } finally {
      setSaving(false);
    }
  };

  const openAddRouteForDomain = (domain: Domain) => {
    setSelectedDomainForModal(domain);
    setShowAddModal(true);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-base-100 text-base-content select-none">
      {/* Header and Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-base-300 bg-base-200/50 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-primary" />
            <h1 className="text-sm font-black tracking-tight">{t.toolsProxyGraph}</h1>
          </div>
          <p className="text-[10px] text-base-content/50 font-medium mt-0.5">{t.proxyGraphDesc}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.proxyGraphSearchPlaceholder}
              className="pl-8 h-8 text-[11px] rounded-lg shadow-sm"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-base-content/65 hover:text-base-content"
            onClick={() => void fetchAll()}
            title={t.monitorRefresh}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div ref={containerRef} className="flex-1 min-h-0 relative flex overflow-hidden p-6 gap-2">
        {/* SVG overlay for drawing connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-hidden">
          <defs>
            <linearGradient id="active-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="inactive-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {paths.map((path) => {
            const isHovered = hoveredDomainId === path.domainId || hoveredTargetKey === path.targetKey;
            const strokeColor = path.enabled ? "url(#active-grad)" : "url(#inactive-grad)";
            const strokeWidth = isHovered ? 4 : 2;
            const opacity = isHovered ? 1.0 : hoveredDomainId || hoveredTargetKey ? 0.2 : 0.65;

            // Generate Bezier Curve points
            const cx1 = (path.fromX + path.toX) / 2;
            const cy1 = path.fromY;
            const cx2 = (path.fromX + path.toX) / 2;
            const cy2 = path.toY;
            const d = `M ${path.fromX} ${path.fromY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${path.toX} ${path.toY}`;

            return (
              <g key={path.id}>
                {/* Glow/Shadow path for active routes on hover */}
                {path.enabled && isHovered && (
                  <path
                    d={d}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={strokeWidth + 4}
                    opacity={0.3}
                    filter="url(#glow)"
                  />
                )}
                <path
                  d={d}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={path.enabled ? undefined : "5,5"}
                  opacity={opacity}
                  className="transition-all duration-200"
                />
                {/* Animated traffic flows on active routes */}
                {path.enabled && opacity > 0.3 && (
                  <circle r={isHovered ? 3.5 : 2.5} fill={isHovered ? "#34d399" : "#10b981"}>
                    <animateMotion dur={isHovered ? "2s" : "4.5s"} repeatCount="indefinite" path={d} />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Left Column: Domains */}
        <div ref={leftColRef} className="w-[45%] h-full overflow-y-auto pr-4 z-20 scrollbar-thin">
          <div className="flex items-center justify-between pb-1 border-b border-base-300 mb-3">
            <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">
              {t.domains} ({filteredDomains.length})
            </span>
          </div>

          {filteredDomains.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-base-300 text-center text-xs text-base-content/40">
              {searchTerm ? t.proxyGraphEmptySearch : t.noDomains}
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const d = filteredDomains[virtualRow.index];
                if (!d) {
                  return null;
                }
                const host = getDomainHost(d);
                const groupName = getGroupName(d.id, t.ungrouped);
                const route = localRoutes.find((r) => r.domain_id === d.id);
                const isHovered = hoveredDomainId === d.id;

                return (
                  <div
                    key={d.id}
                    id={`domain-node-${d.id}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size - 12}px`, // Subtract gap
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`relative p-3 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                      isHovered
                        ? "border-primary/50 bg-primary/5 shadow-md"
                        : "border-base-300 bg-base-100 hover:bg-base-200/40"
                    }`}
                    onMouseEnter={() => {
                      setHoveredDomainId(d.id);
                      if (route) {
                        setHoveredTargetKey(`${route.target_host}:${route.target_port}`);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredDomainId(null);
                      setHoveredTargetKey(null);
                    }}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-base-content truncate">{host}</span>
                      </div>
                      <span className="text-[9px] text-base-content/40 font-bold block mt-1">{groupName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {route ? (
                        <div className="flex items-center gap-1.5 bg-base-200/50 px-2 py-1 rounded-lg border border-base-300">
                          <span className="text-[9px] font-bold font-mono text-base-content/70">
                            {route.target_port}
                          </span>
                          <button
                            type="button"
                            className={`w-7 h-4 rounded-full p-0.5 transition-colors relative focus:outline-none ${
                              route.enabled ? "bg-success" : "bg-base-300"
                            }`}
                            onClick={() => handleToggleRoute(route.id, route.enabled)}
                            title={route.enabled ? t.featureOn : t.featureOff}
                          >
                            <div
                              className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                route.enabled ? "translate-x-3" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 gap-1 text-[9px] font-bold text-primary border border-primary/20 hover:bg-primary/10 rounded-lg"
                          onClick={() => openAddRouteForDomain(d)}
                        >
                          <Plus className="w-2.5 h-2.5" />
                          {t.proxyRouteAdd}
                        </Button>
                      )}

                      {/* Connector Anchor node */}
                      <div
                        id={`domain-anchor-${d.id}`}
                        className={`w-2.5 h-2.5 rounded-full border-2 border-base-100 absolute -right-1.5 top-1/2 -translate-y-1/2 transition-colors ${
                          route ? (route.enabled ? "bg-success" : "bg-slate-400") : "bg-base-300"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Center spacing column */}
        <div className="w-[10%] h-full shrink-0 pointer-events-none" />

        {/* Right Column: Proxy Targets */}
        <div ref={rightColRef} className="w-[45%] h-full overflow-y-auto pl-4 space-y-3 z-20 scrollbar-thin">
          <div className="flex items-center justify-between pb-1 border-b border-base-300">
            <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">
              {t.proxyTarget} ({filteredTargets.length})
            </span>
          </div>

          {filteredTargets.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-base-300 text-center text-xs text-base-content/40">
              {localRoutes.length === 0 ? t.proxyGraphNoRoutes : t.proxyGraphEmptySearch}
            </div>
          ) : (
            filteredTargets.map((target) => {
              const targetKey = `${target.host}:${target.port}`;
              const isHovered = hoveredTargetKey === targetKey;
              const anyEnabled = target.routes.some((r) => r.enabled);

              return (
                <div
                  key={targetKey}
                  id={`target-node-${target.host}-${target.port}`}
                  className={`relative p-4 rounded-xl border transition-all duration-200 flex flex-col gap-3 ${
                    isHovered
                      ? "border-success/50 bg-success/5 shadow-md"
                      : "border-base-300 bg-base-100 hover:bg-base-200/40"
                  }`}
                  onMouseEnter={() => {
                    setHoveredTargetKey(targetKey);
                  }}
                  onMouseLeave={() => {
                    setHoveredTargetKey(null);
                    setHoveredDomainId(null);
                  }}
                >
                  {/* Left Connector Anchor node */}
                  <div
                    id={`target-anchor-${target.host}-${target.port}`}
                    className={`w-2.5 h-2.5 rounded-full border-2 border-base-100 absolute -left-1.5 top-5 -translate-y-1/2 transition-colors ${
                      anyEnabled ? "bg-success" : "bg-slate-400"
                    }`}
                  />

                  {/* Target title info */}
                  <div className="flex items-center justify-between pb-2 border-b border-base-200">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black font-mono text-base-content">
                        {target.host}:{target.port}
                      </span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 bg-base-200 text-base-content/60 font-bold rounded">
                      {target.routes.length} connections
                    </span>
                  </div>

                  {/* Inner Routes list under this target */}
                  <div className="space-y-2">
                    {target.routes.map((route) => {
                      const isEditing = editingRouteId === route.id;
                      const connectedDomain = domains.find((d) => d.id === route.domain_id);
                      const domainLabel = connectedDomain ? getDomainHost(connectedDomain) : route.domain;

                      return (
                        <div
                          key={route.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-base-200/50 border border-base-300 gap-2"
                        >
                          <span
                            className="text-[10px] font-bold font-mono text-base-content/80 truncate max-w-[150px] cursor-help"
                            title={domainLabel}
                            onMouseEnter={() => setHoveredDomainId(route.domain_id ?? 0)}
                          >
                            {domainLabel}
                          </span>

                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editHost}
                                onChange={(e) => setEditHost(e.target.value)}
                                placeholder="host"
                                className="h-6 px-1.5 text-[10px] w-20 rounded-md"
                              />
                              <Input
                                value={editPort}
                                onChange={(e) => setEditPort(e.target.value)}
                                placeholder="port"
                                type="number"
                                className="h-6 px-1.5 text-[10px] w-12 rounded-md"
                              />
                              <button
                                type="button"
                                className="h-6 w-6 rounded-md bg-success text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50"
                                onClick={() => handleSaveEdit(route.id)}
                                disabled={saving}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                className="h-6 w-6 rounded-md bg-base-300 text-base-content flex items-center justify-center hover:bg-base-300/80"
                                onClick={() => setEditingRouteId(null)}
                                disabled={saving}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {/* Enable/Disable switch */}
                              <button
                                type="button"
                                className={`w-7 h-4 rounded-full p-0.5 transition-colors relative focus:outline-none ${
                                  route.enabled ? "bg-success" : "bg-base-300"
                                }`}
                                onClick={() => handleToggleRoute(route.id, route.enabled)}
                              >
                                <div
                                  className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                    route.enabled ? "translate-x-3" : "translate-x-0"
                                  }`}
                                />
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                className="text-base-content/40 hover:text-base-content p-1 rounded hover:bg-base-300/50"
                                onClick={() => handleStartEdit(route)}
                                title={t.mockingEditRule}
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                className="text-error/60 hover:text-error p-1 rounded hover:bg-error/10"
                                onClick={() => setRouteToDelete(route.id)}
                                title={t.mockingDeleteRule}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Proxy Route Modal */}
      {showAddModal && selectedDomainForModal && (
        <ProxyRouteModal
          domainId={selectedDomainForModal.id}
          domainUrl={selectedDomainForModal.url}
          t={t}
          onClose={() => {
            setShowAddModal(false);
            setSelectedDomainForModal(null);
          }}
          onAdded={() => {
            setShowAddModal(false);
            setSelectedDomainForModal(null);
            void fetchAll();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={routeToDelete !== null}
        onClose={() => setRouteToDelete(null)}
        onConfirm={handleDeleteRoute}
        title={t.proxyRouteDelete}
        message={t.proxyRouteDeleteConfirm}
        confirmText={t.proxyRouteDelete}
        cancelText={t.proxyRouteCancel}
        type="danger"
      />
    </div>
  );
}
