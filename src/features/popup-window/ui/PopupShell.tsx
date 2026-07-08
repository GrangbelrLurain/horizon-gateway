import type { ReactNode } from "react";
import { PopupTitlebar } from "./PopupTitlebar";

interface PopupShellProps {
  title: string;
  icon?: ReactNode;
  accent?: "indigo" | "emerald" | "amber" | "rose";
  fullWidth?: boolean;
  children: ReactNode;
}

export function PopupShell({ title, icon, accent = "indigo", fullWidth, children }: PopupShellProps) {
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-base-300 font-sans text-base-content transition-colors duration-300">
      <PopupTitlebar title={title} icon={icon} accent={accent} />
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className={fullWidth ? "h-full min-h-0" : "p-5 max-w-3xl mx-auto"}>{children}</div>
      </div>
    </div>
  );
}
