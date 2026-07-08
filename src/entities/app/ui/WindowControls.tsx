import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
import { Maximize2, Minus, Square, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const appWindow = getCurrentWindow();

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  const updateState = useCallback(async () => {
    setIsMaximized(await appWindow.isMaximized());
  }, []);

  useEffect(() => {
    void updateState();
    const unlisten = appWindow.onResized(() => updateState());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [updateState]);

  return (
    <div className="flex items-center h-full shrink-0">
      <button
        type="button"
        data-tauri-drag-region={false}
        onClick={() => appWindow.minimize()}
        className="w-11 h-full flex items-center justify-center hover:bg-slate-800 text-slate-400 transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        data-tauri-drag-region={false}
        onClick={() => appWindow.toggleMaximize()}
        className="w-11 h-full flex items-center justify-center hover:bg-slate-800 text-slate-400 transition-colors"
      >
        {isMaximized ? <Square className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
      </button>
      <button
        type="button"
        data-tauri-drag-region={false}
        onClick={() => appWindow.close()}
        className={clsx(
          "w-11 h-full flex items-center justify-center hover:bg-rose-600 hover:text-white text-slate-400 transition-colors",
        )}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
