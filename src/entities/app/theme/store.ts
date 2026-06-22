import { atomWithStorage } from "jotai/utils";

export type AppTheme = "watchtower-light" | "watchtower-dark";

export const themeAtom = atomWithStorage<AppTheme>("watchtower-theme", "watchtower-light");
