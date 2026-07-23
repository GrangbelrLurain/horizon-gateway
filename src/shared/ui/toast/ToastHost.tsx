import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue } from "jotai";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { dismissToast, type ToastVariant, toastsAtom } from "./toastStore";

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

export function ToastHost() {
  const toasts = useAtomValue(toastsAtom);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      aria-live="polite"
      aria-relevant="additions"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const style = VARIANT_STYLES[item.variant];
          const Icon = style.Icon;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-base-100/95 px-4 py-3 text-base-content shadow-lg backdrop-blur-sm ${style.border}`}
              role="status"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} />
              <p className="flex-1 text-sm font-medium leading-snug text-base-content">{item.message}</p>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle shrink-0 text-base-content/50"
                onClick={() => dismissToast(item.id)}
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
