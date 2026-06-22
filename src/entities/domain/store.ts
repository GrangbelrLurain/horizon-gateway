import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";
import type { Domain } from "./types";

export const domainsAtom = atomWithBroadcast<Domain[]>("global-domains", []);
