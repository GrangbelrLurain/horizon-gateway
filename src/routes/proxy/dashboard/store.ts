import { atomWithStorage } from "jotai/utils";

export const proxyNewDomainAtom = atomWithStorage("horizon_gateway_proxy_new_domain", "");
export const proxyNewTargetHostAtom = atomWithStorage("horizon_gateway_proxy_new_target_host", "127.0.0.1");
export const proxyNewTargetPortAtom = atomWithStorage("horizon_gateway_proxy_new_target_port", "3000");
