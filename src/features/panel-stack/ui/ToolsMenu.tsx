import { useAtomValue } from "jotai";
import { FileCode, GitBranch, History, Lock, Play, Tv, Workflow } from "lucide-react";
import { useState } from "react";
import { languageAtom } from "@/entities/app";
import { Button } from "@/shared/ui/button/Button";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { GLOBAL_TOOL_SURFACES } from "../lib/surfaceRegistry";
import type { HubSurfaceId } from "../types";

function surfaceLabel(id: HubSurfaceId, t: typeof ko): string {
  switch (id) {
    case "global/pipeline":
      return t.toolsPipeline;
    case "global/crypto":
      return t.toolsCrypto;
    case "global/preview":
      return t.toolsPreview;
    case "global/api-client":
      return t.toolsApiClient;
    case "global/json-schema":
      return t.toolsJsonSchema;
    case "global/schema-explorer":
      return t.apiSchema;
    case "global/server-logs":
      return t.toolsServerLogs;
    case "global/proxy-graph":
      return t.toolsProxyGraph;
    default:
      return id;
  }
}

function surfaceIcon(id: HubSurfaceId) {
  switch (id) {
    case "global/pipeline":
      return GitBranch;
    case "global/crypto":
      return Lock;
    case "global/preview":
      return Tv;
    case "global/api-client":
      return Play;
    case "global/json-schema":
      return FileCode;
    case "global/schema-explorer":
      return FileCode;
    case "global/server-logs":
      return History;
    case "global/proxy-graph":
      return Workflow;
    default:
      return GitBranch;
  }
}

interface ToolsMenuProps {
  onOpenTool: (id: HubSurfaceId) => void;
}

export function ToolsMenu({ onOpenTool }: ToolsMenuProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
        onClick={() => setOpen((v) => !v)}
      >
        <GitBranch className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t.tools}</span>
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label={t.handoffCloseMenu}
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-xl border border-slate-700 bg-slate-900 shadow-xl py-1">
            {GLOBAL_TOOL_SURFACES.map((id) => {
              const Icon = surfaceIcon(id);
              return (
                <button
                  key={id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                  onClick={() => {
                    onOpenTool(id);
                    setOpen(false);
                  }}
                >
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  {surfaceLabel(id, t)}
                </button>
              );
            })}
            <div className="my-1 border-t border-slate-700" />
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2"
              onClick={() => {
                onOpenTool("global/api-logs");
                setOpen(false);
              }}
            >
              <History className="w-3.5 h-3.5 text-primary" />
              {t.apiLogs}
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2"
              onClick={() => {
                onOpenTool("global/mocking");
                setOpen(false);
              }}
            >
              <Play className="w-3.5 h-3.5 text-primary" />
              {t.apiMocking}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
