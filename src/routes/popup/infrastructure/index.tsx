import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Server } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { InfrastructureContent, PopupShell, popupEn, popupKo } from "@/features/popup-window";

function PopupInfrastructurePage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;

  return (
    <PopupShell title={t.infraTitle} icon={<Server className="w-4 h-4" />} accent="indigo">
      <InfrastructureContent />
    </PopupShell>
  );
}

export const Route = createFileRoute("/popup/infrastructure/")({
  component: PopupInfrastructurePage,
});
