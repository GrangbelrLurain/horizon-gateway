import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Smartphone } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { MobileConnectionContent } from "@/features/mobile-connection";
import { PopupShell, popupEn, popupKo } from "@/features/popup-window";

function PopupMobilePage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;

  return (
    <PopupShell title={t.mobileTitle} icon={<Smartphone className="w-4 h-4" />} accent="emerald" fullWidth>
      <MobileConnectionContent embedded />
    </PopupShell>
  );
}

export const Route = createFileRoute("/popup/mobile/")({
  component: PopupMobilePage,
});
