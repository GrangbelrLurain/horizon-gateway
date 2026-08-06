import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { languageAtom, supabaseProfileAtom, supabaseSessionAtom } from "@/entities/app";
import { commands } from "@/shared/api";
import { supabase } from "@/shared/api/supabase";
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
import { activeWorkspaceIdAtom } from "../store";
import { pullWorkspaceSync, pushWorkspaceSync, type WorkspaceSyncOptions } from "../sync";
import type { Workspace, WorkspaceInvite, WorkspaceMember } from "../types";
import { useWorkspaceGuard } from "./useWorkspaceGuard";
// useWorkspaceGuard lives alongside this hook

export const LEMON_CHECKOUT_URL =
  (import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_URL as string | undefined) ||
  "https://horizon-gateway.lemonsqueezy.com/checkout/buy/7efd50de-94aa-480d-9e41-956234a36f54";

export type TeamPanelId = "home" | "members" | "sync" | "billing";

export function useTeamWorkspace() {
  const lang = useAtomValue(languageAtom);
  const session = useAtomValue(supabaseSessionAtom);
  const supaProfile = useAtomValue(supabaseProfileAtom);
  const userId = session?.user?.id ?? null;

  const [activeWorkspaceId, setActiveWorkspaceId] = useAtom(activeWorkspaceIdAtom);
  const [panels, setPanels] = useState<TeamPanelId[]>([]);
  const [syncAction, setSyncAction] = useState<"push" | "pull">("push");

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
  const [inviteToken, setInviteToken] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const guard = useWorkspaceGuard(activeWorkspace, members, supaProfile);

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

  const selectWorkspace = useCallback(
    (id: string) => {
      setActiveWorkspaceId(id);
      setPanels(["home"]);
    },
    [setActiveWorkspaceId],
  );

  const clearWorkspaceSelection = useCallback(() => {
    setActiveWorkspaceId(null);
    setPanels([]);
  }, [setActiveWorkspaceId]);

  const openPanel = useCallback((id: TeamPanelId) => {
    if (id === "home") {
      setPanels(["home"]);
      return;
    }
    setPanels(["home", id]);
  }, []);

  const closeLastPanel = useCallback(() => {
    setPanels((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.slice(0, -1);
    });
  }, []);

  /** Esc stack: close rightmost panel → clear WS → caller closes team view. Returns true if handled. */
  const handleEscape = useCallback((): boolean => {
    if (panels.length > 1) {
      closeLastPanel();
      return true;
    }
    if (activeWorkspaceId) {
      clearWorkspaceSelection();
      return true;
    }
    return false;
  }, [panels.length, activeWorkspaceId, closeLastPanel, clearWorkspaceSelection]);

  const refreshWorkspaces = useCallback(async () => {
    if (!userId) {
      return;
    }
    setLoading(true);
    try {
      const list = await listWorkspaces();
      setWorkspaces(list);
    } catch (e) {
      console.error("listWorkspaces:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setPanels([]);
      return;
    }
    setPanels((prev) => (prev.length === 0 ? ["home"] : prev));
  }, [activeWorkspaceId]);

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

  const handleCheckout = useCallback(async () => {
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
  }, [activeWorkspaceId, lang]);

  const openBilling = useCallback(() => {
    if (!activeWorkspaceId) {
      toastError(lang === "ko" ? "먼저 워크스페이스를 선택하세요." : "Select a workspace first.");
      return;
    }
    openPanel("billing");
  }, [activeWorkspaceId, lang, openPanel]);

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
      const targetId = activeWorkspaceId ?? ownedWorkspaces[0]?.id;
      if (targetId) {
        setActiveWorkspaceId(targetId);
        setPanels(["home", "billing"]);
      } else {
        void handleCheckout();
      }
      return;
    }
    setCreating(true);
    try {
      const workspace = await createWorkspace(newWorkspaceName.trim(), userId);
      setWorkspaces((prev) => [workspace, ...prev]);
      selectWorkspace(workspace.id);
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
        openBilling();
      } else if (guard.isLocked) {
        toastError(
          lang === "ko"
            ? "워크스페이스 결제 상태가 비활성입니다. 결제를 확인하세요."
            : "Workspace subscription is locked. Check payment status.",
        );
        openBilling();
      }
      return;
    }

    setInviting(true);
    try {
      await inviteMember(activeWorkspaceId, inviteEmail.trim(), userId);
      setInviteEmail("");
      await refreshMembersAndInvites(activeWorkspaceId);
      toastSuccess(
        lang === "ko"
          ? "초대를 보냈습니다. 상대방 앱의 초대 목록에서 수락할 수 있습니다."
          : "Invite sent. The recipient can accept it from their invite inbox.",
      );
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
            ? `현재 워크스페이스 정원(${guard.memberCount}/${guard.seatLimit}명)이 가득 찼습니다.`
            : `Seat limit reached (${guard.memberCount}/${guard.seatLimit}).`,
        );
        openBilling();
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
      setMyInvites((prev) => prev.filter((item) => item.id !== inv.id));
      await refreshWorkspaces();
      selectWorkspace(inv.workspace_id);
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

  const openSync = (action: "push" | "pull") => {
    if (!activeWorkspaceId) {
      toastError(lang === "ko" ? "먼저 워크스페이스를 선택하세요." : "Select a workspace first.");
      return;
    }
    if (!guard.canSync) {
      toastError(
        lang === "ko" ? "구독 결제가 만료되어 동기화가 제한되었습니다." : "Sync is locked due to expired subscription.",
      );
      openBilling();
      return;
    }
    setSyncAction(action);
    openPanel("sync");
  };

  const handleExecuteSync = async (options: WorkspaceSyncOptions) => {
    if (!userId || !activeWorkspaceId) {
      return;
    }
    const action = syncAction;
    setSyncing(action);
    try {
      if (action === "push") {
        await pushWorkspaceSync(activeWorkspaceId, userId, options);
        toastSuccess(
          lang === "ko"
            ? "팀 워크스페이스에 선택한 설정을 동기화(업로드)했습니다."
            : "Pushed selected settings to workspace.",
        );
      } else {
        await pullWorkspaceSync(activeWorkspaceId, options);
        toastSuccess(
          lang === "ko"
            ? "팀 워크스페이스에서 선택한 설정을 동기화(가져오기)했습니다."
            : "Pulled selected settings from workspace.",
        );
      }
      closeLastPanel();
    } catch (e: unknown) {
      console.error("handleExecuteSync:", e);
      const errMsg = (e as { message?: string })?.message;
      toastError(lang === "ko" ? `동기화 실패: ${errMsg || "오류 발생"}` : `Sync failed: ${errMsg || "Unknown error"}`);
    } finally {
      setSyncing(null);
    }
  };

  return {
    lang: lang === "en" ? ("en" as const) : ("ko" as const),
    userId,
    supaProfile,
    workspaces,
    members,
    invites,
    myInvites,
    loading,
    newWorkspaceName,
    setNewWorkspaceName,
    creating,
    inviteEmail,
    setInviteEmail,
    inviting,
    syncing,
    inviteToken,
    setInviteToken,
    accepting,
    processingInviteId,
    copiedToken,
    activeWorkspaceId,
    activeWorkspace,
    guard,
    ownedWorkspaces,
    unlimited,
    hasReachedFreeWorkspaceLimit,
    activeIsPro,
    planBadge,
    panels,
    syncAction,
    selectWorkspace,
    clearWorkspaceSelection,
    openPanel,
    closeLastPanel,
    handleEscape,
    handleCheckout,
    openBilling,
    handleCreateWorkspace,
    handleInvite,
    handleCreateShareableInvite,
    handleRevokeInvite,
    handleCopyToken,
    handleAcceptMyInvite,
    handleDeclineMyInvite,
    handleAcceptInvite,
    openSync,
    handleExecuteSync,
  };
}

export type TeamWorkspaceController = ReturnType<typeof useTeamWorkspace>;
