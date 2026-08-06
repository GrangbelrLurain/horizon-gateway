import { relaunch } from "@tauri-apps/plugin-process";
import type { Update } from "@tauri-apps/plugin-updater";
import { useSetAtom } from "jotai";
import { useCallback, useState } from "react";
import { toastError, toastInfo } from "@/shared/ui/toast";
import { pendingUpdateAtom } from "./store";

export function useInstallUpdate() {
  const setPendingUpdate = useSetAtom(pendingUpdateAtom);
  const [isInstalling, setIsInstalling] = useState(false);

  const installUpdate = useCallback(
    async (update: Update, labels?: { installing?: string; failed?: string }) => {
      setIsInstalling(true);
      try {
        toastInfo(labels?.installing ?? "Installing update…");
        await update.downloadAndInstall();
        setPendingUpdate(null);
        await relaunch();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toastError(labels?.failed ? `${labels.failed}: ${message}` : message);
        setIsInstalling(false);
      }
    },
    [setPendingUpdate],
  );

  return { isInstalling, installUpdate };
}
