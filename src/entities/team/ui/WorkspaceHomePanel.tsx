import { CloudDownload, CloudUpload, CreditCard, Globe, Users } from "lucide-react";
import { Button } from "@/shared/ui/button/Button";
import type { TeamWorkspaceController } from "../model/useTeamWorkspace";
import { TeamPanelFrame } from "./TeamPanelFrame";

interface WorkspaceHomePanelProps {
  ctrl: TeamWorkspaceController;
  onClose: () => void;
}

export function WorkspaceHomePanel({ ctrl, onClose }: WorkspaceHomePanelProps) {
  const { lang, activeWorkspace, guard, unlimited, activeIsPro, openPanel, openSync, openBilling, syncing } = ctrl;

  if (!activeWorkspace) {
    return null;
  }

  return (
    <TeamPanelFrame
      title={activeWorkspace.name}
      subtitle={
        lang === "ko"
          ? `${activeWorkspace.plan.toUpperCase()} · ${guard.memberCount}/${unlimited ? "∞" : guard.seatLimit}명`
          : `${activeWorkspace.plan.toUpperCase()} · ${guard.memberCount}/${unlimited ? "∞" : guard.seatLimit} seats`
      }
      icon={<Globe className="w-3.5 h-3.5" />}
      onClose={onClose}
      widthClassName="w-[360px] min-w-[320px] max-w-[400px]"
    >
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-base-content/55 leading-relaxed">
          {lang === "ko"
            ? "멤버를 초대하고, 도메인·그룹·mock 설정을 동기화하거나 이 워크스페이스 요금제를 관리하세요."
            : "Invite members, sync domains/groups/mocks, or manage this workspace plan."}
        </p>

        <button
          type="button"
          onClick={() => openPanel("members")}
          className="flex items-center gap-3 p-3 rounded-xl border border-base-200 bg-base-200/30 hover:bg-base-200/60 text-left transition-colors"
        >
          <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Users className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">{lang === "ko" ? "멤버 & 초대" : "Members & invites"}</p>
            <p className="text-[10px] text-base-content/45">
              {lang === "ko"
                ? `이메일·공유 토큰 · ${guard.memberCount}명`
                : `Email & shareable tokens · ${guard.memberCount}`}
            </p>
          </div>
        </button>

        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
            {lang === "ko" ? "설정 동기화" : "Settings sync"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 h-9"
              disabled={syncing !== null || guard.isLocked}
              onClick={() => openSync("push")}
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Push
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 h-9"
              disabled={syncing !== null || guard.isLocked}
              onClick={() => openSync("pull")}
            >
              <CloudDownload className="w-3.5 h-3.5" />
              Pull
            </Button>
          </div>
          <p className="text-[10px] text-base-content/40">
            {lang === "ko"
              ? "이미 등록된 로컬 도메인만 선택해 공유합니다. 도메인 추가는 Hub에서 하세요."
              : "Select already-registered local domains to share. Add domains from the Hub."}
          </p>
        </div>

        <button
          type="button"
          onClick={openBilling}
          className="flex items-center gap-3 p-3 rounded-xl border border-base-200 bg-base-200/30 hover:bg-base-200/60 text-left transition-colors"
        >
          <span className="p-2 rounded-lg bg-primary/10 text-primary">
            <CreditCard className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">{lang === "ko" ? "요금제" : "Billing"}</p>
            <p className="text-[10px] text-base-content/45">
              {activeIsPro
                ? lang === "ko"
                  ? "Team Pro / Unlimited 이용 중"
                  : "Team Pro / Unlimited active"
                : lang === "ko"
                  ? "이 워크스페이스를 Team Pro로 업그레이드"
                  : "Upgrade this workspace to Team Pro"}
            </p>
          </div>
        </button>
      </div>
    </TeamPanelFrame>
  );
}
