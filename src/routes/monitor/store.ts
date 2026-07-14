import { atomWithStorage } from "jotai/utils";

export const monitorSearchAtom = atomWithStorage("horizon_gateway_monitor_search", "");
export const monitorFilterLevelAtom = atomWithStorage<string[]>("horizon_gateway_monitor_filter_level", []);
