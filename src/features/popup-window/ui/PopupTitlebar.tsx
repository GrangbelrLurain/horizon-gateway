import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, X } from "lucide-react";
import type { ReactNode } from "react";

const appWindow = getCurrentWindow();

interface PopupTitlebarProps {
  title: string;
  icon?: ReactNode;
  accent?: "indigo" | "emerald" | "amber" | "rose";
}

const ACCENT = {
  indigo: "from-indigo-600 to-violet-600",
  emerald: "from-emerald-600 to-teal-600",
  amber: "from-amber-500 to-orange-500",
  rose: "from-rose-500 to-pink-600",
};

export function PopupTitlebar({ title, icon, accent = "indigo" }: PopupTitlebarProps) {
  return (
    <div className={`shrink-0 bg-gradient-to-r ${ACCENT[accent]} text-white select-none`}>
      <div className="flex items-center h-10">
        <div
          data-tauri-drag-region
          onDoubleClick={() => appWindow.toggleMaximize()}
          className="flex flex-1 items-center gap-2 min-w-0 h-full px-3 cursor-default"
        >
          {icon && <span className="opacity-90 shrink-0 pointer-events-none">{icon}</span>}
          <span className="text-xs font-black tracking-wide truncate pointer-events-none">{title}</span>
        </div>
        <div className="flex items-center h-full shrink-0">
          <button
            type="button"
            data-tauri-drag-region={false}
            onClick={() => appWindow.minimize()}
            className="w-10 h-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            data-tauri-drag-region={false}
            onClick={() => appWindow.close()}
            className="w-10 h-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
