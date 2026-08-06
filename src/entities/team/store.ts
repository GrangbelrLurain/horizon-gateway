import { atomWithStorage } from "jotai/utils";

export const activeWorkspaceIdAtom = atomWithStorage<string | null>("horizon-gateway-active-workspace-id", null);

/** Unused legacy toggle; sync is always manual from the Team Sync panel. */
export const teamSyncEnabledAtom = atomWithStorage<boolean>("horizon-gateway-team-sync-enabled", false);
