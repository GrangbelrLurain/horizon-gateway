import { atom } from "jotai";
import { domainsAtom } from "@/entities/domain";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import { inspectorEnabledAtom } from "@/entities/inspector";
import { mockingEnabledAtom } from "@/entities/mocking";
import { proxyStatusAtom } from "@/entities/proxy";

export const appStatusLoadingAtom = atom(false);
export const appStatusLoadedAtom = atom(false);

export const domainCountAtom = atom((get) => {
  if (!get(appStatusLoadedAtom)) {
    return null;
  }
  return get(domainsAtom).length;
});

export const apiLoggingCountAtom = atom((get) => {
  if (!get(appStatusLoadedAtom)) {
    return null;
  }
  return get(apiLoggingLinksAtom).length;
});

export const proxyRunningAtom = atom((get) => {
  const status = get(proxyStatusAtom);
  return status === null ? null : status.running;
});

export const proxyLocalRoutingEnabledAtom = atom((get) => {
  const status = get(proxyStatusAtom);
  return status === null ? null : status.local_routing_enabled;
});

/** @deprecated use mockingEnabledAtom from @/entities/mocking */
export const proxyMockingEnabledAtom = mockingEnabledAtom;

/** @deprecated use inspectorEnabledAtom from @/entities/inspector */
export const proxyInspectorEnabledAtom = inspectorEnabledAtom;

export const proxyActiveAtom = atom((get) => {
  const status = get(proxyStatusAtom);
  return !!(status?.running && status?.local_routing_enabled);
});

export const hasNoDomainAtom = atom((get) => {
  const count = get(domainCountAtom);
  return count !== null && count === 0;
});

export const hasNoApiLoggingAtom = atom((get) => {
  const domainCount = get(domainCountAtom);
  const loggingCount = get(apiLoggingCountAtom);
  return domainCount !== null && domainCount > 0 && loggingCount !== null && loggingCount === 0;
});
