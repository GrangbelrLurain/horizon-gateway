import clsx from "clsx";
import { Check, Folder } from "lucide-react";
import type { Domain } from "@/entities/domain";
import type { DomainGroup } from "@/entities/domain-group";
import { Modal } from "@/shared/ui/modal/Modal";

export interface GroupSelectModalTranslations {
  title: string;
  desc: (url: string) => string;
  noGroup: string;
  empty: string;
}

export interface GroupSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: Domain | null;
  groups: DomainGroup[];
  selectedGroupIds: number[];
  onSelectGroup: (domain: Domain, groupId: number | null) => void;
  translations: GroupSelectModalTranslations;
}

export function GroupSelectModal({
  isOpen,
  onClose,
  domain,
  groups,
  selectedGroupIds,
  onSelectGroup,
  translations,
}: GroupSelectModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header title={translations.title} description={domain?.url ? translations.desc(domain.url) : undefined} />
      <Modal.Body className="max-h-[320px]">
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => {
                if (domain) {
                  onSelectGroup(domain, null);
                  onClose();
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left hover:bg-base-200 transition-all group"
            >
              <span className={selectedGroupIds.length === 0 ? "text-primary" : "text-base-content/20"}>
                {selectedGroupIds.length === 0 ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="w-4 h-4 inline-block" />
                )}
              </span>
              <span
                className={clsx(
                  "text-sm font-bold tracking-tight",
                  selectedGroupIds.length === 0 ? "text-primary" : "text-base-content/60 group-hover:text-base-content",
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
                onClick={() => {
                  if (domain) {
                    onSelectGroup(domain, g.id);
                    onClose();
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left hover:bg-base-200 transition-all group"
              >
                <span className={selectedGroupIds.includes(g.id) ? "text-primary" : "text-base-content/20"}>
                  {selectedGroupIds.includes(g.id) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="w-4 h-4 inline-block" />
                  )}
                </span>
                <Folder
                  className={clsx(
                    "w-4 h-4 transition-colors",
                    selectedGroupIds.includes(g.id)
                      ? "text-primary"
                      : "text-base-content/30 group-hover:text-base-content/50",
                  )}
                />
                <span
                  className={clsx(
                    "text-sm font-bold tracking-tight",
                    selectedGroupIds.includes(g.id)
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
          <p className="text-sm text-base-content/30 font-bold italic py-4 pl-4">{translations.empty}</p>
        )}
      </Modal.Body>
    </Modal>
  );
}
