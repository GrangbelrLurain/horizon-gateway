import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { languageAtom, usePromiseModal } from "@/entities/app";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { Modal } from "@/shared/ui/modal/Modal";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";

interface DomainEditModalProps {
  domain: Domain | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DomainEditModal({ domain, onClose, onSaved }: DomainEditModalProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const { alert: showAlert } = usePromiseModal();
  const { groups, getGroupId } = useDomainHubData();
  const [url, setUrl] = useState(domain?.url ?? "");
  const [groupId, setGroupId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (domain) {
      setUrl(domain.url);
      const gid = getGroupId(domain.id);
      setGroupId(gid ?? "");
    }
  }, [domain, getGroupId]);

  const handleSave = async () => {
    if (!domain || !url.trim()) {
      return;
    }
    setSaving(true);
    try {
      await commands.updateDomainById({ id: domain.id, url: url.trim() }).then(unwrap);
      await commands
        .setDomainGroups({
          domainId: domain.id,
          groupIds: groupId === "" ? [] : [groupId],
        })
        .then(unwrap);
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      await showAlert(t.errorGeneric, t.saveFailed, "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={domain !== null} onClose={onClose}>
      <Modal.Header title={t.domainEditTitle} description={t.domainEditDesc} />
      <Modal.Body className="space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase text-base-content/50">{t.domainEditUrl}</label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1.5 h-9 text-xs font-mono" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-base-content/50">{t.domainEditGroup}</label>
          <select
            className="mt-1.5 w-full h-9 rounded-lg border border-base-300 bg-base-100 px-3 text-xs"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">{t.domainEditNoGroup}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
          {t.domainEditCancel}
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !url.trim()}>
          {saving ? t.domainEditSaving : t.domainEditSave}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
