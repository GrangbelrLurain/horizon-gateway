import clsx from "clsx";
import { useAtomValue } from "jotai";
import { Download, Loader2 } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { Button } from "@/shared/ui/button/Button";
import { pendingUpdateAtom } from "./store";
import { useInstallUpdate } from "./useInstallUpdate";

interface UpdateToolbarBadgeProps {
  className?: string;
}

/**
 * Compact TopBar/Titlebar control: visible only when an update is available.
 * Click starts downloadAndInstall and relaunches the app.
 */
export function UpdateToolbarBadge({ className }: UpdateToolbarBadgeProps) {
  const lang = useAtomValue(languageAtom);
  const update = useAtomValue(pendingUpdateAtom);
  const { isInstalling, installUpdate } = useInstallUpdate();

  if (!update) {
    return null;
  }

  const label = lang === "ko" ? `업데이트 v${update.version}` : `Update v${update.version}`;
  const installingLabel = lang === "ko" ? "업데이트 설치 중…" : "Installing update…";
  const failedLabel = lang === "ko" ? "업데이트 실패" : "Update failed";

  return (
    <Button
      variant="ghost"
      size="sm"
      className={clsx(
        "relative gap-1.5 h-8 text-xs font-bold",
        "text-sky-300 hover:text-white hover:bg-sky-500/20 border border-sky-500/30 bg-sky-500/10",
        className,
      )}
      title={
        lang === "ko"
          ? `새 버전 v${update.version} — 클릭하여 업데이트`
          : `New version v${update.version} — click to update`
      }
      disabled={isInstalling}
      onClick={() =>
        installUpdate(update, {
          installing: installingLabel,
          failed: failedLabel,
        })
      }
    >
      {isInstalling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{isInstalling ? installingLabel : label}</span>
      <span className="sm:hidden">{isInstalling ? "…" : `v${update.version}`}</span>
      {!isInstalling && (
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.9)] animate-pulse"
          aria-hidden
        />
      )}
    </Button>
  );
}
