import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";
import type { DomainGroup, DomainGroupLink } from "./types";

export const groupsAtom = atomWithBroadcast<DomainGroup[]>("global-groups", []);
export const linksAtom = atomWithBroadcast<DomainGroupLink[]>("global-links", []);

/** @deprecated use groupsAtom */
export const globalGroupsAtom = groupsAtom;

/** @deprecated use linksAtom */
export const globalLinksAtom = linksAtom;
