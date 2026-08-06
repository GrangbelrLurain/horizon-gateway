import type { DBProfile } from "@/entities/app";
import type { WorkspacePlan } from "../types";

export type TeamEntitlement = "pro" | "unlimited" | null;

/** Effective personal entitlement from profiles.team_entitlement (owner bypass). */
export function getTeamEntitlement(profile: DBProfile | null | undefined): TeamEntitlement {
  const value = profile?.team_entitlement;
  if (value === "pro" || value === "unlimited") {
    return value;
  }
  return null;
}

export function hasProAccess(profile: DBProfile | null | undefined, workspacePlan?: WorkspacePlan | null): boolean {
  const entitlement = getTeamEntitlement(profile);
  if (entitlement === "pro" || entitlement === "unlimited") {
    return true;
  }
  return workspacePlan === "pro";
}

export function isUnlimitedTeam(profile: DBProfile | null | undefined): boolean {
  return getTeamEntitlement(profile) === "unlimited";
}
