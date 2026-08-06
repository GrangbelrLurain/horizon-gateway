import { CloudDownload, CloudUpload, X } from "lucide-react";
import type { WorkspaceSyncOptions } from "../sync";
import { SyncOptionsForm } from "./SyncOptionsForm";

interface WorkspaceSyncModalProps {
  action: "push" | "pull";
  workspaceId: string;
  lang: "ko" | "en";
  onClose: () => void;
  onConfirm: (options: WorkspaceSyncOptions) => void;
}

/** @deprecated Prefer SyncPanel inside TeamWorkspaceShell. Kept for any leftover callers. */
export function WorkspaceSyncModal({ action, workspaceId, lang, onClose, onConfirm }: WorkspaceSyncModalProps) {
  const isPush = action === "push";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-base-100 border border-base-200 rounded-xl max-w-lg w-full p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh]">
        <div className="flex items-center justify-between shrink-0">
          <h4 className="text-base font-bold text-base-content flex items-center gap-2">
            <span className="p-1.5 bg-primary/10 text-primary rounded-md">
              {isPush ? <CloudUpload className="w-4 h-4" /> : <CloudDownload className="w-4 h-4" />}
            </span>
            {isPush
              ? lang === "ko"
                ? "팀 워크스페이스 업로드 옵션"
                : "Push Sync Options"
              : lang === "ko"
                ? "팀 워크스페이스 가져오기 옵션"
                : "Pull Sync Options"}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-base-content/40 hover:text-base-content p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <SyncOptionsForm
          action={action}
          workspaceId={workspaceId}
          lang={lang}
          onConfirm={onConfirm}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
