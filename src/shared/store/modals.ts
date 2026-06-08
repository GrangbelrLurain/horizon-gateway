import { atom } from "jotai";
import type { ApiLogEntry } from "@/shared/api";

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

export interface PromiseModalState {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "info" | "success" | "warning" | "danger";
  resolve: (value: boolean) => void;
}

export const promiseModalAtom = atom<PromiseModalState | null>(null);
