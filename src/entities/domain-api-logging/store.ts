import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";
import type { DomainApiLoggingLink } from "./types";

export const apiLoggingLinksAtom = atomWithBroadcast<DomainApiLoggingLink[]>("global-api-logging-links", []);

/** @deprecated use apiLoggingLinksAtom */
export const globalApiLoggingLinksAtom = apiLoggingLinksAtom;
