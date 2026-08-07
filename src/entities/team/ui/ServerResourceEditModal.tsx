import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { Modal } from "@/shared/ui/modal/Modal";
import { formatDomainDisplayUrl } from "../syncDiff";
import type { ResourceKind } from "../types";

export type ServerResourceEditMode = "create" | "edit";

export interface ServerResourceOption {
  id: string | number;
  label: string;
}

interface ServerResourceEditModalProps {
  lang: "ko" | "en";
  kind: ResourceKind;
  mode: ServerResourceEditMode | null;
  initial?: Record<string, unknown> | null;
  /** Domain options for group-link editor (server domains preferred). */
  domainOptions?: ServerResourceOption[];
  /** Group options for group-link editor (server groups preferred). */
  groupOptions?: ServerResourceOption[];
  busy?: boolean;
  onClose: () => void;
  onSave: (item: Record<string, unknown>, options?: { replaceId?: string | number }) => Promise<boolean>;
}

const MANAGEABLE_KINDS: ResourceKind[] = ["domains", "mock_rules", "groups", "scenarios", "domain_group_links"];

export function canEditServerKind(kind: ResourceKind): boolean {
  return MANAGEABLE_KINDS.includes(kind);
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;

export function ServerResourceEditModal({
  lang,
  kind,
  mode,
  initial,
  domainOptions = [],
  groupOptions = [],
  busy,
  onClose,
  onSave,
}: ServerResourceEditModalProps) {
  const [domainUrl, setDomainUrl] = useState("");
  const [domainEnabled, setDomainEnabled] = useState(true);

  const [mockName, setMockName] = useState("");
  const [mockHost, setMockHost] = useState("");
  const [mockMethod, setMockMethod] = useState<string>("GET");
  const [mockPattern, setMockPattern] = useState("");
  const [mockStatus, setMockStatus] = useState("200");
  const [mockBody, setMockBody] = useState("");
  const [mockEnabled, setMockEnabled] = useState(true);

  const [groupName, setGroupName] = useState("");

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [scenarioEnabled, setScenarioEnabled] = useState(true);

  const [linkDomainId, setLinkDomainId] = useState("");
  const [linkGroupId, setLinkGroupId] = useState("");
  const [originalLinkRef, setOriginalLinkRef] = useState<string | null>(null);

  const sortedDomains = useMemo(
    () => [...domainOptions].sort((a, b) => a.label.localeCompare(b.label)),
    [domainOptions],
  );
  const sortedGroups = useMemo(() => [...groupOptions].sort((a, b) => a.label.localeCompare(b.label)), [groupOptions]);

  useEffect(() => {
    if (!mode) {
      return;
    }
    const src = initial ?? {};
    if (kind === "domains") {
      setDomainUrl(String(src.url ?? "").replace(/^https?:\/\//i, ""));
      setDomainEnabled(src.enabled !== false);
    } else if (kind === "mock_rules") {
      setMockName(String(src.name ?? ""));
      setMockHost(src.host == null ? "" : String(src.host));
      setMockMethod(String(src.method ?? "GET").toUpperCase());
      setMockPattern(String(src.url_pattern ?? ""));
      setMockStatus(String(src.response_status ?? 200));
      setMockBody(src.response_body == null ? "" : String(src.response_body));
      setMockEnabled(src.enabled !== false);
    } else if (kind === "groups") {
      setGroupName(String(src.name ?? ""));
    } else if (kind === "scenarios") {
      setScenarioName(String(src.name ?? ""));
      setScenarioDescription(src.description == null ? "" : String(src.description));
      setScenarioEnabled(src.enabled !== false);
    } else if (kind === "domain_group_links") {
      const domainId = src.domain_id != null ? String(src.domain_id) : "";
      const groupId = src.group_id != null ? String(src.group_id) : "";
      setLinkDomainId(domainId);
      setLinkGroupId(groupId);
      setOriginalLinkRef(mode === "edit" && domainId && groupId ? `${domainId}:${groupId}` : null);
    }
  }, [mode, kind, initial]);

  if (!mode || !canEditServerKind(kind)) {
    return null;
  }

  const isCreate = mode === "create";
  const title =
    lang === "ko" ? (isCreate ? "서버에 추가" : "서버 항목 수정") : isCreate ? "Add to server" : "Edit server item";

  const buildPayload = (): { item: Record<string, unknown>; replaceId?: string | number } | null => {
    if (kind === "domains") {
      const url = domainUrl.trim().replace(/^https?:\/\//i, "");
      if (!url) {
        return null;
      }
      return {
        item: {
          ...(initial ?? {}),
          id: initial?.id ?? Date.now(),
          url,
          enabled: domainEnabled,
        },
      };
    }
    if (kind === "mock_rules") {
      const name = mockName.trim();
      const pattern = mockPattern.trim();
      if (!name || !pattern) {
        return null;
      }
      const status = Number(mockStatus);
      return {
        item: {
          ...(initial ?? {}),
          id: initial?.id ?? crypto.randomUUID(),
          name,
          host: mockHost.trim() || null,
          method: mockMethod || "GET",
          url_pattern: pattern,
          response_status: Number.isFinite(status) ? status : 200,
          response_headers: (initial?.response_headers as Record<string, string>) ?? {},
          response_body: mockBody.trim() ? mockBody : null,
          enabled: mockEnabled,
          scenario_id: initial?.scenario_id ?? null,
        },
      };
    }
    if (kind === "groups") {
      const name = groupName.trim();
      if (!name) {
        return null;
      }
      return {
        item: {
          ...(initial ?? {}),
          id: initial?.id ?? Date.now(),
          name,
        },
      };
    }
    if (kind === "scenarios") {
      const name = scenarioName.trim();
      if (!name) {
        return null;
      }
      return {
        item: {
          ...(initial ?? {}),
          id: initial?.id ?? crypto.randomUUID(),
          name,
          description: scenarioDescription.trim() || null,
          enabled: scenarioEnabled,
        },
      };
    }
    if (kind === "domain_group_links") {
      if (!linkDomainId || !linkGroupId) {
        return null;
      }
      const domainId = Number(linkDomainId);
      const groupId = Number(linkGroupId);
      if (!Number.isFinite(domainId) || !Number.isFinite(groupId)) {
        return null;
      }
      const nextRef = `${domainId}:${groupId}`;
      return {
        item: { domain_id: domainId, group_id: groupId },
        replaceId: originalLinkRef && originalLinkRef !== nextRef ? originalLinkRef : undefined,
      };
    }
    return null;
  };

  const submit = async () => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    const ok = await onSave(payload.item, payload.replaceId != null ? { replaceId: payload.replaceId } : undefined);
    if (ok) {
      onClose();
    }
  };

  const canSave = buildPayload() != null;
  const linkOptionsReady = sortedDomains.length > 0 && sortedGroups.length > 0;

  return (
    <Modal isOpen={mode !== null} onClose={busy ? () => undefined : onClose} size="md">
      <Modal.Header title={title} description={lang === "ko" ? "워크스페이스 서버 데이터" : "Workspace server data"} />
      <Modal.Body className="pt-2 pb-4 flex flex-col gap-3">
        {kind === "domains" && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
                {lang === "ko" ? "도메인 (스킴 없이)" : "Domain (no scheme)"}
              </span>
              <Input
                value={domainUrl}
                onChange={(e) => setDomainUrl(e.target.value)}
                placeholder="api.example.com"
                disabled={busy}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                className="checkbox checkbox-xs checkbox-primary"
                checked={domainEnabled}
                onChange={(e) => setDomainEnabled(e.target.checked)}
                disabled={busy}
              />
              enabled
            </label>
          </>
        )}

        {kind === "mock_rules" && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">Name</span>
              <Input value={mockName} onChange={(e) => setMockName(e.target.value)} disabled={busy} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
                  Method
                </span>
                <select
                  className="select select-bordered select-sm"
                  value={mockMethod}
                  onChange={(e) => setMockMethod(e.target.value)}
                  disabled={busy}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
                  Status
                </span>
                <Input value={mockStatus} onChange={(e) => setMockStatus(e.target.value)} disabled={busy} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">Host</span>
              <Input
                value={mockHost}
                onChange={(e) => setMockHost(e.target.value)}
                placeholder="optional"
                disabled={busy}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
                URL pattern
              </span>
              <Input
                value={mockPattern}
                onChange={(e) => setMockPattern(e.target.value)}
                placeholder="/api/*"
                disabled={busy}
                className="font-mono"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
                Response body
              </span>
              <textarea
                className="textarea textarea-bordered textarea-sm font-mono min-h-[100px]"
                value={mockBody}
                onChange={(e) => setMockBody(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                className="checkbox checkbox-xs checkbox-primary"
                checked={mockEnabled}
                onChange={(e) => setMockEnabled(e.target.checked)}
                disabled={busy}
              />
              enabled
            </label>
          </>
        )}

        {kind === "groups" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
              {lang === "ko" ? "그룹 이름" : "Group name"}
            </span>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} disabled={busy} />
          </label>
        )}

        {kind === "scenarios" && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
                {lang === "ko" ? "시나리오 이름" : "Scenario name"}
              </span>
              <Input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} disabled={busy} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
                {lang === "ko" ? "설명" : "Description"}
              </span>
              <Input
                value={scenarioDescription}
                onChange={(e) => setScenarioDescription(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                className="checkbox checkbox-xs checkbox-primary"
                checked={scenarioEnabled}
                onChange={(e) => setScenarioEnabled(e.target.checked)}
                disabled={busy}
              />
              enabled
            </label>
          </>
        )}

        {kind === "domain_group_links" && (
          <>
            {!linkOptionsReady ? (
              <p className="text-xs text-base-content/55 leading-relaxed">
                {lang === "ko"
                  ? "서버에 도메인과 그룹이 있어야 연결을 추가할 수 있습니다. 먼저 도메인·그룹을 Push하거나 서버에 추가하세요."
                  : "Server needs domains and groups before links can be added. Push or create them first."}
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
                    {lang === "ko" ? "도메인" : "Domain"}
                  </span>
                  <select
                    className="select select-bordered select-sm font-mono"
                    value={linkDomainId}
                    onChange={(e) => setLinkDomainId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">{lang === "ko" ? "선택…" : "Select…"}</option>
                    {sortedDomains.map((d) => (
                      <option key={String(d.id)} value={String(d.id)}>
                        {formatDomainDisplayUrl(d.label)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
                    {lang === "ko" ? "그룹" : "Group"}
                  </span>
                  <select
                    className="select select-bordered select-sm"
                    value={linkGroupId}
                    onChange={(e) => setLinkGroupId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">{lang === "ko" ? "선택…" : "Select…"}</option>
                    {sortedGroups.map((g) => (
                      <option key={String(g.id)} value={String(g.id)}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
          {lang === "ko" ? "취소" : "Cancel"}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void submit()}
          disabled={busy || !canSave || (kind === "domain_group_links" && !linkOptionsReady)}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : lang === "ko" ? "저장" : "Save"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
