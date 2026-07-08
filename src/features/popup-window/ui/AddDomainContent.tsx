import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";
import { languageAtom, usePromiseModal } from "@/entities/app";
import { useDomainHubData } from "@/entities/domain-hub";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { Button } from "@/shared/ui/button/Button";
import { Textarea } from "@/shared/ui/textarea/Textarea";
import { popupEn } from "../i18n/en";
import { popupKo } from "../i18n/ko";

export function AddDomainContent() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;
  const { fetchAll, groups } = useDomainHubData();
  const { alert: showAlert } = usePromiseModal();
  const [urls, setUrls] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

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
      await getCurrentWindow().close();
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
  }, [urls, groupId, fetchAll]);

  return (
    <div className="space-y-4">
      <Textarea
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        placeholder={t.addDomainPlaceholder}
        rows={6}
        className="font-mono text-xs"
      />
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
        <Button variant="secondary" className="flex-1" onClick={() => getCurrentWindow().close()} disabled={loading}>
          {t.addDomainCancel}
        </Button>
        <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={loading || !urls.trim()}>
          {t.addDomainSubmit}
        </Button>
      </div>
    </div>
  );
}
