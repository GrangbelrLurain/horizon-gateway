import { atomWithStorage } from "jotai/utils";
import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";

export const inspectorEnabledAtom = atomWithBroadcast<boolean | null>(
  "app-proxy-inspector-enabled",
  null,
  atomWithStorage("watchtower-proxy-inspector-enabled", null as boolean | null),
);
