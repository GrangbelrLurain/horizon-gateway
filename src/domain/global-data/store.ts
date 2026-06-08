import type {
  Domain,
  DomainApiLoggingLink,
  DomainGroup,
  DomainGroupLink,
  DomainMonitorWithUrl,
  DomainStatusLog,
  LocalRoute,
} from "@/shared/api";
import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";

export const globalDomainsAtom = atomWithBroadcast<Domain[]>("global-domains", []);
export const globalGroupsAtom = atomWithBroadcast<DomainGroup[]>("global-groups", []);
export const globalLinksAtom = atomWithBroadcast<DomainGroupLink[]>("global-links", []);
export const globalMonitorLinksAtom = atomWithBroadcast<DomainMonitorWithUrl[]>("global-monitor-links", []);
export const globalApiLoggingLinksAtom = atomWithBroadcast<DomainApiLoggingLink[]>("global-api-logging-links", []);
export const globalLocalRoutesAtom = atomWithBroadcast<LocalRoute[]>("global-local-routes", []);
export const globalSiteCheckAtom = atomWithBroadcast<DomainStatusLog[]>("global-site-check", []);
