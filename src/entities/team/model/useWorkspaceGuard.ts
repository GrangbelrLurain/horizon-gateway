import type { Workspace, WorkspaceMember } from "../types";

export interface WorkspaceGuardResult {
  /** Member invitation is allowed (under seat limit & active) */
  canInvite: boolean;
  /** Workspace sync is allowed (active) */
  canSync: boolean;
  /** Whether the member limit has been reached */
  isSeatFull: boolean;
  /** Whether the workspace is locked (past_due or canceled) */
  isLocked: boolean;
  /** Max seat count for this workspace */
  seatLimit: number;
  /** Current active member count */
  memberCount: number;
}

export function useWorkspaceGuard(workspace: Workspace | null, members: WorkspaceMember[]): WorkspaceGuardResult {
  const seatLimit = workspace?.seat_limit ?? 3;
  const memberCount = members.length;
  const isSeatFull = memberCount >= seatLimit;
  const isPastDue = workspace?.status === "past_due";
  const isCanceled = workspace?.status === "canceled";
  const isLocked = isPastDue || isCanceled;

  return {
    canInvite: !isSeatFull && !isLocked,
    canSync: !isLocked,
    isSeatFull,
    isLocked,
    seatLimit,
    memberCount,
  };
}
