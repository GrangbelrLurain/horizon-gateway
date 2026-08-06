import { X } from "lucide-react";
import type { ReactNode } from "react";

interface TeamPanelFrameProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose?: () => void;
  widthClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** When false, body does not scroll (child manages scroll). Default true. */
  scrollBody?: boolean;
}

export function TeamPanelFrame({
  title,
  subtitle,
  icon,
  onClose,
  widthClassName = "w-[420px] min-w-[360px] max-w-[480px]",
  children,
  footer,
  scrollBody = true,
}: TeamPanelFrameProps) {
  return (
    <div className={`flex flex-col h-full min-h-0 shrink-0 border-r border-base-300 bg-base-100 ${widthClassName}`}>
      <div className="flex items-center gap-2 h-10 px-3 border-b border-base-300 bg-base-200/80 shrink-0">
        {icon && <span className="text-primary shrink-0">{icon}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-base-content truncate">{title}</p>
          {subtitle && <p className="text-[10px] text-base-content/45 font-medium truncate">{subtitle}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-base-content/40 hover:text-base-content hover:bg-base-200"
            aria-label="Close panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className={`flex-1 min-h-0 p-3 ${scrollBody ? "overflow-y-auto" : "overflow-hidden flex flex-col"}`}>
        {children}
      </div>
      {footer && <div className="shrink-0 border-t border-base-300 p-3 bg-base-100">{footer}</div>}
    </div>
  );
}
