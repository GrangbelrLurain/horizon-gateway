import { emit } from "@tauri-apps/api/event";

export const HUB_DATA_CHANGED = "hub-data-changed";
export const HUB_HANDOFF = "hub-handoff";

export type HubDataChangedReason = "domains" | "groups" | "routes" | "features";

/** Serializable handoff bus payload — typed at call sites in panel-stack */
export interface HubHandoffEventPayload {
  handoff: unknown;
  target?: unknown;
  /** Per-window id — listeners ignore events they emitted */
  origin: string;
}

const HUB_WINDOW_ORIGIN =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `hub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function getHubWindowOrigin(): string {
  return HUB_WINDOW_ORIGIN;
}

export async function notifyHubDataChanged(reason?: HubDataChangedReason): Promise<void> {
  await emit(HUB_DATA_CHANGED, { reason });
}

export async function notifyHubHandoff(handoff: unknown, target?: unknown): Promise<void> {
  const payload: HubHandoffEventPayload = {
    handoff,
    target,
    origin: HUB_WINDOW_ORIGIN,
  };
  await emit(HUB_HANDOFF, payload);
}
