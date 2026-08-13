import { atomWithStorage } from "jotai/utils";
import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";

export type CloseBehavior = "ask" | "hide" | "quit";
export type MinimizeBehavior = "ask" | "taskbar" | "tray";

export const closeBehaviorAtom = atomWithBroadcast<CloseBehavior>(
  "horizon-gateway-close-behavior",
  "ask",
  atomWithStorage<CloseBehavior>("horizon-gateway-close-behavior", "ask"),
);

export const minimizeBehaviorAtom = atomWithBroadcast<MinimizeBehavior>(
  "horizon-gateway-minimize-behavior",
  "taskbar",
  atomWithStorage<MinimizeBehavior>("horizon-gateway-minimize-behavior", "taskbar"),
);
