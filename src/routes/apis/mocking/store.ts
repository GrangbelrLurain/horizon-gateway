import { atomWithStorage } from "jotai/utils";

export const mockingSearchAtom = atomWithStorage("watchtower-mocking-search", "");
export const selectedScenarioIdAtom = atomWithStorage<string | null>("watchtower-selected-scenario-id", null);
