import { Bell, Check, Loader2, Mail, Plus, Users, X } from "lucide-react";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import type { TeamWorkspaceController } from "../model/useTeamWorkspace";

interface WorkspaceOnboardingPanelProps {
  ctrl: TeamWorkspaceController;
}

export function WorkspaceOnboardingPanel({ ctrl }: WorkspaceOnboardingPanelProps) {
  const {
    lang,
    loading,
    myInvites,
    newWorkspaceName,
    setNewWorkspaceName,
    creating,
    inviteToken,
    setInviteToken,
    accepting,
    processingInviteId,
    handleCreateWorkspace,
    handleAcceptInvite,
    handleAcceptMyInvite,
    handleDeclineMyInvite,
  } = ctrl;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-base-100">
        <Loader2 className="w-6 h-6 animate-spin text-base-content/30" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center bg-base-100 p-6 overflow-y-auto">
      <div className="w-full max-w-md flex flex-col gap-5">
        <div className="text-center flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Users className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-lg font-black text-base-content">
            {lang === "ko" ? "팀 워크스페이스 시작하기" : "Get started with teams"}
          </h2>
          <p className="text-xs text-base-content/50 leading-relaxed max-w-[340px]">
            {lang === "ko"
              ? "워크스페이스를 만들거나 초대 코드로 참가하세요. 생성 후 멤버 초대·설정 동기화를 사용할 수 있습니다."
              : "Create a workspace or join with an invite code. Then invite members and sync settings."}
          </p>
        </div>

        {myInvites.length > 0 && (
          <section className="flex flex-col gap-2 p-3 rounded-xl border border-primary/25 bg-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Bell className="w-3 h-3" />
                {lang === "ko" ? "받은 초대" : "Invites for you"}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-content">
                {myInvites.length}
              </span>
            </div>
            {myInvites.map((inv) => (
              <div key={inv.id} className="flex flex-col gap-2 p-2.5 rounded-lg bg-base-100 border border-base-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">
                      {inv.workspaces?.name ?? (lang === "ko" ? "새 워크스페이스" : "New workspace")}
                    </p>
                    <p className="text-[10px] text-base-content/50">{inv.role}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => handleAcceptMyInvite(inv)}
                    disabled={processingInviteId === inv.id}
                  >
                    {processingInviteId === inv.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {lang === "ko" ? "수락" : "Accept"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-2.5 text-error"
                    onClick={() => handleDeclineMyInvite(inv.id)}
                    disabled={processingInviteId === inv.id}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2 p-4 rounded-xl border border-base-300 bg-base-200/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
            {lang === "ko" ? "새 워크스페이스" : "New workspace"}
          </span>
          <div className="flex gap-2">
            <Input
              placeholder={lang === "ko" ? "워크스페이스 이름" : "Workspace name"}
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="h-10 text-sm flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleCreateWorkspace();
                }
              }}
            />
            <Button
              variant="primary"
              size="sm"
              className="gap-1 shrink-0 h-10 px-4"
              onClick={() => void handleCreateWorkspace()}
              disabled={!newWorkspaceName.trim() || creating}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {lang === "ko" ? "만들기" : "Create"}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2 p-4 rounded-xl border border-base-300 bg-base-200/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
            {lang === "ko" ? "초대 코드로 참가" : "Join with invite code"}
          </span>
          <p className="text-[10px] text-base-content/45 leading-relaxed">
            {lang === "ko"
              ? "팀원이 공유한 초대 토큰을 붙여넣으세요."
              : "Paste the invite token shared by your teammate."}
          </p>
          <div className="flex gap-2">
            <Input
              placeholder={lang === "ko" ? "초대 토큰" : "Invite token"}
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              className="h-10 text-sm font-mono flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleAcceptInvite();
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-10 px-4 shrink-0"
              onClick={() => void handleAcceptInvite()}
              disabled={!inviteToken.trim() || accepting}
            >
              {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : lang === "ko" ? "참가" : "Join"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
