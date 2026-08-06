import type { DBProfile } from "@/entities/app";
import { getTeamEntitlement, isUnlimitedTeam } from "../lib/entitlement";
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

export function useWorkspaceGuard(
  workspace: Workspace | null,
  members: WorkspaceMember[],
  profile?: DBProfile | null,
): WorkspaceGuardResult {
  const unlimited = isUnlimitedTeam(profile);
  const entitlement = getTeamEntitlement(profile);
  const memberCount = members.length;

  const seatLimit = unlimited ? Number.POSITIVE_INFINITY : (workspace?.seat_limit ?? 3);
  const isSeatFull = unlimited ? false : memberCount >= seatLimit;

  const isPastDue = workspace?.status === "past_due";
  const isCanceled = workspace?.status === "canceled";
  // Owner entitlement bypasses billing lock for personal use / internal accounts
  const isLocked = entitlement ? false : isPastDue || isCanceled;

  return {
    canInvite: !isSeatFull && !isLocked,
    canSync: !isLocked,
    isSeatFull,
    isLocked,
    seatLimit: unlimited ? 9999 : seatLimit,
    memberCount,
  };
}
