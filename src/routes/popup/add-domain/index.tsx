import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Plus } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { AddDomainContent, PopupShell, popupEn, popupKo } from "@/features/popup-window";

function PopupAddDomainPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;

  return (
    <PopupShell title={t.addDomainTitle} icon={<Plus className="w-4 h-4" />} accent="amber">
      <AddDomainContent />
    </PopupShell>
  );
}

export const Route = createFileRoute("/popup/add-domain/")({
  component: PopupAddDomainPage,
});
