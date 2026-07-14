import { atomWithStorage } from "jotai/utils";

export const dashboardSearchQueryAtom = atomWithStorage("horizon_gateway_dashboard_search", "");
export const dashboardFilterGroupIdAtom = atomWithStorage<number | 0>("horizon_gateway_dashboard_filter_group", 0);
