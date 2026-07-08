import { useAtomValue } from "jotai";
import { ChevronDown, FileCode, GitBranch, Lock, Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { languageAtom } from "@/entities/app";
import type { ApiLogEntry } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { usePanelNavigation } from "../hooks/usePanelNavigation";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { createApiExchangeHandoff } from "../lib/hubHandoff";

interface HandoffMenuProps {
  log: ApiLogEntry;
  domainId: number;
}

function buildHandoff(log: ApiLogEntry, domainId: number, label: string) {
  return createApiExchangeHandoff({
    source: {
      panelId: "api/log",
      domainId,
      logId: log.id,
      label,
    },
    method: log.method,
    url: log.url,
    request: {
      headers: log.request_headers ?? {},
      body: log.request_body,
    },
    response: {
      status: log.status_code ?? 0,
      headers: log.response_headers ?? {},
      body: log.response_body ?? "",
    },
    focus: "response",
  });
}

export function HandoffMenu({ log, domainId }: HandoffMenuProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const nav = usePanelNavigation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const label = `${log.method} ${log.path} → ${log.status_code ?? "?"}`;

  const dispatch = useCallback(
    (target: Parameters<typeof nav.dispatchHandoff>[1]) => {
      const handoff = buildHandoff(log, domainId, label);
      nav.dispatchHandoff(handoff, target);
      setOpen(false);
    },
    [log, domainId, label, nav],
  );

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        className="gap-1.5 h-7 text-[10px] font-bold"
        onClick={() => setOpen((v) => !v)}
      >
        <Send className="w-3 h-3" />
        {t.handoffSend}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label={t.handoffCloseMenu}
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-xl border border-base-300 bg-base-100 shadow-xl py-1">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-base-200 flex items-center gap-2"
              onClick={() => dispatch({ scope: "domain", panelId: "api/mocking", domainId })}
            >
              {t.handoffToMocking}
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-base-200 flex items-center gap-2"
              onClick={() => dispatch({ scope: "global", surfaceId: "global/schema-explorer" })}
            >
              <FileCode className="w-3.5 h-3.5 text-primary" />
              {t.handoffToSchemaExplorer}
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-base-200 flex items-center gap-2"
              onClick={() => dispatch({ scope: "global", surfaceId: "global/json-schema" })}
            >
              <FileCode className="w-3.5 h-3.5 text-primary opacity-60" />
              {t.handoffToJsonSchema}
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-base-200 flex items-center gap-2"
              onClick={() => dispatch({ scope: "global", surfaceId: "global/crypto" })}
            >
              <Lock className="w-3.5 h-3.5 text-primary" />
              {t.handoffToCrypto}
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-base-200 flex items-center gap-2"
              onClick={() => dispatch({ scope: "global", surfaceId: "global/pipeline" })}
            >
              <GitBranch className="w-3.5 h-3.5 text-primary" />
              {t.handoffToPipeline}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
