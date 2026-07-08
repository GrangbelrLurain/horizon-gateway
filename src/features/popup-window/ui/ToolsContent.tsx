import { useAtomValue } from "jotai";
import { FileCode, GitBranch, History, Lock, Play, Tv } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { openDetachedWindow } from "@/shared/lib/tauri/openDetachedWindow";
import { popupEn } from "../i18n/en";
import { popupKo } from "../i18n/ko";

const TOOL_WINDOWS: Record<string, { width: number; height: number }> = {
  "/sandbox/pipeline": { width: 1200, height: 800 },
  "/sandbox/crypto": { width: 960, height: 720 },
  "/sandbox/preview": { width: 1100, height: 760 },
  "/apis/client": { width: 1200, height: 860 },
  "/apis/json-schema": { width: 1000, height: 760 },
  "/server-logs": { width: 1000, height: 720 },
};

export function ToolsContent() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;

  const tools = [
    { label: t.toolsPipeline, icon: GitBranch, to: "/sandbox/pipeline" as const },
    { label: t.toolsCrypto, icon: Lock, to: "/sandbox/crypto" as const },
    { label: t.toolsPreview, icon: Tv, to: "/sandbox/preview" as const },
    { label: t.toolsApiClient, icon: Play, to: "/apis/client" as const },
    { label: t.toolsJsonSchema, icon: FileCode, to: "/apis/json-schema" as const },
    { label: t.toolsServerLogs, icon: History, to: "/server-logs" as const },
  ];

  const openTool = (path: string, label: string) => {
    const size = TOOL_WINDOWS[path] ?? { width: 1100, height: 760 };
    void openDetachedWindow(path, label, size.width, size.height);
  };

  return (
    <div className="grid grid-cols-1 gap-2">
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.to}
            type="button"
            onClick={() => openTool(tool.to, tool.label)}
            className="flex items-center gap-3 p-3 rounded-2xl border border-base-300 bg-base-100 hover:border-primary/50 hover:shadow-md transition-all text-left text-base-content cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-base-content">{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
}
