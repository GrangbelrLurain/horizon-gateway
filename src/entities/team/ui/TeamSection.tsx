import { useAtom, useAtomValue } from "jotai";
import {
  AlertTriangle,
  Bell,
  Check,
  CloudDownload,
  CloudUpload,
  Copy,
  CreditCard,
  Globe,
  Link,
  Loader2,
  Lock,
  Mail,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { languageAtom, supabaseProfileAtom, supabaseSessionAtom } from "@/entities/app";
import { commands } from "@/shared/api";
import { supabase } from "@/shared/api/supabase";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { toastError, toastInfo, toastSuccess } from "@/shared/ui/toast";
import {
  acceptInvite,
  createShareableInvite,
  createWorkspace,
  declineInvite,
  inviteMember,
  listInvites,
  listMembers,
  listMyPendingInvites,
  listWorkspaces,
  type MyPendingInvite,
  revokeInvite,
} from "../api";
import { hasProAccess, isUnlimitedTeam } from "../lib/entitlement";
import { useWorkspaceGuard } from "../model/useWorkspaceGuard";
import { activeWorkspaceIdAtom } from "../store";
import { pullWorkspaceSync, pushWorkspaceSync, type SyncMode } from "../sync";
import type { Workspace, WorkspaceInvite, WorkspaceMember } from "../types";

const LEMON_CHECKOUT_URL =
  (import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_URL as string | undefined) ||
  "https://horizon-gateway.lemonsqueezy.com/checkout/buy/7efd50de-94aa-480d-9e41-956234a36f54";

export function TeamSection() {
  const lang = useAtomValue(languageAtom);
  const session = useAtomValue(supabaseSessionAtom);
  const supaProfile = useAtomValue(supabaseProfileAtom);
  const userId = session?.user?.id ?? null;

  const [activeWorkspaceId, setActiveWorkspaceId] = useAtom(activeWorkspaceIdAtom);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [myInvites, setMyInvites] = useState<MyPendingInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [syncing, setSyncing] = useState<"push" | "pull" | null>(null);
  const [syncModalAction, setSyncModalAction] = useState<"push" | "pull" | null>(null);
  const [selectedSyncMode, setSelectedSyncMode] = useState<SyncMode>("merge_url");
  const [inviteToken, setInviteToken] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const guard = useWorkspaceGuard(activeWorkspace, members, supaProfile);

  // Owned workspaces count for Free Tier limitation check
  const ownedWorkspaces = workspaces.filter((w) => w.owner_id === userId);
  const unlimited = isUnlimitedTeam(supaProfile);
  const isProOwner =
    unlimited || hasProAccess(supaProfile) || ownedWorkspaces.some((w) => w.plan === "pro" && w.status === "active");
  const hasReachedFreeWorkspaceLimit = !isProOwner && ownedWorkspaces.length >= 1;
  const activeIsPro =
    unlimited ||
    hasProAccess(supaProfile, activeWorkspace?.plan) ||
    (activeWorkspace?.plan === "pro" && activeWorkspace.status === "active");
  const planBadge = unlimited ? "unlimited" : isProOwner ? "pro" : "free";

  const handleOpenSyncModal = (action: "push" | "pull") => {
    if (!activeWorkspaceId) {
      toastError(lang === "ko" ? "먼저 워크스페이스를 선택하세요." : "Select a workspace first.");
      return;
    }
    if (!guard.canSync) {
      toastError(
        lang === "ko" ? "구독 결제가 만료되어 동기화가 제한되었습니다." : "Sync is locked due to expired subscription.",
      );
      return;
    }
    setSelectedSyncMode("merge_url");
    setSyncModalAction(action);
  };

  const handleExecuteSync = async () => {
    if (!userId || !activeWorkspaceId || !syncModalAction) {
      return;
    }
    const action = syncModalAction;
    const mode = selectedSyncMode;
    setSyncModalAction(null);
    setSyncing(action);

    try {
      if (action === "push") {
        await pushWorkspaceSync(activeWorkspaceId, userId, mode);
        toastSuccess(
          lang === "ko"
            ? "팀 워크스페이스에 도메인 및 그룹 설정을 동기화(업로드)했습니다."
            : "Pushed domain & group settings to workspace.",
        );
      } else {
        await pullWorkspaceSync(activeWorkspaceId, mode);
        toastSuccess(
          lang === "ko"
            ? "팀 워크스페이스에서 도메인 및 그룹 설정을 동기화(가져오기)했습니다."
            : "Pulled domain & group settings from workspace.",
        );
      }
    } catch (e: unknown) {
      console.error("handleExecuteSync:", e);
      const errMsg = (e as { message?: string })?.message;
      toastError(lang === "ko" ? `동기화 실패: ${errMsg || "오류 발생"}` : `Sync failed: ${errMsg || "Unknown error"}`);
    } finally {
      setSyncing(null);
    }
  };

  const refreshWorkspaces = useCallback(async () => {
    if (!userId) {
      return;
    }
    setLoading(true);
    try {
      const list = await listWorkspaces();
      setWorkspaces(list);
      if (!activeWorkspaceId && list.length > 0) {
        setActiveWorkspaceId(list[0].id);
      }
    } catch (e) {
      console.error("listWorkspaces:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, activeWorkspaceId, setActiveWorkspaceId]);

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  // Realtime subscription for invites sent to current user's email
  useEffect(() => {
    if (!supaProfile?.email) {
      setMyInvites([]);
      return;
    }
    const email = supaProfile.email.trim().toLowerCase();

    void listMyPendingInvites(email).then(setMyInvites).catch(console.error);

    const channel = supabase
      .channel(`my-invites-${email}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workspace_invites",
          filter: `email=eq.${email}`,
        },
        () => {
          toastInfo(lang === "ko" ? "새로운 워크스페이스 초대가 도착했습니다!" : "New workspace invitation received!");
          void listMyPendingInvites(email).then(setMyInvites).catch(console.error);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supaProfile?.email, lang]);

  const refreshMembersAndInvites = useCallback(async (wsId: string) => {
    try {
      const [mList, iList] = await Promise.all([listMembers(wsId), listInvites(wsId)]);
      setMembers(mList);
      setInvites(iList.filter((inv) => inv.status === "pending"));
    } catch (e) {
      console.error("refreshMembersAndInvites:", e);
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setMembers([]);
      setInvites([]);
      return;
    }
    void refreshMembersAndInvites(activeWorkspaceId);
  }, [activeWorkspaceId, refreshMembersAndInvites]);

  const handleCheckout = async () => {
    if (!activeWorkspaceId) {
      toastError(lang === "ko" ? "먼저 워크스페이스를 선택하세요." : "Select a workspace first.");
      return;
    }
    const separator = LEMON_CHECKOUT_URL.includes("?") ? "&" : "?";
    const url = `${LEMON_CHECKOUT_URL}${separator}checkout[custom][workspace_id]=${encodeURIComponent(activeWorkspaceId)}`;
    try {
      await commands.openExternalUrl(url);
    } catch (e) {
      console.error("openExternalUrl:", e);
      toastError(lang === "ko" ? "결제 페이지를 여는 데 실패했습니다." : "Failed to open checkout page.");
    }
  };

  const handleCreateWorkspace = async () => {
    if (!userId || !newWorkspaceName.trim()) {
      return;
    }
    if (hasReachedFreeWorkspaceLimit) {
      toastInfo(
        lang === "ko"
          ? "Free 플랜에서는 1개의 워크스페이스만 생성할 수 있습니다. 추가 생성을 위해 Team Pro 플랜으로 업그레이드하세요."
          : "Free plan allows 1 workspace. Upgrade to Team Pro plan for unlimited workspaces.",
      );
      void handleCheckout();
      return;
    }
    setCreating(true);
    try {
      const workspace = await createWorkspace(newWorkspaceName.trim(), userId);
      setWorkspaces((prev) => [workspace, ...prev]);
      setActiveWorkspaceId(workspace.id);
      setNewWorkspaceName("");
      toastSuccess(lang === "ko" ? "워크스페이스가 생성되었습니다." : "Workspace created.");
    } catch (e) {
      console.error("createWorkspace:", e);
      toastError(lang === "ko" ? "워크스페이스 생성에 실패했습니다." : "Failed to create workspace.");
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!userId || !activeWorkspaceId || !inviteEmail.trim()) {
      return;
    }
    if (!guard.canInvite) {
      if (guard.isSeatFull) {
        toastInfo(
          lang === "ko"
            ? `현재 워크스페이스 정원(${guard.memberCount}/${guard.seatLimit}명)이 가득 찼습니다. 팀 인원을 추가하려면 Team Pro 플랜으로 업그레이드하세요.`
            : `Seat limit reached (${guard.memberCount}/${guard.seatLimit}). Upgrade to Team Pro plan to add more members.`,
        );
        void handleCheckout();
      } else if (guard.isLocked) {
        toastError(
          lang === "ko"
            ? "워크스페이스 결제 상태가 비활성입니다. 결제를 확인하세요."
            : "Workspace subscription is locked. Check payment status.",
        );
      }
      return;
    }

    setInviting(true);
    try {
      const inv = await inviteMember(activeWorkspaceId, inviteEmail.trim(), userId);
      setInviteEmail("");
      await refreshMembersAndInvites(activeWorkspaceId);

      try {
        await navigator.clipboard.writeText(inv.token);
        toastSuccess(
          lang === "ko"
            ? `초대를 생성하고 토큰을 클립보드에 복사했습니다: ${inv.token}`
            : `Invite created and token copied to clipboard: ${inv.token}`,
        );
      } catch {
        toastSuccess(lang === "ko" ? `초대를 보냈습니다. 초대 토큰: ${inv.token}` : `Invite sent. Token: ${inv.token}`);
      }
    } catch (e) {
      console.error("inviteMember:", e);
      toastError(lang === "ko" ? "초대 전송에 실패했습니다." : "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  };

  const handleCreateShareableInvite = async () => {
    if (!userId || !activeWorkspaceId) {
      return;
    }
    if (!guard.canInvite) {
      if (guard.isSeatFull) {
        toastInfo(
          lang === "ko"
            ? `현재 워크스페이스 정원(${guard.memberCount}/${guard.seatLimit}명)이 가득 찼습니다. 팀 인원을 추가하려면 Team Pro 플랜으로 업그레이드하세요.`
            : `Seat limit reached (${guard.memberCount}/${guard.seatLimit}). Upgrade to Team Pro plan to add more members.`,
        );
        void handleCheckout();
      }
      return;
    }

    setInviting(true);
    try {
      const inv = await createShareableInvite(activeWorkspaceId, userId);
      await refreshMembersAndInvites(activeWorkspaceId);

      try {
        await navigator.clipboard.writeText(inv.token);
        toastSuccess(
          lang === "ko"
            ? `공유용 초대 토큰이 생성되고 복사되었습니다: ${inv.token}`
            : `Shareable invite token created and copied: ${inv.token}`,
        );
      } catch {
        toastSuccess(
          lang === "ko"
            ? `공유용 초대 토큰이 생성되었습니다: ${inv.token}`
            : `Shareable invite token created: ${inv.token}`,
        );
      }
    } catch (e) {
      console.error("createShareableInvite:", e);
      toastError(lang === "ko" ? "공유 토큰 생성에 실패했습니다." : "Failed to create shareable token.");
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!activeWorkspaceId) {
      return;
    }
    try {
      await revokeInvite(inviteId);
      await refreshMembersAndInvites(activeWorkspaceId);
      toastInfo(lang === "ko" ? "초대 토큰이 만료/철회 처리되었습니다." : "Invite token revoked.");
    } catch (e) {
      console.error("revokeInvite:", e);
      toastError(lang === "ko" ? "토큰 만료 처리에 실패했습니다." : "Failed to revoke invite.");
    }
  };

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      toastSuccess(lang === "ko" ? "초대 토큰이 클립보드에 복사되었습니다." : "Invite token copied to clipboard.");
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toastError(lang === "ko" ? "복사에 실패했습니다." : "Failed to copy.");
    }
  };

  const handleAcceptMyInvite = async (inv: MyPendingInvite) => {
    if (!userId) {
      return;
    }
    setProcessingInviteId(inv.id);
    try {
      await acceptInvite(inv.token, userId);
      if (supaProfile?.email) {
        setMyInvites((prev) => prev.filter((item) => item.id !== inv.id));
      }
      await refreshWorkspaces();
      setActiveWorkspaceId(inv.workspace_id);
      toastSuccess(
        lang === "ko"
          ? `${inv.workspaces?.name ?? "워크스페이스"} 초대를 수락했습니다!`
          : `Joined ${inv.workspaces?.name ?? "workspace"}!`,
      );
    } catch (e: unknown) {
      console.error("handleAcceptMyInvite:", e);
      const errMsg = (e as { message?: string })?.message || (e as { details?: string })?.details;
      toastError(
        lang === "ko"
          ? `초대 수락 실패: ${errMsg || "알 수 없는 오류"}`
          : `Failed to accept invite: ${errMsg || "Unknown error"}`,
      );
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleDeclineMyInvite = async (inviteId: string) => {
    setProcessingInviteId(inviteId);
    try {
      await declineInvite(inviteId);
      setMyInvites((prev) => prev.filter((item) => item.id !== inviteId));
      toastInfo(lang === "ko" ? "초대를 거절했습니다." : "Invite declined.");
    } catch (e: unknown) {
      console.error("handleDeclineMyInvite:", e);
      toastError(lang === "ko" ? "초대 거절에 실패했습니다." : "Failed to decline invite.");
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleAcceptInvite = async () => {
    if (!userId || !inviteToken.trim()) {
      return;
    }
    setAccepting(true);
    try {
      await acceptInvite(inviteToken.trim(), userId);
      setInviteToken("");
      await refreshWorkspaces();
      if (activeWorkspaceId) {
        await refreshMembersAndInvites(activeWorkspaceId);
      }
      toastSuccess(lang === "ko" ? "초대를 수락했습니다." : "Invite accepted.");
    } catch (e: unknown) {
      console.error("acceptInvite:", e);
      const errMsg = (e as { message?: string })?.message || (e as { details?: string })?.details;
      toastError(
        lang === "ko"
          ? `초대 수락 실패: ${errMsg || "알 수 없는 오류"}`
          : `Failed to accept invite: ${errMsg || "Unknown error"}`,
      );
    } finally {
      setAccepting(false);
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="bg-base-100 rounded-3xl border border-base-200 p-8 shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <Users className="w-4 h-4" />
          </span>
          {lang === "ko" ? "워크스페이스 및 팀 관리" : "Workspace & Team Management"}
        </h3>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-base-content/40" />}
      </div>

      <p className="text-xs text-base-content/60 leading-relaxed max-w-2xl">
        {lang === "ko"
          ? "팀원과 함께 도메인 리스트, 그룹 및 Mock 설정을 공유할 수 있는 공유 워크스페이스입니다."
          : "Share domain lists, groups, and mock configuration with your team in a shared workspace."}
      </p>

      {/* Subscription Status Lock Warning Banner */}
      {activeWorkspace && guard.isLocked && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-600 dark:text-amber-400 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {lang === "ko"
              ? "워크스페이스 구독이 만료되거나 비활성화되었습니다. 팀 동기화를 계속하려면 결제를 확인하세요."
              : "Workspace subscription is expired or inactive. Check payment status to continue sync."}
          </span>
          <Button variant="primary" size="sm" className="ml-auto text-xs py-1 h-7" onClick={handleCheckout}>
            {lang === "ko" ? "결제 갱신" : "Renew"}
          </Button>
        </div>
      )}

      {/* 🔔 My Pending Received Invites Section (1-Click Accept/Decline) */}
      {myInvites.length > 0 && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
              <Bell className="w-4 h-4 animate-bounce" />
              {lang === "ko" ? "나에게 도착한 워크스페이스 초대" : "Received Workspace Invitations"}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-content">
              {myInvites.length}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {myInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-xl bg-base-100 border border-base-200 shadow-sm flex-wrap gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-base-content">
                      {inv.workspaces?.name ?? (lang === "ko" ? "새 워크스페이스" : "New Workspace")}
                    </p>
                    <p className="text-[10px] text-base-content/50">
                      {lang === "ko" ? "역할:" : "Role:"} <span className="font-semibold">{inv.role}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="primary"
                    size="sm"
                    className="gap-1 text-xs py-1 h-8"
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
                    className="gap-1 text-xs py-1 h-8 text-error hover:bg-error/10"
                    onClick={() => handleDeclineMyInvite(inv.id)}
                    disabled={processingInviteId === inv.id}
                  >
                    <X className="w-3.5 h-3.5" />
                    {lang === "ko" ? "거절" : "Decline"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workspace list + create */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">
              {lang === "ko" ? "내 워크스페이스" : "My Workspaces"}
            </span>
            <span className="text-[10px] text-base-content/40">
              {planBadge === "unlimited"
                ? lang === "ko"
                  ? `Unlimited · 워크스페이스 ${ownedWorkspaces.length}개`
                  : `Unlimited · ${ownedWorkspaces.length} workspace(s)`
                : planBadge === "pro"
                  ? lang === "ko"
                    ? `Pro · 워크스페이스 ${ownedWorkspaces.length}개`
                    : `Pro · ${ownedWorkspaces.length} workspace(s)`
                  : lang === "ko"
                    ? `Free: ${ownedWorkspaces.length}/1개`
                    : `Free: ${ownedWorkspaces.length}/1 max`}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {workspaces.length === 0 && (
              <p className="text-xs text-base-content/40 py-2">
                {lang === "ko" ? "아직 워크스페이스가 없습니다." : "No workspaces yet."}
              </p>
            )}
            {workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setActiveWorkspaceId(w.id)}
                className={`w-full text-left px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  activeWorkspaceId === w.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-base-200 bg-base-200/40 text-base-content hover:bg-base-200/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{w.name}</span>
                  <span className="ml-2 text-[10px] text-base-content/40 uppercase shrink-0">
                    {w.plan === "pro" ? "pro" : "free"} · {w.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder={lang === "ko" ? "새 워크스페이스 이름" : "New workspace name"}
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateWorkspace();
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={handleCreateWorkspace}
              disabled={!newWorkspaceName.trim() || creating}
            >
              <Plus className="w-3.5 h-3.5" />
              {lang === "ko" ? "생성" : "Create"}
            </Button>
          </div>
        </div>

        {/* Members + invite */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">
              {lang === "ko" ? "멤버 목록" : "Members"} {activeWorkspace ? `— ${activeWorkspace.name}` : ""}
            </span>
            {activeWorkspace && (
              <span
                className={`text-[10px] font-semibold ${guard.isSeatFull ? "text-amber-500" : "text-base-content/40"}`}
              >
                {unlimited
                  ? lang === "ko"
                    ? `${guard.memberCount}명 · unlimited`
                    : `${guard.memberCount} · unlimited`
                  : `${guard.memberCount} / ${guard.seatLimit} ${lang === "ko" ? "명" : "seats"}`}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {!activeWorkspace && (
              <p className="text-xs text-base-content/40 py-2">
                {lang === "ko" ? "워크스페이스를 선택하세요." : "Select a workspace."}
              </p>
            )}
            {activeWorkspace &&
              members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl border border-base-200 bg-base-200/40 text-sm"
                >
                  <span className="font-mono text-xs text-base-content/70 truncate">{m.profile_id}</span>
                  <span className="text-[10px] font-bold uppercase text-base-content/40">{m.role}</span>
                </div>
              ))}
          </div>

          <div className="flex gap-2 mt-1 flex-wrap">
            <Input
              type="email"
              placeholder={
                guard.isSeatFull
                  ? lang === "ko"
                    ? "정원 초과 (업그레이드 필요)"
                    : "Limit reached (Upgrade required)"
                  : lang === "ko"
                    ? "이메일로 초대"
                    : "Invite by email"
              }
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={!activeWorkspace || !guard.canInvite}
              className="h-9 text-sm min-w-40 flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleInvite();
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={handleInvite}
              disabled={!activeWorkspace || !inviteEmail.trim() || inviting}
            >
              {guard.isSeatFull ? (
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              {lang === "ko" ? "초대" : "Invite"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 shrink-0 text-xs border border-base-200 hover:bg-base-200"
              onClick={handleCreateShareableInvite}
              disabled={!activeWorkspace || !guard.canInvite || inviting}
              title={lang === "ko" ? "누구나 참가할 수 있는 공개 링크/토큰 생성" : "Create a shareable invite token"}
            >
              <Link className="w-3.5 h-3.5 text-primary" />
              {lang === "ko" ? "공유 토큰 생성" : "Shareable Token"}
            </Button>
          </div>

          {/* Pending Invites Token List */}
          {activeWorkspace && invites.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-base-200">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                {lang === "ko" ? "대기 중인 초대 (토큰 관리)" : "Pending Invites (Manage Token)"}
              </span>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs flex-wrap gap-1"
                  >
                    <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                      <span className="truncate text-base-content/80 font-medium">
                        {inv.email === "link@shareable"
                          ? lang === "ko"
                            ? "🔗 공유용 공개 초대 토큰"
                            : "🔗 Shareable Public Token"
                          : inv.email}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleCopyToken(inv.token)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-base-100 border border-base-300 text-[10px] font-medium text-base-content/70 hover:text-primary transition-all shadow-sm"
                      >
                        {copiedToken === inv.token ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            {lang === "ko" ? "복사됨" : "Copied"}
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            {lang === "ko" ? "토큰 복사" : "Copy Token"}
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRevokeInvite(inv.id)}
                        title={lang === "ko" ? "이 초대 토큰 만료/철회" : "Revoke this invite token"}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-error/10 border border-error/20 text-[10px] font-medium text-error hover:bg-error/20 transition-all shadow-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                        {lang === "ko" ? "만료/철회" : "Revoke"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sync + Domain List Focus & Checkout */}
      <div className="flex flex-col gap-3 pt-4 border-t border-base-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-bold text-base-content flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-primary" />
              {lang === "ko" ? "도메인 리스트 및 설정 동기화" : "Domain List & Settings Sync"}
            </p>
            <p className="text-[10px] text-base-content/50">
              {lang === "ko"
                ? "도메인 목록 및 그룹/mock 규칙만 공유합니다. (CA·토큰·패킷 로그 제외)"
                : "Shares domain lists, groups, and mock rules only. (Excludes CA, tokens, logs)"}
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            className="gap-1.5 shadow-md shadow-primary/10"
            onClick={handleCheckout}
            disabled={activeIsPro}
          >
            <CreditCard className="w-3.5 h-3.5" />
            {activeIsPro
              ? unlimited
                ? lang === "ko"
                  ? "Unlimited 이용 중"
                  : "Unlimited active"
                : lang === "ko"
                  ? "Team Pro 이용 중"
                  : "Team Pro active"
              : lang === "ko"
                ? "Team Pro 업그레이드"
                : "Upgrade Team Pro"}
          </Button>
        </div>

        {activeWorkspace && (
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => handleOpenSyncModal("push")}
              disabled={syncing !== null || guard.isLocked}
            >
              {syncing === "push" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              {lang === "ko" ? "도메인 목록 업로드 (Push)" : "Push Domain List"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => handleOpenSyncModal("pull")}
              disabled={syncing !== null || guard.isLocked}
            >
              {syncing === "pull" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudDownload className="w-3.5 h-3.5" />
              )}
              {lang === "ko" ? "도메인 목록 가져오기 (Pull)" : "Pull Domain List"}
            </Button>
            <span className="text-[10px] text-base-content/40 ml-1">
              {lang === "ko" ? "다양한 병합 전략 옵션 지원" : "Supports Multi-mode Sync Options"}
            </span>
          </div>
        )}
      </div>

      {/* Join with Invite Token (Secondary Fallback Option) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-base-200">
        <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">
          {lang === "ko" ? "초대 토큰 직접 입력 수락 (보조 수단)" : "Join with invite token (Fallback)"}
        </span>
        <div className="flex gap-2">
          <Input
            placeholder={lang === "ko" ? "초대 토큰 붙여넣기" : "Paste invite token"}
            value={inviteToken}
            onChange={(e) => setInviteToken(e.target.value)}
            className="h-9 text-sm font-mono"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAcceptInvite}
            disabled={!inviteToken.trim() || accepting}
          >
            {accepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {lang === "ko" ? "참가" : "Join"}
          </Button>
        </div>
      </div>

      {supaProfile?.email && (
        <p className="text-[10px] text-base-content/30">
          {lang === "ko" ? "로그인 계정:" : "Signed in as:"} {supaProfile.email}
        </p>
      )}

      {/* 🌟 Sync Options Modal */}
      {syncModalAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-base-100 border border-base-200 rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-base-content flex items-center gap-2">
                <span className="p-1.5 bg-primary/10 text-primary rounded-lg">
                  {syncModalAction === "push" ? (
                    <CloudUpload className="w-4 h-4" />
                  ) : (
                    <CloudDownload className="w-4 h-4" />
                  )}
                </span>
                {syncModalAction === "push"
                  ? lang === "ko"
                    ? "팀 워크스페이스 업로드 방식 선택"
                    : "Select Push Sync Mode"
                  : lang === "ko"
                    ? "팀 워크스페이스 가져오기 방식 선택"
                    : "Select Pull Sync Mode"}
              </h4>
              <button
                type="button"
                onClick={() => setSyncModalAction(null)}
                className="text-base-content/40 hover:text-base-content p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-base-content/60 leading-relaxed">
              {syncModalAction === "push"
                ? lang === "ko"
                  ? "현재 로컬에 설정된 도메인 및 그룹을 팀 워크스페이스로 공유할 방식을 선택하세요."
                  : "Choose how to upload your local domain & group settings to the workspace."
                : lang === "ko"
                  ? "팀 워크스페이스의 도메인 및 그룹을 로컬로 가져올 방식을 선택하세요."
                  : "Choose how to merge team workspace settings into your local device."}
            </p>

            <div className="flex flex-col gap-2.5">
              {/* Option 1: URL-based merge */}
              <button
                type="button"
                onClick={() => setSelectedSyncMode("merge_url")}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  selectedSyncMode === "merge_url"
                    ? "border-primary bg-primary/10 text-base-content ring-1 ring-primary"
                    : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    🌐 {lang === "ko" ? "URL 기준 대조 병합 (추천)" : "Merge by URL (Recommended)"}
                  </span>
                  {selectedSyncMode === "merge_url" && <Check className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-[10px] text-base-content/50 leading-normal">
                  {lang === "ko"
                    ? "컴퓨터나 계정이 달라도 도메인 URL이 같으면 하나로 합쳐서 그룹 및 Mock 규칙을 갱신합니다."
                    : "Matches domains by URL. Safely merges settings across different devices or accounts."}
                </p>
              </button>

              {/* Option 2: Append Only */}
              <button
                type="button"
                onClick={() => setSelectedSyncMode("append_only")}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  selectedSyncMode === "append_only"
                    ? "border-primary bg-primary/10 text-base-content ring-1 ring-primary"
                    : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    ➕ {lang === "ko" ? "신규 도메인만 추가 (Append)" : "Add New Only (Append)"}
                  </span>
                  {selectedSyncMode === "append_only" && <Check className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-[10px] text-base-content/50 leading-normal">
                  {lang === "ko"
                    ? "기존 설정은 그대로 유지하고, 대상 쪽에 존재하지 않는 새로운 도메인만 안전하게 추가합니다."
                    : "Keeps existing domains intact and only adds newly created domains."}
                </p>
              </button>

              {/* Option 3: Overwrite */}
              <button
                type="button"
                onClick={() => setSelectedSyncMode("overwrite")}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  selectedSyncMode === "overwrite"
                    ? "border-amber-500 bg-amber-500/10 text-base-content ring-1 ring-amber-500"
                    : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    ⚠️ {lang === "ko" ? "완전 덮어씌우기 (Replace All)" : "Overwrite All"}
                  </span>
                  {selectedSyncMode === "overwrite" && <Check className="w-4 h-4 text-amber-500" />}
                </div>
                <p className="text-[10px] text-base-content/50 leading-normal">
                  {syncModalAction === "push"
                    ? lang === "ko"
                      ? "팀 워크스페이스의 기존 데이터를 내 현재 로컬 도메인 목록으로 완전히 대체합니다."
                      : "Replaces all workspace settings with your local device data."
                    : lang === "ko"
                      ? "내 로컬 도메인 목록을 팀 워크스페이스 데이터로 완전히 대체합니다."
                      : "Replaces all your local settings with team workspace data."}
                </p>
              </button>

              {/* Option 4: Merge by ID */}
              <button
                type="button"
                onClick={() => setSelectedSyncMode("merge_id")}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  selectedSyncMode === "merge_id"
                    ? "border-primary bg-primary/10 text-base-content ring-1 ring-primary"
                    : "border-base-200 bg-base-200/40 text-base-content/70 hover:bg-base-200/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    🆔 {lang === "ko" ? "내부 ID 대조 병합 (Strict ID)" : "Merge by Internal ID"}
                  </span>
                  {selectedSyncMode === "merge_id" && <Check className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-[10px] text-base-content/50 leading-normal">
                  {lang === "ko"
                    ? "동일 계정의 동일 기기 간 고유 ID(UUID) 기반 대조 스마트 병합 모드입니다."
                    : "Strict ID-based merge mode for identical account/device sync."}
                </p>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setSyncModalAction(null)}>
                {lang === "ko" ? "취소" : "Cancel"}
              </Button>
              <Button variant="primary" size="sm" onClick={handleExecuteSync} className="gap-1.5">
                {syncModalAction === "push" ? (
                  <>
                    <CloudUpload className="w-3.5 h-3.5" />
                    {lang === "ko" ? "업로드 실행" : "Execute Push"}
                  </>
                ) : (
                  <>
                    <CloudDownload className="w-3.5 h-3.5" />
                    {lang === "ko" ? "가져오기 실행" : "Execute Pull"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
