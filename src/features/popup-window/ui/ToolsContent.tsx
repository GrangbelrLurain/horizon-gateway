import { useAtomValue } from "jotai";
import { Camera, FileCode, GitBranch, History, Lock, Play, Tv } from "lucide-react";
import { languageAtom } from "@/entities/app";
import { openDetachedHubSurface } from "@/shared/lib/tauri/openHubSurface";
import { popupEn } from "../i18n/en";
import { popupKo } from "../i18n/ko";

const TOOLS: Array<{
  id: string;
  labelKey: keyof typeof popupKo;
  icon: typeof GitBranch;
  width: number;
  height: number;
}> = [
  { id: "global/pipeline", labelKey: "toolsPipeline", icon: GitBranch, width: 1200, height: 800 },
  { id: "global/crypto", labelKey: "toolsCrypto", icon: Lock, width: 960, height: 720 },
  { id: "global/preview", labelKey: "toolsPreview", icon: Tv, width: 1100, height: 760 },
  { id: "global/api-client", labelKey: "toolsApiClient", icon: Play, width: 1200, height: 860 },
  { id: "global/json-schema", labelKey: "toolsJsonSchema", icon: FileCode, width: 1000, height: 760 },
  { id: "global/server-logs", labelKey: "toolsServerLogs", icon: History, width: 1000, height: 720 },
  { id: "global/live-capture", labelKey: "detachedLiveCapture", icon: Camera, width: 1100, height: 760 },
];

export function ToolsContent() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;

  return (
    <div className="grid grid-cols-1 gap-2">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const label = t[tool.labelKey];
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => void openDetachedHubSurface(tool.id, label, tool.width, tool.height)}
            className="flex items-center gap-3 p-3 rounded-2xl border border-base-300 bg-base-100 hover:border-primary/50 hover:shadow-md transition-all text-left text-base-content cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-base-content">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
