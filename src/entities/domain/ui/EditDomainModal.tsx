import clsx from "clsx";
import { Check, Folder } from "lucide-react";
import { useEffect, useState } from "react";
import type { Domain } from "@/entities/domain";
import type { DomainGroup } from "@/entities/domain-group";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { Modal } from "@/shared/ui/modal/Modal";

export interface EditDomainModalTranslations {
  title: string;
  desc: string;
  urlLabel: string;
  groupLabel: string;
  save: string;
  noGroup: string;
  empty: string;
  cancel: string;
}

export interface EditDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: Domain | null;
  groups: DomainGroup[];
  selectedGroupIds: number[];
  onSave: (domain: Domain, updates: { url?: string; groupId?: number | null }) => void;
  translations: EditDomainModalTranslations;
}

export function EditDomainModal({
  isOpen,
  onClose,
  domain,
  groups,
  selectedGroupIds,
  onSave,
  translations,
}: EditDomainModalProps) {
  const [urlInput, setUrlInput] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && domain) {
      setUrlInput(domain.url);
      setSelectedGroupId(selectedGroupIds[0] ?? null);
    }
  }, [isOpen, domain, selectedGroupIds]);

  const handleSave = () => {
    if (!domain) {
      return;
    }
    const urlTrimmed = urlInput.trim();
    const urlChanged = urlTrimmed !== domain.url;
    const groupChanged = selectedGroupId !== (selectedGroupIds[0] ?? null);
    if (urlChanged || groupChanged) {
      onSave(domain, {
        ...(urlChanged ? { url: urlTrimmed } : {}),
        ...(groupChanged ? { groupId: selectedGroupId } : {}),
      });
    }
    onClose();
  };

  const urlChanged = domain && urlInput.trim() !== domain.url;
  const groupChanged = domain && selectedGroupId !== (selectedGroupIds[0] ?? null);
  const canSave = Boolean(domain && (urlChanged || groupChanged));

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <Modal.Header title={translations.title} description={domain ? translations.desc : undefined} />
      <Modal.Body className="space-y-6">
        {domain && (
          <>
            <div>
              <label
                htmlFor="edit-domain-url"
                className="block text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1 mb-2"
              >
                {translations.urlLabel}
              </label>
              <Input
                id="edit-domain-url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-2xl h-12 bg-base-200 border-base-300 focus:bg-base-100 font-bold tracking-tight shadow-inner"
              />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1 mb-3">
                {translations.groupLabel}
              </span>
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() => setSelectedGroupId(null)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left hover:bg-base-200 transition-all group"
                  >
                    <span className={selectedGroupId === null ? "text-primary" : "text-base-content/20"}>
                      {selectedGroupId === null ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span className="w-4 h-4 inline-block" />
                      )}
                    </span>
                    <span
                      className={clsx(
                        "text-sm font-bold tracking-tight",
                        selectedGroupId === null
                          ? "text-primary"
                          : "text-base-content/60 group-hover:text-base-content",
                      )}
                    >
                      {translations.noGroup}
                    </span>
                  </button>
                </li>
                {groups.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedGroupId(g.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left hover:bg-base-200 transition-all group"
                    >
                      <span className={selectedGroupId === g.id ? "text-primary" : "text-base-content/20"}>
                        {selectedGroupId === g.id ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="w-4 h-4 inline-block" />
                        )}
                      </span>
                      <Folder
                        className={clsx(
                          "w-4 h-4 transition-colors",
                          selectedGroupId === g.id
                            ? "text-primary"
                            : "text-base-content/30 group-hover:text-base-content/50",
                        )}
                      />
                      <span
                        className={clsx(
                          "text-sm font-bold tracking-tight",
                          selectedGroupId === g.id
                            ? "text-primary"
                            : "text-base-content/60 group-hover:text-base-content",
                        )}
                      >
                        {g.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {groups.length === 0 && (
                <p className="text-sm text-base-content/30 font-bold italic py-2 pl-4">{translations.empty}</p>
              )}
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} className="font-bold">
          {translations.cancel}
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!canSave}
          className="px-8 font-black uppercase tracking-widest shadow-lg shadow-primary/20"
        >
          {translations.save}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
