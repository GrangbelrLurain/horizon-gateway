import { type ToastErrorDetails, toast } from "./toastStore";

const COMPACT_MAX = 160;
const reportedErrors = new WeakSet<object>();

export interface ReportErrorOptions {
  /** Compact toast line. Defaults to the extracted error message. */
  title?: string;
  body?: string;
  requestId?: string;
  durationMs?: number;
}

function pickString(value: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return undefined;
}

export function compactErrorLine(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) {
    return "";
  }
  if (line.length <= COMPACT_MAX) {
    return line;
  }
  return `${line.slice(0, COMPACT_MAX - 1)}…`;
}

export function extractErrorDetails(error: unknown): ToastErrorDetails {
  if (error instanceof Error) {
    const extra = error as Error & { body?: unknown; requestId?: unknown; request_id?: unknown };
    return {
      message: error.message.trim() || error.name,
      stack: error.stack,
      body: typeof extra.body === "string" ? extra.body : undefined,
      requestId:
        typeof extra.requestId === "string"
          ? extra.requestId
          : typeof extra.request_id === "string"
            ? extra.request_id
            : undefined,
    };
  }

  if (typeof error === "string") {
    return { message: error.trim() || "Unknown error" };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      message: pickString(record, ["message", "error", "msg"]) ?? String(error),
      stack: pickString(record, ["stack"]),
      body: pickString(record, ["body", "errorBody", "error_body"]),
      requestId: pickString(record, ["requestId", "request_id", "requestID"]),
    };
  }

  return { message: String(error ?? "Unknown error") };
}

export function isIgnorableGlobalError(error: unknown, event?: ErrorEvent): boolean {
  if (event?.filename && /^(chrome|moz|safari)-extension:/i.test(event.filename)) {
    return true;
  }
  if (!error && event && !event.message) {
    return true;
  }
  if (error && typeof error === "object" && reportedErrors.has(error)) {
    return true;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "CancelledError")) {
    return true;
  }

  const message = extractErrorDetails(error ?? event?.message ?? "").message;
  if (!message) {
    return true;
  }
  if (/ResizeObserver loop/i.test(message)) {
    return true;
  }
  if (message === "Script error." || message === "Script error") {
    return true;
  }
  return false;
}

function markReported(error: unknown) {
  if (error && typeof error === "object") {
    reportedErrors.add(error);
  }
}

export function formatErrorDetailsForCopy(details: ToastErrorDetails, title: string): string {
  const lines = [title, "", details.message];
  if (details.requestId) {
    lines.push("", `Request ID: ${details.requestId}`);
  }
  if (details.body) {
    lines.push("", "Response:", details.body);
  }
  if (details.stack) {
    lines.push("", "Stack:", details.stack);
  }
  return lines.join("\n").trim();
}

export function reportError(error: unknown, options?: ReportErrorOptions): string {
  const extracted = extractErrorDetails(error);
  const details: ToastErrorDetails = {
    message: extracted.message,
    stack: extracted.stack,
    body: options?.body ?? extracted.body,
    requestId: options?.requestId ?? extracted.requestId,
  };
  const compact = compactErrorLine(options?.title ?? details.message) || details.message;
  markReported(error);
  console.error(error);
  return toast(compact, "error", options?.durationMs ?? 5000, details);
}

export function installGlobalErrorToasts(): () => void {
  const onError = (event: ErrorEvent) => {
    if (isIgnorableGlobalError(event.error ?? event.message, event)) {
      return;
    }
    reportError(event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (isIgnorableGlobalError(event.reason)) {
      return;
    }
    reportError(event.reason);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
