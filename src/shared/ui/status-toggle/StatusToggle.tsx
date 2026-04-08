import clsx from "clsx";
import type React from "react";

interface StatusToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * A premium, unified status toggle button for the Watchtower dashboard.
 * Designed to feel "alive" with hover effects and consistent branding.
 */
export function StatusToggle({ label, checked, onChange, icon, disabled, loading, className }: StatusToggleProps) {
  return (
    <label
      className={clsx(
        "flex items-center gap-3 px-4 py-2 rounded-full text-[10px] sm:text-xs font-black transition-all border shadow-lg shadow-black/5 cursor-pointer active:scale-95 h-10 select-none shrink-0",
        checked
          ? "bg-success/10 text-success border-success/30 hover:bg-success/20 hover:border-success/40"
          : "bg-base-300 text-base-content/40 border-base-content/5 grayscale opacity-70 hover:opacity-100 hover:grayscale-0 hover:bg-base-300/80 hover:border-base-300",
        (disabled || loading) && "opacity-30 cursor-not-allowed scale-100 grayscale pointer-events-none",
        className,
      )}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 animate-spin">
          <svg className="h-full w-full" viewBox="0 0 24 24" aria-label="Loading">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </span>
      ) : icon ? (
        <span className={clsx("w-3.5 h-3.5 transition-colors", checked ? "text-success" : "text-base-content/20")}>
          {icon}
        </span>
      ) : null}
      <span className="uppercase tracking-widest">{label}</span>
      <input
        type="checkbox"
        className="toggle toggle-success toggle-xs"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled || loading}
      />
    </label>
  );
}
