import { atomWithStorage } from "jotai/utils";

export type AppTheme = "horizon-gateway-light" | "horizon-gateway-dark";

export const themeAtom = atomWithStorage<AppTheme>("horizon-gateway-theme", "horizon-gateway-light");
