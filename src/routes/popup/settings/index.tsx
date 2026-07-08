import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Settings as SettingsIcon } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { PopupShell, popupEn, popupKo, SettingsContent } from "@/features/popup-window";

function PopupSettingsPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;

  return (
    <PopupShell title={t.settingsTitle} icon={<SettingsIcon className="w-4 h-4" />} accent="indigo" fullWidth>
      <SettingsContent />
    </PopupShell>
  );
}

export const Route = createFileRoute("/popup/settings/")({
  component: PopupSettingsPage,
});
