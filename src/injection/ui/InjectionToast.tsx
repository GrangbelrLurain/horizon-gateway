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
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.96) 100%)",
        color: "#f8fafc",
        padding: "8px 16px",
        borderRadius: "20px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        border: "1px solid rgba(59, 130, 246, 0.4)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        fontWeight: "600",
        pointerEvents: "auto",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <CheckCircle2 style={{ width: "14px", height: "14px", color: "#34d399", flexShrink: 0 }} />
      <span>{message}</span>
    </div>
  );
}
