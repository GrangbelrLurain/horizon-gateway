import { atomWithStorage } from "jotai/utils";
import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";

export const mockingEnabledAtom = atomWithBroadcast<boolean | null>(
  "app-proxy-mocking-enabled",
  null,
  atomWithStorage("horizon-gateway-proxy-mocking-enabled", null as boolean | null),
);
