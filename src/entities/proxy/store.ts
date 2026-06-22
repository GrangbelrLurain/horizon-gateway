import { atomWithStorage } from "jotai/utils";
import { atomWithBroadcast } from "@/shared/lib/jotai/atomWithBroadcast";
import type { LocalRoute, ProxyStatus } from "./types";

export const localRoutesAtom = atomWithBroadcast<LocalRoute[]>("global-local-routes", []);
export const proxyStatusAtom = atomWithBroadcast<ProxyStatus>("app-proxy-status", null);

export const proxyPortInputAtom = atomWithStorage("watchtower_proxy_port_input", "8888");
export const proxyReverseHttpPortInputAtom = atomWithStorage("watchtower_proxy_reverse_http_port", "");
export const proxyReverseHttpsPortInputAtom = atomWithStorage("watchtower_proxy_reverse_https_port", "");
export const setupDismissedAtom = atomWithStorage("watchtower-setup-dismissed", false);

/** @deprecated use localRoutesAtom */
export const globalLocalRoutesAtom = localRoutesAtom;
