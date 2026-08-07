import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { PaletteSession } from "./types";

export const commandPaletteOpenAtom = atom<boolean>(false);

export const paletteQueryAtom = atom<string>("");

export const paletteSessionAtom = atom<PaletteSession | null>(null);

export const paletteStepQueryAtom = atom<string>("");

export const paletteHighlightIndexAtom = atom<number>(0);

export const recentCommandIdsAtom = atomWithStorage<string[]>("hg-palette-recents", []);
