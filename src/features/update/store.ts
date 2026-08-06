import type { Update } from "@tauri-apps/plugin-updater";
import { atom } from "jotai";

/** Latest available app update from Tauri updater (same-window). */
export const pendingUpdateAtom = atom<Update | null>(null);
