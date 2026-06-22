import { useEffect, useState } from "react";
import type { DomainGroup } from "@/entities/domain-group";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { Modal } from "@/shared/ui/modal/Modal";

interface EditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: DomainGroup | null;
  onSave: (id: number, name: string) => void;
  isSaving: boolean;
  translations: {
    title: string;
    placeholder: string;
    cancel: string;
    save: string;
  };
}

export function EditGroupModal({ isOpen, onClose, group, onSave, isSaving, translations }: EditGroupModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (group) {
      setName(group.name);
    }
  }, [group]);

  const handleSave = () => {
    if (group && name.trim()) {
      onSave(group.id, name.trim());
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Modal.Header title={translations.title} />
      <Modal.Body>
        <label htmlFor="group-name" className="flex flex-col gap-2 py-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">Group Name</span>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={translations.placeholder}
            className="w-full rounded-2xl bg-base-200 border-base-300 focus:bg-base-100 font-bold tracking-tight h-12 px-4 shadow-inner"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </label>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={isSaving} className="font-bold">
          {translations.cancel}
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="px-8 font-black uppercase tracking-widest shadow-lg"
        >
          {isSaving ? "Saving..." : translations.save}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
