import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue } from "jotai";
import { AlertCircle, CheckCircle2, Copy, Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button/Button";
import { Modal } from "@/shared/ui/modal/Modal";
import { formatErrorDetailsForCopy, installGlobalErrorToasts } from "./reportError";
import { type ToastLang, toastChrome } from "./toastChrome";
import { dismissToast, type ToastErrorDetails, type ToastItem, type ToastVariant, toastsAtom } from "./toastStore";

const VARIANT_STYLES: Record<ToastVariant, { border: string; iconClass: string; Icon: typeof Info }> = {
  success: {
    border: "border-success/30",
    iconClass: "text-success",
    Icon: CheckCircle2,
  },
  error: {
    border: "border-error/30",
    iconClass: "text-error",
    Icon: AlertCircle,
  },
  info: {
    border: "border-info/30",
    iconClass: "text-info",
    Icon: Info,
  },
};

interface ToastHostProps {
  lang?: ToastLang;
}

interface ErrorDetailView {
  title: string;
  details: ToastErrorDetails;
}

function resolveDetails(item: ToastItem): ToastErrorDetails {
  return item.details ?? { message: item.message };
}

export function ToastHost({ lang = "en" }: ToastHostProps) {
  const toasts = useAtomValue(toastsAtom);
  const copy = toastChrome[lang] ?? toastChrome.en;
  const [detailView, setDetailView] = useState<ErrorDetailView | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => installGlobalErrorToasts(), []);

  const openDetails = (item: ToastItem) => {
    setCopied(false);
    setDetailView({ title: item.message, details: resolveDetails(item) });
  };

  const closeDetails = () => {
    setCopied(false);
    setDetailView(null);
  };

  const handleCopy = async () => {
    if (!detailView) {
      return;
    }
    try {
      await navigator.clipboard.writeText(formatErrorDetailsForCopy(detailView.details, copy.errorTitle));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => {
            const style = VARIANT_STYLES[item.variant];
            const Icon = style.Icon;
            const isError = item.variant === "error";
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-base-100/95 px-4 py-3 text-base-content shadow-lg backdrop-blur-sm ${style.border}`}
                role={isError ? "alert" : "status"}
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} />
                <p className="line-clamp-2 flex-1 text-sm font-medium leading-snug text-base-content">{item.message}</p>
                {isError && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs h-6 min-h-6 shrink-0 px-2 font-semibold text-error"
                    onClick={() => openDetails(item)}
                  >
                    {copy.details}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle shrink-0 text-base-content/50"
                  onClick={() => dismissToast(item.id)}
                  aria-label={copy.dismiss}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Modal isOpen={detailView !== null} onClose={closeDetails} size="lg">
        <Modal.Header
          title={copy.errorTitle}
          description={detailView && detailView.title !== detailView.details.message ? detailView.title : undefined}
        />
        <Modal.Body className="space-y-4">
          {detailView && (
            <>
              <DetailBlock label={copy.message} value={detailView.details.message} />
              {detailView.details.requestId && (
                <DetailBlock label={copy.requestId} value={detailView.details.requestId} />
              )}
              {detailView.details.body && <DetailBlock label={copy.body} value={detailView.details.body} />}
              {detailView.details.stack && <DetailBlock label={copy.stack} value={detailView.details.stack} />}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => void handleCopy()}>
            <Copy className="h-3.5 w-3.5" />
            {copied ? copy.copied : copy.copy}
          </Button>
          <Button variant="primary" size="sm" onClick={closeDetails}>
            {copy.close}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 text-left">
      <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">{label}</span>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-base-300 bg-base-200 p-3 text-xs font-mono leading-relaxed text-base-content">
        {value}
      </pre>
    </div>
  );
}
