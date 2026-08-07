import clsx from "clsx";
import type React from "react";

interface PaletteItemProps {
  id: string;
  icon?: React.ReactNode;
  label: string;
  description?: string;
  isSelected: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  kbdHint?: string;
}

export function PaletteItem({
  icon,
  label,
  description,
  isSelected,
  onSelect,
  onMouseEnter,
  kbdHint,
}: PaletteItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      aria-selected={isSelected}
      className={clsx(
        "flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer select-none",
        isSelected ? "bg-primary/15 text-primary font-semibold" : "text-base-content hover:bg-base-200/60",
      )}
    >
      {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{label}</div>
        {description && <div className="truncate text-[10px] opacity-60 font-normal">{description}</div>}
      </div>
      {kbdHint && (
        <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-base-200 border border-base-300 text-[10px] font-mono text-base-content/60">
          {kbdHint}
        </kbd>
      )}
    </button>
  );
}
