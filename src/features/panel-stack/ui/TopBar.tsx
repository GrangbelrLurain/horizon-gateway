import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { Server, Settings, User } from "lucide-react";
import { languageAtom, proxyRunningAtom, WindowControls } from "@/entities/app";
import { Button } from "@/shared/ui/button/Button";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import type { HubSurfaceId } from "../types";
import { ToolsMenu } from "./ToolsMenu";

const appWindow = getCurrentWindow();

interface TopBarProps {
  onOpenInfrastructure: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenGlobalTool: (id: HubSurfaceId) => void;
}

export function TopBar({ onOpenInfrastructure, onOpenProfile, onOpenSettings, onOpenGlobalTool }: TopBarProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const proxyRunning = useAtomValue(proxyRunningAtom);

  return (
    <div className="flex items-center h-10 border-b border-slate-800/50 bg-slate-950 shrink-0 select-none">
      <div className="flex items-center gap-3 px-3 min-w-0 shrink-0">
        <img src="/logo-text.svg" alt="Watchtower" className="h-4 w-auto object-contain shrink-0 pointer-events-none" />
        <button
          type="button"
          data-tauri-drag-region={false}
          onClick={onOpenInfrastructure}
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors",
            proxyRunning
              ? "bg-success/10 text-success border border-success/20"
              : "bg-slate-800 text-slate-400 border border-slate-700",
          )}
        >
          <Server className="w-3 h-3" />
          {proxyRunning ? t.proxyRunning : t.proxyStopped}
        </button>
      </div>

      <div
        data-tauri-drag-region
        onDoubleClick={() => appWindow.toggleMaximize()}
        className="flex-1 h-full min-w-[48px] cursor-default"
      />

      <div className="flex items-center gap-0.5 px-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          data-tauri-drag-region={false}
          className="gap-1.5 h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={onOpenInfrastructure}
        >
          <Server className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.infrastructure}</span>
        </Button>
        <ToolsMenu onOpenTool={onOpenGlobalTool} />
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={onOpenProfile}
        >
          <User className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.profile}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={onOpenSettings}
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.settings}</span>
        </Button>
      </div>

      <WindowControls />
    </div>
  );
}
