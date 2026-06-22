import { X } from "lucide-react";
import { createContext, useContext, useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";

interface ModalContextProps {
  onClose: () => void;
}

const ModalContext = createContext<ModalContextProps | undefined>(undefined);

function useModalContext() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("Modal components must be used within a Modal provider");
  }
  return context;
}

interface ModalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "full";
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  full: "max-w-[95vw]",
};

export function Modal({ children, isOpen, onClose, size = "xl" }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.xl;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <ModalContext.Provider value={{ onClose }}>
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        className={cn(
          "fixed inset-0 z-100 m-0 hidden h-full w-full max-h-none max-w-none border-0 bg-transparent p-4 open:flex open:items-center open:justify-center sm:p-6 lg:p-8",
          "[&::backdrop]:bg-neutral/60 [&::backdrop]:backdrop-blur-md",
        )}
      >
        <div
          className={cn(
            "relative flex w-full max-h-[90vh] flex-col overflow-hidden",
            "bg-base-100 text-base-content rounded-3xl shadow-[0_32px_128px_rgba(0,0,0,0.4)] border border-base-300/50",
            sizeClass,
          )}
        >
          {children}
        </div>
      </dialog>
    </ModalContext.Provider>
  );
}

Modal.Header = function ModalHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const { onClose } = useModalContext();

  return (
    <div className="px-10 pt-10 pb-5 flex items-start justify-between relative overflow-hidden">
      <div className="flex flex-col gap-1.5 relative z-10">
        <h3 className="text-2xl font-black text-base-content tracking-tighter uppercase leading-none">{title}</h3>
        {description && (
          <p className="text-sm text-base-content/50 font-black uppercase tracking-widest opacity-60">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 relative z-10">
        {children}
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-md btn-circle hover:bg-base-200 transition-colors"
        >
          <X className="w-5 h-5 text-base-content/40 hover:text-base-content transition-colors" />
        </button>
      </div>
    </div>
  );
};

Modal.Body = function ModalBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-10 py-5 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-base-300", className)}>
      {children}
    </div>
  );
};

Modal.Footer = function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-10 py-8 bg-base-200/50 backdrop-blur-sm flex items-center justify-end gap-4 border-t border-base-300/30">
      {children}
    </div>
  );
};
