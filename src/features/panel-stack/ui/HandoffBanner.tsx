import { useAtomValue } from "jotai";
import { X } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { Button } from "@/shared/ui/button/Button";
import { useClearHubHandoff, useHubHandoffValue } from "../hooks/useHubHandoff";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";

export function HandoffBanner() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const handoff = useHubHandoffValue();
  const clearHandoff = useClearHubHandoff();

  if (!handoff) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl border border-primary/20 bg-primary/5 text-xs">
      <span className="flex-1 min-w-0 font-bold text-base-content/80 truncate">
        {t.handoffFrom(handoff.source.label)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 shrink-0"
        onClick={clearHandoff}
        aria-label={t.handoffDismiss}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
