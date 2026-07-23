import { useAtom, useAtomValue } from "jotai";
import { CloudDownload, CloudUpload, CreditCard, Loader2, Plus, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { languageAtom, supabaseProfileAtom, supabaseSessionAtom } from "@/entities/app";
import { commands } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { toastError, toastSuccess } from "@/shared/ui/toast";
import { acceptInvite, createWorkspace, inviteMember, listMembers, listWorkspaces } from "../api";
import { activeWorkspaceIdAtom, teamSyncEnabledAtom } from "../store";
import { pullWorkspaceSync, pushWorkspaceSync } from "../sync";
import type { Workspace, WorkspaceMember } from "../types";

const LEMON_CHECKOUT_URL =
  (import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_URL as string | undefined) ||
  "https://delete-horizon.lemonsqueezy.com/checkout/buy/team-mvp";

export function TeamSection() {
  const lang = useAtomValue(languageAtom);
  const session = useAtomValue(supabaseSessionAtom);
  const supaProfile = useAtomValue(supabaseProfileAtom);
  const userId = session?.user?.id ?? null;

  const [activeWorkspaceId, setActiveWorkspaceId] = useAtom(activeWorkspaceIdAtom);
  const [syncEnabled, setSyncEnabled] = useAtom(teamSyncEnabledAtom);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [syncing, setSyncing] = useState<"push" | "pull" | null>(null);
  const [inviteToken, setInviteToken] = useState("");
  const [accepting, setAccepting] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

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

  useEffect(() => {
    if (!activeWorkspaceId) {
      setMembers([]);
      return;
    }
    listMembers(activeWorkspaceId)
      .then(setMembers)
      .catch((e) => console.error("listMembers:", e));
  }, [activeWorkspaceId]);

  const handleCreateWorkspace = async () => {
    if (!userId || !newWorkspaceName.trim()) {
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
    setInviting(true);
    try {
      await inviteMember(activeWorkspaceId, inviteEmail.trim(), userId);
      setInviteEmail("");
      toastSuccess(lang === "ko" ? "초대를 보냈습니다." : "Invite sent.");
    } catch (e) {
      console.error("inviteMember:", e);
      toastError(lang === "ko" ? "초대 전송에 실패했습니다." : "Failed to send invite.");
    } finally {
      setInviting(false);
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
      toastSuccess(lang === "ko" ? "초대를 수락했습니다." : "Invite accepted.");
    } catch (e) {
      console.error("acceptInvite:", e);
      toastError(lang === "ko" ? "초대 수락에 실패했습니다." : "Failed to accept invite.");
    } finally {
      setAccepting(false);
    }
  };

  const handlePush = async () => {
    if (!userId || !activeWorkspaceId || !syncEnabled) {
      return;
    }
    setSyncing("push");
    try {
      await pushWorkspaceSync(activeWorkspaceId, userId);
      toastSuccess(lang === "ko" ? "워크스페이스에 업로드했습니다." : "Pushed to workspace.");
    } catch (e) {
      console.error("pushWorkspaceSync:", e);
      toastError(lang === "ko" ? "업로드에 실패했습니다." : "Push failed.");
    } finally {
      setSyncing(null);
    }
  };

  const handlePull = async () => {
    if (!activeWorkspaceId || !syncEnabled) {
      return;
    }
    setSyncing("pull");
    try {
      await pullWorkspaceSync(activeWorkspaceId);
      toastSuccess(lang === "ko" ? "워크스페이스에서 가져왔습니다." : "Pulled from workspace.");
    } catch (e) {
      console.error("pullWorkspaceSync:", e);
      toastError(lang === "ko" ? "가져오기에 실패했습니다." : "Pull failed.");
    } finally {
      setSyncing(null);
    }
  };

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
          {lang === "ko" ? "워크스페이스 관리" : "Workspace management"}
        </h3>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-base-content/40" />}
      </div>

      <p className="text-xs text-base-content/60 leading-relaxed max-w-2xl">
        {lang === "ko"
          ? "워크스페이스를 만들어 팀원을 초대하고, 도메인/그룹/mock 설정을 공유할 수 있습니다."
          : "Create a workspace to invite teammates and share domains/groups/mock configuration."}
      </p>

      {/* Workspace list + create */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">
            {lang === "ko" ? "내 워크스페이스" : "My Workspaces"}
          </span>
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
                {w.name}
                <span className="ml-2 text-[10px] text-base-content/40 uppercase">{w.status}</span>
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
          <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">
            {lang === "ko" ? "멤버" : "Members"} {activeWorkspace ? `— ${activeWorkspace.name}` : ""}
          </span>
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
          <div className="flex gap-2 mt-1">
            <Input
              type="email"
              placeholder={lang === "ko" ? "이메일로 초대" : "Invite by email"}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={!activeWorkspace}
              className="h-9 text-sm"
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
              <UserPlus className="w-3.5 h-3.5" />
              {lang === "ko" ? "초대" : "Invite"}
            </Button>
          </div>
        </div>
      </div>

      {/* Sync + Checkout */}
      <div className="flex flex-col gap-3 pt-4 border-t border-base-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm cursor-pointer"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              disabled={!activeWorkspace}
            />
            <div>
              <p className="text-sm font-bold text-base-content">
                {lang === "ko" ? "워크스페이스 동기화" : "Workspace Sync"}
              </p>
              <p className="text-[10px] text-base-content/50">
                {lang === "ko"
                  ? "도메인/그룹/mock만 공유합니다. CA·토큰·트래픽 로그는 제외됩니다."
                  : "Shares domains/groups/mocks only. CA, tokens, and traffic logs are excluded."}
              </p>
            </div>
          </div>

          <Button variant="primary" size="sm" className="gap-1.5 shadow-md shadow-primary/10" onClick={handleCheckout}>
            <CreditCard className="w-3.5 h-3.5" />
            {lang === "ko" ? "팀 플랜 결제" : "Upgrade Team Plan"}
          </Button>
        </div>

        {syncEnabled && activeWorkspace && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={handlePush} disabled={syncing !== null}>
              {syncing === "push" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              {lang === "ko" ? "업로드 (Push)" : "Push"}
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={handlePull} disabled={syncing !== null}>
              {syncing === "pull" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudDownload className="w-3.5 h-3.5" />
              )}
              {lang === "ko" ? "가져오기 (Pull)" : "Pull"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-base-200">
        <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">
          {lang === "ko" ? "초대 토큰으로 참가" : "Join with invite token"}
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
          {lang === "ko" ? "로그인:" : "Signed in as:"} {supaProfile.email}
        </p>
      )}
    </div>
  );
}
