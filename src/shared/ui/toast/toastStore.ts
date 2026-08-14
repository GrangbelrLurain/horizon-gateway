import { atom, getDefaultStore } from "jotai";

export type ToastVariant = "success" | "error" | "info";

export interface ToastErrorDetails {
  message: string;
  stack?: string;
  body?: string;
  requestId?: string;
}

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
  details?: ToastErrorDetails;
}

export const toastsAtom = atom<ToastItem[]>([]);

const store = getDefaultStore();

const MAX_VISIBLE_TOASTS = 5;
const dismissTimers = new Map<string, number>();

let toastSeq = 0;

function toastFingerprint(item: Pick<ToastItem, "variant" | "message" | "details">): string {
  const details = item.details;
  return [
    item.variant,
    item.message,
    details?.message ?? "",
    details?.stack ?? "",
    details?.body ?? "",
    details?.requestId ?? "",
  ].join("\0");
}

function clearDismissTimer(id: string) {
  const timer = dismissTimers.get(id);
  if (timer) {
    window.clearTimeout(timer);
    dismissTimers.delete(id);
  }
}

function scheduleDismiss(id: string, durationMs: number) {
  clearDismissTimer(id);
  if (durationMs <= 0) {
    return;
  }
  const timer = window.setTimeout(() => {
    dismissTimers.delete(id);
    dismissToast(id);
  }, durationMs);
  dismissTimers.set(id, timer);
}

function pushToast(item: ToastItem): string {
  const fingerprint = toastFingerprint(item);
  const existing = store.get(toastsAtom).find((toastItem) => toastFingerprint(toastItem) === fingerprint);
  if (existing) {
    scheduleDismiss(existing.id, item.durationMs);
    return existing.id;
  }

  store.set(toastsAtom, (prev) => {
    const next = [...prev, item];
    if (next.length <= MAX_VISIBLE_TOASTS) {
      return next;
    }
    const dropped = next.slice(0, next.length - MAX_VISIBLE_TOASTS);
    for (const toastItem of dropped) {
      clearDismissTimer(toastItem.id);
    }
    return next.slice(-MAX_VISIBLE_TOASTS);
  });
  scheduleDismiss(item.id, item.durationMs);
  return item.id;
}

export function toast(
  message: string,
  variant: ToastVariant = "info",
  durationMs = 3500,
  details?: ToastErrorDetails,
): string {
  const id = `toast-${Date.now()}-${++toastSeq}`;
  return pushToast({ id, message, variant, durationMs, details });
}

export function toastSuccess(message: string, durationMs?: number) {
  return toast(message, "success", durationMs);
}

export function toastError(message: string, durationMs?: number) {
  return toast(message, "error", durationMs ?? 5000, { message });
}

export function toastInfo(message: string, durationMs?: number) {
  return toast(message, "info", durationMs);
}

export function dismissToast(id: string) {
  clearDismissTimer(id);
  store.set(toastsAtom, (prev) => prev.filter((item) => item.id !== id));
}
