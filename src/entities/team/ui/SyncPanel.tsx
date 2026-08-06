import { CloudDownload, CloudUpload } from "lucide-react";
import type { TeamWorkspaceController } from "../model/useTeamWorkspace";
import { SyncOptionsForm } from "./SyncOptionsForm";
import { TeamPanelFrame } from "./TeamPanelFrame";

interface SyncPanelProps {
  ctrl: TeamWorkspaceController;
  onClose: () => void;
}

export function SyncPanel({ ctrl, onClose }: SyncPanelProps) {
  const { lang, activeWorkspaceId, syncAction, syncing, handleExecuteSync } = ctrl;

  if (!activeWorkspaceId) {
    return null;
  }

  const isPush = syncAction === "push";

  return (
    <TeamPanelFrame
      title={
        isPush
          ? lang === "ko"
            ? "설정 업로드 (Push)"
            : "Push sync"
          : lang === "ko"
            ? "설정 가져오기 (Pull)"
            : "Pull sync"
      }
      subtitle={
        lang === "ko"
          ? "도메인·그룹·mock만 공유 · 신규 도메인 추가는 Hub에서"
          : "Domains/groups/mocks only · add domains in Hub"
      }
      icon={isPush ? <CloudUpload className="w-3.5 h-3.5" /> : <CloudDownload className="w-3.5 h-3.5" />}
      onClose={onClose}
      widthClassName="w-[440px] min-w-[380px] max-w-[520px]"
      scrollBody={false}
    >
      <SyncOptionsForm
        action={syncAction}
        workspaceId={activeWorkspaceId}
        lang={lang}
        busy={syncing !== null}
        onConfirm={(options) => void handleExecuteSync(options)}
        onCancel={onClose}
      />
    </TeamPanelFrame>
  );
}
