import { atomWithStorage } from "jotai/utils";

export const mockingSearchAtom = atomWithStorage("horizon-gateway-mocking-search", "");
export const selectedScenarioIdAtom = atomWithStorage<string | null>("horizon-gateway-selected-scenario-id", null);
