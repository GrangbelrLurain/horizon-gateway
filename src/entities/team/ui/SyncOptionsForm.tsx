import { AlertTriangle, Check, CloudDownload, CloudUpload, Fingerprint, Globe, Loader2, Plus } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/ui/button/Button";
import {
  buildPushSyncPreview,
  DEFAULT_SYNC_KINDS,
  DEFAULT_SYNC_OPTIONS,
  type DomainMatchKey,
  type PushDomainPreviewItem,
  type SyncMode,
  type SyncOverlapPolicy,
  type WorkspaceSyncOptions,
} from "../sync";
import type { ResourceKind } from "../types";

export interface SyncOptionsFormProps {
  action: "push" | "pull";
  workspaceId: string;
  lang: "ko" | "en";
  busy?: boolean;
  onConfirm: (options: WorkspaceSyncOptions) => void;
  onCancel?: () => void;
}

const KIND_LABELS: Record<ResourceKind, { ko: string; en: string }> = {
  domains: { ko: "도메인", en: "Domains" },
  groups: { ko: "그룹", en: "Groups" },
  domain_group_links: { ko: "그룹 연결", en: "Group links" },
  scenarios: { ko: "시나리오", en: "Scenarios" },
  mock_rules: { ko: "Mock 규칙", en: "Mock rules" },
};

const MATCH_OPTIONS: { key: DomainMatchKey; ko: string; en: string; descKo: string; descEn: string }[] = [
  {
    key: "hostname",
    ko: "호스트명",
    en: "Hostname",
    descKo: "스킴·경로·기본 포트 무시 (api.example.com)",
    descEn: "Ignore scheme/path/default port",
  },
  {
    key: "host_port",
    ko: "호스트 + 포트",
    en: "Host + port",
    descKo: "비기본 포트까지 구분 (api.example.com:8080)",
    descEn: "Treat non-default ports as distinct",
  },
  {
    key: "exact_url",
    ko: "전체 URL",
    en: "Exact URL",
    descKo: "문자열 전체 일치 (대소문자·슬래시 정규화)",
    descEn: "Full URL string match",
  },
];

function ModeCard({
  active,
  danger,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  danger?: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
        active
          ? danger
            ? "border-amber-500 bg-amber-500/10 text-base-content ring-1 ring-amber-500"
            : "border-primary bg-primary/10 text-base-content ring-1 ring-primary"
          : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-bold flex items-center gap-1.5 ${
            danger ? "text-amber-600 dark:text-amber-400" : ""
          }`}
        >
          {icon}
          {title}
        </span>
        {active && <Check className={`w-4 h-4 ${danger ? "text-amber-500" : "text-primary"}`} />}
      </div>
      <p className="text-[10px] text-base-content/50 leading-normal">{description}</p>
    </button>
  );
}

/** Inline sync options body used by SyncPanel (and legacy modal wrapper). */
export function SyncOptionsForm({ action, workspaceId, lang, busy, onConfirm, onCancel }: SyncOptionsFormProps) {
  const [mode, setMode] = useState<SyncMode>(DEFAULT_SYNC_OPTIONS.mode);
  const [matchKey, setMatchKey] = useState<DomainMatchKey>(DEFAULT_SYNC_OPTIONS.matchKey);
  const [overlapPolicy, setOverlapPolicy] = useState<SyncOverlapPolicy>(DEFAULT_SYNC_OPTIONS.overlapPolicy);
  const [kinds, setKinds] = useState<ResourceKind[]>([...DEFAULT_SYNC_KINDS]);
  const [preview, setPreview] = useState<PushDomainPreviewItem[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<number>>(new Set());

  const isPush = action === "push";

  useEffect(() => {
    if (!isPush || !kinds.includes("domains")) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    buildPushSyncPreview(workspaceId, { mode, matchKey, overlapPolicy, kinds })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setPreview(result.domains);
        const eligible = result.domains.filter((d) => d.kind === "add" || d.kind === "update").map((d) => d.localId);
        setSelectedDomainIds(new Set(eligible));
      })
      .catch((e) => {
        console.warn("SyncOptionsForm preview:", e);
        if (!cancelled) {
          setPreview([]);
          setSelectedDomainIds(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isPush, workspaceId, mode, matchKey, overlapPolicy, kinds]);

  const selectablePreview = useMemo(
    () => (preview ?? []).filter((d) => d.kind === "add" || d.kind === "update"),
    [preview],
  );

  const toggleKind = (kind: ResourceKind) => {
    setKinds((prev) => {
      if (prev.includes(kind)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((k) => k !== kind);
      }
      return [...prev, kind];
    });
  };

  const toggleDomain = (id: number) => {
    setSelectedDomainIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const options: WorkspaceSyncOptions = {
      mode,
      matchKey,
      overlapPolicy,
      kinds,
      ...(isPush && kinds.includes("domains") ? { selectedDomainIds: [...selectedDomainIds] } : {}),
    };
    onConfirm(options);
  };

  const canConfirm =
    !busy &&
    kinds.length > 0 &&
    !(isPush && kinds.includes("domains") && selectablePreview.length > 0 && selectedDomainIds.size === 0);

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="overflow-y-auto flex flex-col gap-4 flex-1 min-h-0 pr-0.5">
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/50">
            {lang === "ko" ? "1. 동기화 모드" : "1. Sync mode"}
          </span>
          <div className="flex flex-col gap-2">
            <ModeCard
              active={mode === "merge_url"}
              icon={<Globe className="w-3.5 h-3.5 text-primary" />}
              title={lang === "ko" ? "호스트 기준 병합 (추천)" : "Merge by host (Recommended)"}
              description={
                lang === "ko"
                  ? "동일 호스트면 하나로 합치고, 아래에서 선택한 겹침 정책을 적용합니다."
                  : "Match domains by host identity and apply the overlap policy below."
              }
              onClick={() => setMode("merge_url")}
            />
            <ModeCard
              active={mode === "append_only"}
              icon={<Plus className="w-3.5 h-3.5 text-primary" />}
              title={lang === "ko" ? "신규만 추가 (Append)" : "Add new only (Append)"}
              description={
                lang === "ko"
                  ? "대상에 없는 도메인만 추가하고 기존 항목은 유지합니다."
                  : "Only add domains missing on the destination."
              }
              onClick={() => setMode("append_only")}
            />
            <ModeCard
              active={mode === "overwrite"}
              danger
              icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
              title={lang === "ko" ? "완전 덮어쓰기" : "Overwrite all"}
              description={
                isPush
                  ? lang === "ko"
                    ? "선택한 리소스를 로컬 내용으로 팀 쪽을 완전히 대체합니다."
                    : "Replace selected workspace resources with local data."
                  : lang === "ko"
                    ? "선택한 리소스를 팀 내용으로 로컬을 완전히 대체합니다."
                    : "Replace selected local resources with workspace data."
              }
              onClick={() => setMode("overwrite")}
            />
            <ModeCard
              active={mode === "merge_id"}
              icon={<Fingerprint className="w-3.5 h-3.5 text-primary" />}
              title={lang === "ko" ? "내부 ID 병합" : "Merge by internal ID"}
              description={
                lang === "ko"
                  ? "같은 기기/계정처럼 domain id가 같을 때 사용합니다."
                  : "Use when domain ids are stable across the same account/device."
              }
              onClick={() => setMode("merge_id")}
            />
          </div>
        </section>

        {(mode === "merge_url" || mode === "append_only") && (
          <section className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/50">
              {lang === "ko" ? "2. 도메인 매칭 기준" : "2. Domain match key"}
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {MATCH_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMatchKey(opt.key)}
                  className={`px-3 py-2 rounded-lg border text-left transition-all ${
                    matchKey === opt.key
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-base-200 bg-base-200/30 hover:bg-base-200/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">{lang === "ko" ? opt.ko : opt.en}</span>
                    {matchKey === opt.key && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </div>
                  <p className="text-[10px] text-base-content/50 mt-0.5">{lang === "ko" ? opt.descKo : opt.descEn}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {(mode === "merge_url" || mode === "merge_id") && (
          <section className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/50">
              {lang === "ko" ? "3. 겹치는 항목 처리" : "3. Overlap policy"}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOverlapPolicy("update_source")}
                className={`p-2.5 rounded-lg border text-left ${
                  overlapPolicy === "update_source"
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-base-200 bg-base-200/30"
                }`}
              >
                <span className="text-xs font-bold block">
                  {isPush
                    ? lang === "ko"
                      ? "로컬로 갱신"
                      : "Update with local"
                    : lang === "ko"
                      ? "팀 값으로 갱신"
                      : "Update with remote"}
                </span>
                <span className="text-[10px] text-base-content/50">
                  {lang === "ko" ? "매칭된 항목을 소스로 덮어씀" : "Overwrite matched items from source"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setOverlapPolicy("keep_target")}
                className={`p-2.5 rounded-lg border text-left ${
                  overlapPolicy === "keep_target"
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-base-200 bg-base-200/30"
                }`}
              >
                <span className="text-xs font-bold block">
                  {isPush
                    ? lang === "ko"
                      ? "팀 값 유지"
                      : "Keep remote"
                    : lang === "ko"
                      ? "로컬 값 유지"
                      : "Keep local"}
                </span>
                <span className="text-[10px] text-base-content/50">
                  {lang === "ko" ? "매칭된 항목은 그대로 둠" : "Leave matched items unchanged"}
                </span>
              </button>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/50">
            {lang === "ko" ? "동기화할 리소스" : "Resources to sync"}
          </span>
          <p className="text-[10px] text-base-content/45">
            {lang === "ko"
              ? "도메인·그룹·mock 규칙만 공유합니다. (CA·토큰·패킷 로그 제외)"
              : "Shares domains, groups, and mock rules only. (Excludes CA, tokens, logs)"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_SYNC_KINDS.map((kind) => {
              const active = kinds.includes(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-base-200 bg-base-200/40 text-base-content/50"
                  }`}
                >
                  {lang === "ko" ? KIND_LABELS[kind].ko : KIND_LABELS[kind].en}
                </button>
              );
            })}
          </div>
        </section>

        {isPush && kinds.includes("domains") && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-base-content/50">
                {lang === "ko" ? "업로드할 도메인" : "Domains to upload"}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="text-[10px] font-bold text-primary px-1.5 py-0.5 rounded hover:bg-primary/10"
                  onClick={() => setSelectedDomainIds(new Set(selectablePreview.map((d) => d.localId)))}
                >
                  {lang === "ko" ? "전체" : "All"}
                </button>
                <button
                  type="button"
                  className="text-[10px] font-bold text-base-content/50 px-1.5 py-0.5 rounded hover:bg-base-200"
                  onClick={() => setSelectedDomainIds(new Set())}
                >
                  {lang === "ko" ? "없음" : "None"}
                </button>
              </div>
            </div>

            {previewLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-base-content/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                {lang === "ko" ? "변경 미리보기 로딩…" : "Loading change preview…"}
              </div>
            ) : selectablePreview.length === 0 ? (
              <p className="text-[11px] text-base-content/45 py-3 px-2 bg-base-200/40 rounded-lg">
                {lang === "ko"
                  ? "현재 옵션으로 업로드할 도메인 변경이 없습니다."
                  : "No domain changes to upload with the current options."}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-base-200 rounded-lg divide-y divide-base-200">
                {selectablePreview.map((item) => {
                  const checked = selectedDomainIds.has(item.localId);
                  return (
                    <label
                      key={item.localId}
                      className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer hover:bg-base-200/40"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs checkbox-primary"
                        checked={checked}
                        onChange={() => toggleDomain(item.localId)}
                      />
                      <span className="flex-1 min-w-0 text-[11px] font-medium truncate">{item.url}</span>
                      <span
                        className={`text-[9px] font-black uppercase tracking-wide shrink-0 px-1.5 py-0.5 rounded ${
                          item.kind === "add"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                        }`}
                      >
                        {item.kind === "add" ? (lang === "ko" ? "추가" : "Add") : lang === "ko" ? "갱신" : "Update"}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 shrink-0 border-t border-base-200">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            {lang === "ko" ? "취소" : "Cancel"}
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!canConfirm} className="gap-1.5">
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isPush ? (
            <CloudUpload className="w-3.5 h-3.5" />
          ) : (
            <CloudDownload className="w-3.5 h-3.5" />
          )}
          {isPush ? (lang === "ko" ? "업로드 실행" : "Execute Push") : lang === "ko" ? "가져오기 실행" : "Execute Pull"}
        </Button>
      </div>
    </div>
  );
}
