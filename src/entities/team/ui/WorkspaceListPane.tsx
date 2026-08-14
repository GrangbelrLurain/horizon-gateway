import { AlertTriangle, Bell, Check, Loader2, Mail, Plus, Users, X } from "lucide-react";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import type { TeamWorkspaceController } from "../model/useTeamWorkspace";

interface WorkspaceListPaneProps {
  ctrl: TeamWorkspaceController;
}

export function WorkspaceListPane({ ctrl }: WorkspaceListPaneProps) {
  const {
    lang,
    workspaces,
    myInvites,
    loading,
    newWorkspaceName,
    setNewWorkspaceName,
    creating,
    activeWorkspaceId,
    ownedWorkspaces,
    planBadge,
    selectWorkspace,
    handleCreateWorkspace,
    handleAcceptMyInvite,
    handleDeclineMyInvite,
    processingInviteId,
    openBilling,
    activeWorkspace,
    guard,
    paidCheckoutEnabled,
  } = ctrl;

  return (
    <div className="flex flex-col h-full min-h-0 w-[380px] min-w-[320px] max-w-[420px] shrink-0 border-r border-base-300 bg-base-100">
      <div className="flex items-center gap-2 h-10 px-3 border-b border-base-300 bg-base-200/80 shrink-0">
        <Users className="w-3.5 h-3.5 text-emerald-500" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-base-content truncate">
            {lang === "ko" ? "워크스페이스" : "Workspaces"}
          </p>
          <p className="text-[10px] text-base-content/45 font-medium">
            {planBadge === "unlimited"
              ? lang === "ko"
                ? `Unlimited · ${ownedWorkspaces.length}개`
                : `Unlimited · ${ownedWorkspaces.length}`
              : planBadge === "pro"
                ? lang === "ko"
                  ? `Pro · ${ownedWorkspaces.length}개`
                  : `Pro · ${ownedWorkspaces.length}`
                : lang === "ko"
                  ? `Free ${ownedWorkspaces.length}/1`
                  : `Free ${ownedWorkspaces.length}/1`}
          </p>
        </div>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-base-content/40" />}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        {activeWorkspace &&
          guard.isLocked &&
          (paidCheckoutEnabled ? (
            <button
              type="button"
              onClick={openBilling}
              className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-left text-amber-600 dark:text-amber-400 text-[11px] font-medium"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {lang === "ko"
                  ? "구독이 만료·비활성입니다. 요금제에서 결제를 확인하세요."
                  : "Subscription expired or inactive. Check billing."}
              </span>
            </button>
          ) : (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{lang === "ko" ? "이 워크스페이스는 비활성 상태입니다." : "This workspace is inactive."}</span>
            </div>
          ))}

        {myInvites.length > 0 && (
          <div className="flex flex-col gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Bell className="w-3 h-3" />
                {lang === "ko" ? "받은 초대" : "Invites"}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-content">
                {myInvites.length}
              </span>
            </div>
            {myInvites.map((inv) => (
              <div key={inv.id} className="flex flex-col gap-2 p-2 rounded-lg bg-base-100 border border-base-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      {inv.workspaces?.name ?? (lang === "ko" ? "새 워크스페이스" : "New Workspace")}
                    </p>
                    <p className="text-[10px] text-base-content/50">{inv.role}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 gap-1 text-[10px] h-7"
                    onClick={() => handleAcceptMyInvite(inv)}
                    disabled={processingInviteId === inv.id}
                  >
                    {processingInviteId === inv.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    {lang === "ko" ? "수락" : "Accept"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 px-2 text-error"
                    onClick={() => handleDeclineMyInvite(inv.id)}
                    disabled={processingInviteId === inv.id}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => selectWorkspace(w.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                activeWorkspaceId === w.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-base-200 bg-base-200/40 text-base-content hover:bg-base-200/70"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{w.name}</span>
                <span className="text-[10px] text-base-content/40 uppercase shrink-0">
                  {w.plan === "pro" ? "pro" : "free"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-base-300 p-3 flex gap-2">
        <Input
          placeholder={lang === "ko" ? "새 워크스페이스 이름" : "New workspace name"}
          value={newWorkspaceName}
          onChange={(e) => setNewWorkspaceName(e.target.value)}
          className="h-9 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void handleCreateWorkspace();
            }
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          className="gap-1 shrink-0"
          onClick={() => void handleCreateWorkspace()}
          disabled={!newWorkspaceName.trim() || creating}
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}
