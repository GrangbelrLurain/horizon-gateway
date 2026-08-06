import { Check, Copy, Link, Loader2, Lock, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import type { TeamWorkspaceController } from "../model/useTeamWorkspace";
import { TeamPanelFrame } from "./TeamPanelFrame";

interface MembersPanelProps {
  ctrl: TeamWorkspaceController;
  onClose: () => void;
}

export function MembersPanel({ ctrl, onClose }: MembersPanelProps) {
  const {
    lang,
    activeWorkspace,
    members,
    invites,
    guard,
    unlimited,
    inviteEmail,
    setInviteEmail,
    inviting,
    inviteToken,
    setInviteToken,
    accepting,
    copiedToken,
    handleInvite,
    handleCreateShareableInvite,
    handleRevokeInvite,
    handleCopyToken,
    handleAcceptInvite,
    openBilling,
  } = ctrl;

  if (!activeWorkspace) {
    return null;
  }

  return (
    <TeamPanelFrame
      title={lang === "ko" ? "멤버 & 초대" : "Members & invites"}
      subtitle={
        unlimited
          ? lang === "ko"
            ? `${guard.memberCount}명 · unlimited`
            : `${guard.memberCount} · unlimited`
          : `${guard.memberCount} / ${guard.seatLimit}`
      }
      icon={<Users className="w-3.5 h-3.5" />}
      onClose={onClose}
      widthClassName="w-[400px] min-w-[340px] max-w-[440px]"
    >
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
            {lang === "ko" ? "멤버" : "Members"}
          </span>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {members.map((m) => {
              const email = m.profile?.email?.trim() || null;
              const displayName = m.profile?.display_name?.trim() || null;
              const primary = displayName || email || m.profile_id;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg border border-base-200 bg-base-200/40 text-sm gap-2"
                >
                  <div className="min-w-0 flex flex-col">
                    <span className="text-xs font-medium truncate" title={primary}>
                      {primary}
                    </span>
                    {displayName && email && <span className="text-[10px] text-base-content/40 truncate">{email}</span>}
                  </div>
                  <span className="text-[10px] font-bold uppercase text-base-content/40 shrink-0">{m.role}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
            {lang === "ko" ? "초대" : "Invite"}
          </span>
          {guard.isSeatFull && (
            <button
              type="button"
              onClick={openBilling}
              className="text-[11px] text-amber-600 dark:text-amber-400 text-left font-medium"
            >
              {lang === "ko" ? "정원 초과 — 요금제에서 업그레이드" : "Seat full — upgrade in Billing"}
            </button>
          )}
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder={
                guard.isSeatFull
                  ? lang === "ko"
                    ? "정원 초과"
                    : "Limit reached"
                  : lang === "ko"
                    ? "이메일로 초대"
                    : "Invite by email"
              }
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={!guard.canInvite}
              className="h-9 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleInvite();
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="gap-1 shrink-0"
              onClick={() => void handleInvite()}
              disabled={!inviteEmail.trim() || inviting}
            >
              {guard.isSeatFull ? (
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 justify-start border border-base-200"
            onClick={() => void handleCreateShareableInvite()}
            disabled={!guard.canInvite || inviting}
          >
            <Link className="w-3.5 h-3.5 text-primary" />
            {lang === "ko" ? "공유 토큰 생성" : "Create shareable token"}
          </Button>
        </section>

        {invites.length > 0 && (
          <section className="flex flex-col gap-1.5 pt-2 border-t border-base-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
              {lang === "ko" ? "대기 중" : "Pending"}
            </span>
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs"
              >
                <span className="truncate text-base-content/80 font-medium max-w-[180px]">
                  {inv.email === "link@shareable"
                    ? lang === "ko"
                      ? "공유용 공개 토큰"
                      : "Shareable token"
                    : inv.email}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {inv.email === "link@shareable" && (
                    <button
                      type="button"
                      onClick={() => void handleCopyToken(inv.token)}
                      className="px-1.5 py-1 rounded bg-base-100 border border-base-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedToken === inv.token ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRevokeInvite(inv.id)}
                    className="px-1.5 py-1 rounded bg-error/10 border border-error/20 text-error"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2 pt-2 border-t border-base-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
            {lang === "ko" ? "토큰으로 참가" : "Join with token"}
          </span>
          <div className="flex gap-2">
            <Input
              placeholder={lang === "ko" ? "초대 토큰 붙여넣기" : "Paste invite token"}
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              className="h-9 text-sm font-mono flex-1"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleAcceptInvite()}
              disabled={!inviteToken.trim() || accepting}
            >
              {accepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : lang === "ko" ? "참가" : "Join"}
            </Button>
          </div>
        </section>
      </div>
    </TeamPanelFrame>
  );
}
