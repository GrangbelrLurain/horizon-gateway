import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

interface InjectionToastProps {
  message: string | null;
  onClose: () => void;
}

export function InjectionToast({ message, onClose }: InjectionToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(() => {
      onClose();
    }, 2400);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2147483647,
        background: "var(--wt-bg-panel)",
        color: "var(--wt-text-main)",
        padding: "8px 16px",
        borderRadius: "20px",
        boxShadow: "var(--wt-shadow)",
        border: "1px solid var(--wt-border-primary)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        fontWeight: "600",
        pointerEvents: "auto",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <CheckCircle2 style={{ width: "14px", height: "14px", color: "var(--color-success, #34d399)", flexShrink: 0 }} />
      <span>{message}</span>
    </div>
  );
}
