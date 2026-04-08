import { atomWithStorage } from "jotai/utils";

export const proxyNewDomainAtom = atomWithStorage("watchtower_proxy_new_domain", "");
export const proxyNewTargetHostAtom = atomWithStorage("watchtower_proxy_new_target_host", "127.0.0.1");
export const proxyNewTargetPortAtom = atomWithStorage("watchtower_proxy_new_target_port", "3000");
