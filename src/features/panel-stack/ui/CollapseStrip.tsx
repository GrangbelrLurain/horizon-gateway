import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface CollapseStripProps {
  title: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  /** ChevronRight — expand inline with domain list */
  onPinExpand: () => void;
  /** Tab body click — open overlay preview */
  onOverlay: () => void;
  pinExpandLabel?: string;
  className?: string;
}

export function CollapseStrip({
  title,
  icon: Icon,
  badge,
  onPinExpand,
  onOverlay,
  pinExpandLabel,
  className,
}: CollapseStripProps) {
  return (
    <div
      className={clsx(
        "flex flex-col h-full border-r border-base-300 bg-base-200/50 shrink-0 overflow-hidden w-[50px] min-w-[50px]",
        className,
      )}
    >
      <div className="flex flex-col items-center py-4 shrink-0">
        <button
          type="button"
          className="p-1 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-300 transition-colors"
          aria-label={pinExpandLabel ?? title}
          onClick={(e) => {
            e.stopPropagation();
            onPinExpand();
          }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onOverlay}
        title={title}
        className="flex flex-1 flex-col items-center gap-3 min-h-0 w-full cursor-pointer hover:bg-base-200 transition-colors pb-4"
      >
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-base-300/60 flex items-center justify-center text-base-content/50 shrink-0">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
        {badge}
        <span
          className="flex-1 flex items-center justify-center overflow-hidden text-[10px] font-bold text-base-content/50 uppercase tracking-widest whitespace-nowrap select-none"
          style={{ writingMode: "vertical-lr" }}
        >
          {title}
        </span>
      </button>
    </div>
  );
}
