import { useMemo, useState } from "react";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { Modal } from "@/shared/ui/modal/Modal";
import type { ProxyRouteModalT } from "./types";

interface ProxyRouteModalProps {
  domainId: number;
  domainUrl: string;
  t: ProxyRouteModalT;
  onClose: () => void;
  onAdded: () => void;
}

export function ProxyRouteModal({ domainId, domainUrl, t, onClose, onAdded }: ProxyRouteModalProps) {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("3000");
  const [adding, setAdding] = useState(false);

  let domainHost = domainUrl;
  try {
    const u = new URL(domainUrl.startsWith("http") ? domainUrl : `https://${domainUrl}`);
    domainHost = u.hostname;
  } catch (e) {
    console.error("Invalid URL:", e);
  }

  const handleAdd = async () => {
    const portNum = Number(port);
    if (!host.trim() || Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return;
    }
    setAdding(true);
    try {
      await commands
        .addLocalRoute({
          domainId,
          targetHost: host.trim(),
          targetPort: portNum,
        })
        .then(unwrap);
      await notifyHubDataChanged("routes");
      onAdded();
      onClose();
    } catch (e) {
      console.error("add_local_route:", e);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <Modal.Header title={t.proxyRouteModalTitle} description={t.proxyRouteModalDesc(domainHost)} />
      <Modal.Body className="space-y-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="proxy-route-host" className="block text-xs font-bold text-base-content/50 ml-1">
            {t.proxyRouteTargetHost}
          </label>
          <Input
            id="proxy-route-host"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="localhost"
            className="w-full rounded-2xl h-11 px-4 shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="proxy-route-port" className="block text-xs font-bold text-base-content/50 ml-1">
            {t.proxyRouteTargetPort}
          </label>
          <Input
            id="proxy-route-port"
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="3000"
            className="w-full rounded-2xl h-11 px-4 shadow-sm"
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={adding} className="px-6 rounded-xl">
          {t.proxyRouteCancel}
        </Button>
        <Button onClick={handleAdd} disabled={adding} className="px-8 rounded-xl shadow-lg shadow-primary/20">
          {adding ? t.proxyRouteAdding : t.proxyRouteAdd}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

import { Check, Globe, Layers, Loader2, Server, Shield, Sparkles, Trash2, Zap } from "lucide-react";
import type { DomainGroup } from "@/entities/domain-group";
import type { LocalRoute } from "@/shared/api";
import { toastError, toastSuccess } from "@/shared/ui/toast";
import { type DuplicateGroup, type DuplicateMergePolicy, executeDuplicateMerge } from "../store";
import type { DomainFeatureState } from "./types";

interface DuplicateDomainsMergeModalProps {
  groups: DuplicateGroup[];
  allGroups: DomainGroup[];
  getGroupId: (domainId: number) => number | null;
  getFeatureState: (domainId: number) => DomainFeatureState;
  localRoutes: LocalRoute[];
  lang?: "ko" | "en";
  onClose: () => void;
  onMerged?: () => void;
}

export function DuplicateDomainsMergeModal({
  groups,
  allGroups,
  getGroupId,
  getFeatureState,
  localRoutes,
  lang = "ko",
  onClose,
  onMerged,
}: DuplicateDomainsMergeModalProps) {
  const [policy, setPolicy] = useState<DuplicateMergePolicy>("merge_smart");
  const [primaryMap, setPrimaryMap] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const g of groups) {
      init[g.normalizedUrl] = g.suggestedPrimaryId;
    }
    return init;
  });
  const [merging, setMerging] = useState(false);

  const totalDuplicates = groups.reduce((acc, g) => acc + (g.domains.length - 1), 0);

  const groupNameMap = useMemo(() => {
    return new Map(allGroups.map((g) => [g.id, g.name]));
  }, [allGroups]);

  const proxyRouteMap = useMemo(() => {
    const map = new Map<number, { host: string; port: number }>();
    for (const r of localRoutes) {
      if (r.domain_id != null) {
        map.set(r.domain_id as number, { host: r.target_host, port: r.target_port });
      }
    }
    return map;
  }, [localRoutes]);

  const handleExecute = async () => {
    setMerging(true);
    try {
      const res = await executeDuplicateMerge(groups, policy, primaryMap);
      toastSuccess(
        lang === "ko"
          ? `${res.mergedGroupCount}개 도메인 그룹 병합 완료 (중복 ${res.deletedDomainCount}개 정리됨)`
          : `Merged ${res.mergedGroupCount} domain group(s) (Removed ${res.deletedDomainCount} duplicate(s)).`,
      );
      onMerged?.();
      onClose();
    } catch (e: unknown) {
      console.error("executeDuplicateMerge error:", e);
      const errMsg = (e as { message?: string })?.message;
      toastError(lang === "ko" ? `병합 실패: ${errMsg || "오류 발생"}` : `Merge failed: ${errMsg || "Unknown error"}`);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <Modal.Header
        title={lang === "ko" ? "중복 도메인 감지 및 병합 정책 설정" : "Duplicate Domains Detected & Merge Policy"}
        description={
          lang === "ko"
            ? `총 ${groups.length}개 URL에서 ${totalDuplicates}개의 중복 항목이 감지되었습니다. 연관 설정(그룹/프록시 라우트)을 자동 이전하며 병합합니다.`
            : `Detected ${totalDuplicates} duplicate item(s) across ${groups.length} URL group(s). Consolidate settings seamlessly.`
        }
      />
      <Modal.Body className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        {/* Policy Selector Cards */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-base-content/60 ml-0.5 uppercase tracking-wider">
            {lang === "ko" ? "1. 병합 정책 선택" : "1. Select Merge Policy"}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Merge Smart */}
            <button
              type="button"
              onClick={() => setPolicy("merge_smart")}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                policy === "merge_smart"
                  ? "border-primary bg-primary/10 text-base-content ring-1 ring-primary"
                  : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  {lang === "ko" ? "스마트 통합" : "Smart Merge"}
                </span>
                {policy === "merge_smart" && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>
              <p className="text-[10px] text-base-content/50 leading-tight">
                {lang === "ko"
                  ? "대표 도메인으로 그룹/프록시 설정을 안전하게 이전 후 중복 제거"
                  : "Safely reassigns group/proxy links to primary domain."}
              </p>
            </button>

            {/* Keep Latest */}
            <button
              type="button"
              onClick={() => setPolicy("keep_latest")}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                policy === "keep_latest"
                  ? "border-primary bg-primary/10 text-base-content ring-1 ring-primary"
                  : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  {lang === "ko" ? "최신 항목 유지" : "Keep Latest"}
                </span>
                {policy === "keep_latest" && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>
              <p className="text-[10px] text-base-content/50 leading-tight">
                {lang === "ko"
                  ? "가장 최근 생성된 도메인 ID를 우선 대표로 보존"
                  : "Preserves the most recently created domain ID."}
              </p>
            </button>

            {/* Keep Oldest */}
            <button
              type="button"
              onClick={() => setPolicy("keep_oldest")}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                policy === "keep_oldest"
                  ? "border-primary bg-primary/10 text-base-content ring-1 ring-primary"
                  : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-500" />
                  {lang === "ko" ? "최초 항목 유지" : "Keep Oldest"}
                </span>
                {policy === "keep_oldest" && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>
              <p className="text-[10px] text-base-content/50 leading-tight">
                {lang === "ko"
                  ? "가장 먼저 생성된 도메인 ID를 원조 대표로 보존"
                  : "Preserves the oldest original domain ID."}
              </p>
            </button>
          </div>
        </div>

        {/* Duplicate Domain Groups Comparison List */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-base-content/60 ml-0.5 uppercase tracking-wider">
            {lang === "ko"
              ? "2. URL별 설정 상세 비교 및 대표 선택"
              : "2. Domain Settings Comparison & Primary Selection"}
          </span>

          <div className="flex flex-col gap-2.5">
            {groups.map((g) => {
              const currentPrimaryId = primaryMap[g.normalizedUrl] ?? g.suggestedPrimaryId;
              return (
                <div
                  key={g.normalizedUrl}
                  className="p-3 bg-base-200/30 border border-base-200 rounded-xl flex flex-col gap-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-base-200 pb-2">
                    <span className="font-mono text-xs font-bold text-base-content flex items-center gap-1.5 truncate">
                      <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                      {g.displayUrl}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                      {g.domains.length} {lang === "ko" ? "개 중복" : "duplicates"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.domains.map((d) => {
                      const isSelected = currentPrimaryId === d.id;
                      const gid = getGroupId(d.id);
                      const gName = gid ? groupNameMap.get(gid) : null;
                      const featState = getFeatureState(d.id);
                      const routeInfo = proxyRouteMap.get(d.id);

                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() =>
                            setPrimaryMap((prev) => ({
                              ...prev,
                              [g.normalizedUrl]: d.id,
                            }))
                          }
                          className={`p-2.5 rounded-lg border text-left flex flex-col gap-2 transition-all ${
                            isSelected
                              ? "bg-primary/10 border-primary ring-1 ring-primary shadow-sm"
                              : "bg-base-100 border-base-200 hover:border-base-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-base-content flex items-center gap-1">
                              ID #{d.id}
                            </span>
                            {isSelected ? (
                              <span className="px-1.5 py-0.5 rounded bg-primary text-primary-content text-[9px] font-bold flex items-center gap-0.5">
                                <Check className="w-2.5 h-2.5" />
                                {lang === "ko" ? "대표 선택됨" : "Primary"}
                              </span>
                            ) : (
                              <span className="text-[10px] text-base-content/40 hover:text-primary">
                                {lang === "ko" ? "대표로 지정" : "Select"}
                              </span>
                            )}
                          </div>

                          {/* Domain Details & Feature Badges */}
                          <div className="flex flex-wrap gap-1">
                            {gName ? (
                              <span className="px-1.5 py-0.5 rounded bg-base-200 text-base-content/80 text-[10px] font-medium flex items-center gap-1">
                                📁 {gName}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-base-200/50 text-base-content/40 text-[10px]">
                                {lang === "ko" ? "그룹 없음" : "No Group"}
                              </span>
                            )}

                            {featState.proxyEnabled && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium flex items-center gap-0.5 border border-emerald-500/20">
                                <Server className="w-2.5 h-2.5" />
                                {routeInfo ? `${routeInfo.host}:${routeInfo.port}` : "Proxy"}
                              </span>
                            )}

                            {featState.monitorEnabled && (
                              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium flex items-center gap-0.5 border border-primary/20">
                                <Shield className="w-2.5 h-2.5" />
                                Monitor
                              </span>
                            )}

                            {featState.apiLoggingEnabled && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-medium flex items-center gap-0.5 border border-purple-500/20">
                                API Logs
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={merging} className="px-5 rounded-lg">
          {lang === "ko" ? "취소" : "Cancel"}
        </Button>
        <Button
          onClick={handleExecute}
          disabled={merging}
          className="px-6 rounded-lg shadow-md shadow-primary/20 gap-1.5"
        >
          {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {lang === "ko" ? "중복 정리 & 병합 실행" : "Execute Merge & Clean"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
