import { emit } from "@tauri-apps/api/event";

export const HUB_DATA_CHANGED = "hub-data-changed";

export type HubDataChangedReason = "domains" | "groups" | "routes" | "features";

export async function notifyHubDataChanged(reason?: HubDataChangedReason): Promise<void> {
  await emit(HUB_DATA_CHANGED, { reason });
}
