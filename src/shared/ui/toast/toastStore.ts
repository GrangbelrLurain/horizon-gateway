import { atom, getDefaultStore } from "jotai";

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

export const toastsAtom = atom<ToastItem[]>([]);

const store = getDefaultStore();

let toastSeq = 0;

export function toast(message: string, variant: ToastVariant = "info", durationMs = 3500): string {
  const id = `toast-${Date.now()}-${++toastSeq}`;
  const item: ToastItem = { id, message, variant, durationMs };
  store.set(toastsAtom, (prev) => [...prev, item]);

  if (durationMs > 0) {
    window.setTimeout(() => {
      dismissToast(id);
    }, durationMs);
  }

  return id;
}

export function toastSuccess(message: string, durationMs?: number) {
  return toast(message, "success", durationMs);
}

export function toastError(message: string, durationMs?: number) {
  return toast(message, "error", durationMs ?? 5000);
}

export function toastInfo(message: string, durationMs?: number) {
  return toast(message, "info", durationMs);
}

export function dismissToast(id: string) {
  store.set(toastsAtom, (prev) => prev.filter((t) => t.id !== id));
}
