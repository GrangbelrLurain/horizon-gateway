import { useState } from "react";
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

/* -------------------------------------------------------------------------- */
/*                        DuplicateDomainsMergeModal                          */
/* -------------------------------------------------------------------------- */

import { Check, Layers, Loader2, Sparkles, Trash2, Zap } from "lucide-react";
import { toastError, toastSuccess } from "@/shared/ui/toast";
import { type DuplicateGroup, type DuplicateMergePolicy, executeDuplicateMerge } from "../store";

interface DuplicateDomainsMergeModalProps {
  groups: DuplicateGroup[];
  lang?: "ko" | "en";
  onClose: () => void;
  onMerged?: () => void;
}

export function DuplicateDomainsMergeModal({
  groups,
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
        title={lang === "ko" ? "⚡ 중복 도메인 감지 및 병합 정책 설정" : "⚡ Duplicate Domains Detected & Merge Policy"}
        description={
          lang === "ko"
            ? `총 ${groups.length}개 URL에서 ${totalDuplicates}개의 중복 항목이 감지되었습니다. 연관 설정(그룹/프록시 라우트)을 자동 이전하며 병합합니다.`
            : `Detected ${totalDuplicates} duplicate item(s) across ${groups.length} URL group(s). Consolidate settings seamlessly.`
        }
      />
      <Modal.Body className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        {/* Policy Selector Cards */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-base-content/60 ml-1 uppercase tracking-wider">
            {lang === "ko" ? "1. 병합 정책 선택" : "1. Select Merge Policy"}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Merge Smart */}
            <button
              type="button"
              onClick={() => setPolicy("merge_smart")}
              className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                policy === "merge_smart"
                  ? "border-primary bg-primary/10 text-base-content ring-1 ring-primary"
                  : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1">
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
              className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                policy === "keep_latest"
                  ? "border-primary bg-primary/10 text-base-content ring-1 ring-primary"
                  : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1">
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
              className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                policy === "keep_oldest"
                  ? "border-primary bg-primary/10 text-base-content ring-1 ring-primary"
                  : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1">
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

        {/* Duplicate Domain Groups List */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-base-content/60 ml-1 uppercase tracking-wider">
            {lang === "ko" ? "2. URL별 대표 도메인 설정" : "2. Set Primary Domain per URL"}
          </span>

          <div className="flex flex-col gap-2">
            {groups.map((g) => {
              const currentPrimaryId = primaryMap[g.normalizedUrl] ?? g.suggestedPrimaryId;
              return (
                <div
                  key={g.normalizedUrl}
                  className="p-3 bg-base-200/40 border border-base-200 rounded-2xl flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-base-content truncate">{g.displayUrl}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {g.domains.length} {lang === "ko" ? "개 중복" : "duplicates"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-base-content/40 mr-1">
                      {lang === "ko" ? "대표 선택:" : "Primary:"}
                    </span>
                    {g.domains.map((d) => {
                      const isSelected = currentPrimaryId === d.id;
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
                          className={`px-2.5 py-1 rounded-xl text-xs font-mono font-medium border transition-all flex items-center gap-1 ${
                            isSelected
                              ? "bg-primary text-primary-content border-primary shadow-sm"
                              : "bg-base-100 text-base-content/70 border-base-300 hover:border-base-400"
                          }`}
                        >
                          ID #{d.id}
                          {isSelected && <Check className="w-3 h-3" />}
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
        <Button variant="secondary" onClick={onClose} disabled={merging} className="px-6 rounded-xl">
          {lang === "ko" ? "취소" : "Cancel"}
        </Button>
        <Button
          onClick={handleExecute}
          disabled={merging}
          className="px-8 rounded-xl shadow-lg shadow-primary/20 gap-1.5"
        >
          {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {lang === "ko" ? "중복 정리 & 병합 실행" : "Execute Merge & Clean"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
