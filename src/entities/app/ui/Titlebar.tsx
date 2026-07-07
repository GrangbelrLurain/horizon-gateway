import { useLocation } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
import { useSetAtom } from "jotai";
import { ExternalLink, Maximize2, Menu, Minus, Monitor, Square, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { commands, unwrap } from "@/shared/api";
import { useIsDetached } from "@/shared/lib/tauri/useIsDetached";
import { mobileSidebarOpenAtom } from "./store";

const appWindow = getCurrentWindow();

export function Titlebar() {
  const location = useLocation();
  const isDetached = useIsDetached();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const setMobileSidebarOpen = useSetAtom(mobileSidebarOpenAtom);

  const updateState = useCallback(async () => {
    setIsMaximized(await appWindow.isMaximized());
    setIsFullscreen(await appWindow.isFullscreen());
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const current = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!current);
    setIsFullscreen(!current);
  }, []);

  useEffect(() => {
    updateState();

    const unlistenResized = appWindow.onResized(() => updateState());

    const handleF11 = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleF11);

    return () => {
      unlistenResized.then((f) => f());
      window.removeEventListener("keydown", handleF11);
    };
  }, [updateState, toggleFullscreen]);

  if (isFullscreen) {
    return null;
  }

  const openInNewWindow = async () => {
    const pathLabel = location.pathname.replace(/\//g, "-").slice(1) || "dashboard";
    const label = `window-${pathLabel}-${Date.now()}`;
    unwrap(await commands.openWindow(label, `Watchtower - ${pathLabel}`, location.pathname, 1000, 700));
  };

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={() => appWindow.toggleMaximize()}
      className="bg-slate-950 flex items-center justify-between select-none z-110 border-b border-slate-800/50 h-10 shrink-0 backdrop-blur-md bg-opacity-80 cursor-default"
    >
      <div className="flex items-center gap-2 px-3 pointer-events-none">
        {!isDetached && (
          <button
            type="button"
            onClick={() => setMobileSidebarOpen((open) => !open)}
            className="tablet:hidden p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors pointer-events-auto"
            title="Toggle Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <img src="/logo-text.svg" alt="Watchtower" className="h-4 w-auto object-contain shrink-0" />
        {isDetached && (
          <span className="text-[8px] font-bold text-blue-400/80 uppercase tracking-wider ml-1">
            {location.pathname.replace(/\//g, " ").trim() || "Dashboard"}
          </span>
        )}
      </div>

      <div className="flex items-center h-full">
        {!isDetached && (
          <button
            type="button"
            onClick={openInNewWindow}
            title="Open page in new window"
            className="w-12 h-full flex items-center justify-center hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleFullscreen()}
          title="Toggle Fullscreen (F11)"
          className="w-12 h-full flex items-center justify-center hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <Monitor className={clsx("w-3.5 h-3.5", isFullscreen && "text-blue-400")} />
        </button>
        <button
          type="button"
          onClick={() => appWindow.minimize()}
          className="w-12 h-full flex items-center justify-center hover:bg-slate-800 text-slate-400 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => appWindow.toggleMaximize()}
          className="w-12 h-full flex items-center justify-center hover:bg-slate-800 text-slate-400 transition-colors"
        >
          {isMaximized ? <Square className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={() => appWindow.close()}
          className="w-12 h-full flex items-center justify-center hover:bg-rose-600 hover:text-white text-slate-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
