import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useHubOverlayContainer } from "../lib/HubOverlayContext";

interface CollapseOverlayProps {
  open: boolean;
  onClose: () => void;
  widthPx: number;
  ariaLabel?: string;
  children: ReactNode;
}

export function CollapseOverlay({ open, onClose, widthPx, ariaLabel, children }: CollapseOverlayProps) {
  const container = useHubOverlayContainer();

  if (!container?.current) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-40 bg-base-content/20 backdrop-blur-[1px] pointer-events-auto"
            aria-label={ariaLabel}
            onClick={onClose}
          />
          <motion.div
            initial={{ x: -widthPx }}
            animate={{ x: 0 }}
            exit={{ x: -widthPx }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-0 top-0 bottom-0 z-50 shadow-2xl pointer-events-auto"
            style={{ width: widthPx }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    container.current,
  );
}
