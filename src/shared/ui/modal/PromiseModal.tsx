import { useAtom } from "jotai";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { promiseModalAtom } from "@/shared/store/modals";
import { Button } from "@/shared/ui/button/Button";
import { Modal } from "@/shared/ui/modal/Modal";

const TYPE_CONFIG = {
  info: {
    icon: <Info className="w-10 h-10 text-info" />,
    btnVariant: "primary" as const,
    accentClass: "bg-info/10 text-info",
  },
  success: {
    icon: <CheckCircle2 className="w-10 h-10 text-success" />,
    btnVariant: "primary" as const,
    accentClass: "bg-success/10 text-success",
  },
  warning: {
    icon: <AlertTriangle className="w-10 h-10 text-warning" />,
    btnVariant: "primary" as const,
    accentClass: "bg-warning/10 text-warning",
  },
  danger: {
    icon: <XCircle className="w-10 h-10 text-error" />,
    btnVariant: "danger" as const,
    accentClass: "bg-error/10 text-error",
  },
};

export function PromiseModal() {
  const [modalState, setModalState] = useAtom(promiseModalAtom);

  if (!modalState) {
    return null;
  }

  const { title, message, confirmText = "Confirm", cancelText, type = "info", resolve } = modalState;
  const config = TYPE_CONFIG[type];

  const handleClose = () => {
    setModalState(null);
    resolve(false);
  };

  const handleConfirm = () => {
    setModalState(null);
    resolve(true);
  };

  return (
    <Modal isOpen={true} onClose={handleClose} size="md">
      <Modal.Body className="pt-10 pb-6 flex flex-col items-center text-center">
        <div className={`p-4 rounded-2xl ${config.accentClass} mb-6`}>{config.icon}</div>
        <h3 className="text-2xl font-black text-base-content tracking-tight mb-2">{title}</h3>
        <p className="text-base-content/60 font-medium max-w-sm whitespace-pre-wrap">{message}</p>
      </Modal.Body>
      <Modal.Footer>
        {cancelText && (
          <Button variant="secondary" onClick={handleClose} className="px-6 font-bold">
            {cancelText}
          </Button>
        )}
        <Button
          variant={config.btnVariant}
          onClick={handleConfirm}
          className="px-8 font-black uppercase tracking-widest shadow-lg"
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
