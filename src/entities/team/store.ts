import { atomWithStorage } from "jotai/utils";

export const activeWorkspaceIdAtom = atomWithStorage<string | null>("horizon-gateway-active-workspace-id", null);

/** MVP-level toggle; actual push/pull is triggered manually from `TeamSection` for now. */
export const teamSyncEnabledAtom = atomWithStorage<boolean>("horizon-gateway-team-sync-enabled", false);
