import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

interface SyncActionBarProps {
  lang: "ko" | "en";
  action: "push" | "pull";
  onActionChange: (action: "push" | "pull") => void;
  disabled?: boolean;
}

export function SyncActionBar({ lang, action, onActionChange, disabled }: SyncActionBarProps) {
  return (
    <div className="shrink-0 px-3 py-2 border-b border-base-300 bg-base-200/40 flex flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
        {lang === "ko" ? "2. 동기화 방향" : "2. Direction"}
      </p>
      <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-lg bg-base-300/40 border border-base-300">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onActionChange("push")}
          className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-bold transition-all ${
            action === "push"
              ? "bg-primary text-primary-content shadow-sm"
              : "text-base-content/55 hover:text-base-content hover:bg-base-200/60"
          } disabled:opacity-40`}
        >
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          Push
          <span className="text-[9px] font-medium opacity-80 hidden tablet:inline">
            {lang === "ko" ? "로컬→서버" : "local→remote"}
          </span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onActionChange("pull")}
          className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-bold transition-all ${
            action === "pull"
              ? "bg-primary text-primary-content shadow-sm"
              : "text-base-content/55 hover:text-base-content hover:bg-base-200/60"
          } disabled:opacity-40`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Pull
          <span className="text-[9px] font-medium opacity-80 hidden tablet:inline">
            {lang === "ko" ? "서버→로컬" : "remote→local"}
          </span>
        </button>
      </div>
    </div>
  );
}
