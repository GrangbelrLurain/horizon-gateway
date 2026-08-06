import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAtomValue } from "jotai";
import { AlertTriangle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { languageAtom, usePromiseModal } from "@/entities/app";
import { normalizeDomainUrl } from "@/entities/domain";
import { useDomainHubData } from "@/entities/domain-hub";
import { commands, unwrap } from "@/shared/api";
import { useHubSurfaceDismiss, useIsHubSurfaceEmbed } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { Button } from "@/shared/ui/button/Button";
import { Textarea } from "@/shared/ui/textarea/Textarea";
import { popupEn } from "../i18n/en";
import { popupKo } from "../i18n/ko";

export function AddDomainContent() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;
  const { fetchAll, groups, domains } = useDomainHubData();
  const { alert: showAlert } = usePromiseModal();
  const [urls, setUrls] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const isHubEmbed = useIsHubSurfaceEmbed();
  const dismissHubSurface = useHubSurfaceDismiss();

  const existingUrlsSet = useMemo(() => new Set(domains.map((d) => normalizeDomainUrl(d.url))), [domains]);

  const duplicateInputs = useMemo(() => {
    const list = urls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    return list.filter((u) => existingUrlsSet.has(normalizeDomainUrl(u)));
  }, [urls, existingUrlsSet]);

  const dismiss = useCallback(async () => {
    if (isHubEmbed && dismissHubSurface) {
      dismissHubSurface();
      return;
    }
    await getCurrentWindow().close();
  }, [dismissHubSurface, isHubEmbed]);

  const handleSubmit = useCallback(async () => {
    const list = urls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (list.length === 0) {
      return;
    }
    setLoading(true);
    try {
      await commands.registDomains({ urls: list, groupId }).then(unwrap);
      await fetchAll();
      await notifyHubDataChanged("domains");
      setUrls("");
      await dismiss();
    } catch (e) {
      console.error(e);
      await showAlert(
        lang === "ko" ? "오류" : "Error",
        lang === "ko" ? "도메인 등록에 실패했습니다" : "Failed to register domains",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [urls, groupId, fetchAll, dismiss, lang, showAlert]);

  return (
    <div className="space-y-4">
      <Textarea
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        placeholder={t.addDomainPlaceholder}
        rows={6}
        className="font-mono text-xs"
      />
      {duplicateInputs.length > 0 && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>
            {lang === "ko"
              ? `입력하신 도메인 중 ${duplicateInputs.length}개가 이미 등록되어 있습니다. 등록 시 자동 업데이트됩니다.`
              : `${duplicateInputs.length} domain(s) already exist. They will be updated automatically.`}
          </span>
        </div>
      )}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase text-base-content/60">{t.addDomainGroup}</label>
        <select
          value={groupId ?? ""}
          onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
          className="select select-bordered w-full h-9 text-xs bg-base-100 border-base-300 text-base-content"
        >
          <option value="">{t.addDomainNoGroup}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" className="flex-1" onClick={() => void dismiss()} disabled={loading}>
          {t.addDomainCancel}
        </Button>
        <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={loading || !urls.trim()}>
          {t.addDomainSubmit}
        </Button>
      </div>
    </div>
  );
}
