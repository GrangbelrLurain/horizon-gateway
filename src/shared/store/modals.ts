import { atom } from "jotai";
import type { ApiLogEntry } from "@/entities/proxy/types/local_route";

export interface CreateMockModalState {
  isOpen: boolean;
  logData: ApiLogEntry | null;
  onSuccess?: () => void;
}

export const createMockModalAtom = atom<CreateMockModalState>({
  isOpen: false,
  logData: null,
});

export interface ScenarioModalState {
  isOpen: boolean;
  onSuccess?: (scenarioId: string) => void;
}

export const scenarioModalAtom = atom<ScenarioModalState>({
  isOpen: false,
});
