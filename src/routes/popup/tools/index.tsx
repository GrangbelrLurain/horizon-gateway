import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { FlaskConical } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { PopupShell, popupEn, popupKo, ToolsContent } from "@/features/popup-window";

function PopupToolsPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;

  return (
    <PopupShell title={t.toolsTitle} icon={<FlaskConical className="w-4 h-4" />} accent="emerald">
      <ToolsContent />
    </PopupShell>
  );
}

export const Route = createFileRoute("/popup/tools/")({
  component: PopupToolsPage,
});
