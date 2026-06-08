/**
 * Global app status store
 * Tracks prerequisites like domain count and proxy status
 * so any page can react to whether key features are available.
 */
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { commands, unwrap } from "@/shared/api";

import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";

// ─── Atoms ────────────────────────────────────────────────────────────────────

export const domainCountAtom = atomWithBroadcast<number | null>("app-domain-count", null);
export const apiLoggingCountAtom = atomWithBroadcast<number | null>("app-api-logging-count", null);
export const proxyRunningAtom = atomWithBroadcast<boolean | null>("app-proxy-running", null);
export const proxyLocalRoutingEnabledAtom = atomWithBroadcast<boolean | null>("app-proxy-local-routing", null);
export const proxyMockingEnabledAtom = atomWithBroadcast<boolean | null>(
  "app-proxy-mocking-enabled",
  null,
  atomWithStorage("watchtower-proxy-mocking-enabled", null as boolean | null),
);
export const proxyInspectorEnabledAtom = atomWithBroadcast<boolean | null>(
  "app-proxy-inspector-enabled",
  null,
  atomWithStorage("watchtower-proxy-inspector-enabled", null as boolean | null),
);
export const appStatusLoadingAtom = atom(false);
export const appStatusLoadedAtom = atom(false);

export const proxyPortInputAtom = atomWithStorage("watchtower_proxy_port_input", "8888");
export const proxyReverseHttpPortInputAtom = atomWithStorage("watchtower_proxy_reverse_http_port", "");
export const proxyReverseHttpsPortInputAtom = atomWithStorage("watchtower_proxy_reverse_https_port", "");

/** Persistent flag: set to true when user dismisses the setup guide or completes it once */
export const setupDismissedAtom = atomWithStorage("watchtower-setup-dismissed", false);

// ─── Derived atoms ────────────────────────────────────────────────────────────

/** True only when we know there are 0 domains */
export const hasNoDomainAtom = atom((get) => {
  const count = get(domainCountAtom);
  return count !== null && count === 0;
});

/** True when domains exist but none have API logging enabled */
export const hasNoApiLoggingAtom = atom((get) => {
  const domainCount = get(domainCountAtom);
  const loggingCount = get(apiLoggingCountAtom);
  return domainCount !== null && domainCount > 0 && loggingCount !== null && loggingCount === 0;
});

/** Proxy is considered 'Active' only if it is running AND local routing is enabled */
export const proxyActiveAtom = atom((get) => {
  const running = get(proxyRunningAtom);
  const localEnabled = get(proxyLocalRoutingEnabledAtom);
  return !!(running && localEnabled);
});

/**
 * Loader function — call once at app root to populate status atoms.
 * Returns a cleanup function.
 */
export async function loadAppStatus(
  setDomainCount: (n: number) => void,
  setApiLoggingCount: (n: number) => void,
  setProxyRunning: (b: boolean) => void,
  setProxyLocalRouting: (b: boolean) => void,
  setProxyMockingEnabled: (b: boolean) => void,
  setProxyInspectorEnabled: (b: boolean) => void,
) {
  try {
    const [domainsRes, linksRes, proxyRes, mockingRes, inspectorRes] = await Promise.all([
      commands.getDomains().then(unwrap),
      commands.getDomainApiLoggingLinks().then(unwrap),
      commands.getProxyStatus().then(unwrap),
      commands.getMockingStatus().then(unwrap),
      commands.getGlobalInspectorEnabled().then(unwrap),
    ]);
    if (domainsRes.success) {
      setDomainCount((domainsRes.data ?? []).length);
    }
    if (linksRes.success) {
      setApiLoggingCount((linksRes.data ?? []).length);
    }
    if (proxyRes.success && proxyRes.data) {
      setProxyRunning(proxyRes.data.running ?? false);
      setProxyLocalRouting(proxyRes.data.local_routing_enabled ?? false);
    }
    if (mockingRes.success && mockingRes.data) {
      setProxyMockingEnabled(mockingRes.data.enabled ?? false);
    }
    if (inspectorRes?.success) {
      setProxyInspectorEnabled(inspectorRes.data);
    }
  } catch (e) {
    console.error("loadAppStatus:", e);
  }
}
