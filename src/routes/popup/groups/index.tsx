import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Grid } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { GroupsContent, PopupShell, popupEn, popupKo } from "@/features/popup-window";

function PopupGroupsPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;

  return (
    <PopupShell title={t.groupsTitle} icon={<Grid className="w-4 h-4" />} accent="amber" fullWidth>
      <GroupsContent />
    </PopupShell>
  );
}

export const Route = createFileRoute("/popup/groups/")({
  component: PopupGroupsPage,
});
