import { atom } from "jotai";
import { domainsAtom } from "@/entities/domain";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import { proxyStatusAtom } from "@/entities/proxy";

export const appStatusLoadingAtom = atom(false);
export const appStatusLoadedAtom = atom(false);
export const backendUnavailableAtom = atom<string | null>(null);

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

export const proxyActiveAtom = atom((get) => {
  const status = get(proxyStatusAtom);
  return !!status?.running;
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
