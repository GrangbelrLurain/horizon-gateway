import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";
import type { DomainMonitorWithUrl, DomainStatusLog } from "./types";

export const monitorLinksAtom = atomWithBroadcast<DomainMonitorWithUrl[]>("global-monitor-links", []);
export const siteCheckAtom = atomWithBroadcast<DomainStatusLog[]>("global-site-check", []);
