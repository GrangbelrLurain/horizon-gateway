import { type ReactNode, useCallback } from "react";
import type { ApiLogEntry } from "@/shared/api";
import { Badge } from "@/shared/ui/badge/badge";
import { apiLogEntryToCopyInput } from "../lib/apiLogCopyInput";
import type { ApiExchangeCopyInput } from "../lib/copyApiExchange";
import { ApiExchangeCopyDropdown, type ApiExchangeCopyDropdownLabels } from "./ApiExchangeCopyDropdown";
import { ApiRequestViewer } from "./ApiRequestViewer";
import { ApiResponseViewer, type ApiResponseViewerProps } from "./ApiResponseViewer";

export interface ApiLogExchangeDetailLabels {
  request: string;
  requestBody: string;
  requestHeaders: string;
  responseBody: string;
  responseHeaders: string;
  status: string;
  time: string;
  empty?: string;
  copy?: string;
  copied?: string;
  btnCopy?: string;
  copyHtml?: string;
  copyMarkdown?: string;
}

export interface ApiLogExchangeDetailProps {
  log: ApiLogEntry;
  labels: ApiLogExchangeDetailLabels;
  actions?: ReactNode;
  responseViewerProps: Omit<ApiResponseViewerProps, "response" | "showMetaBar" | "loading" | "error">;
}

function buildLogCopyInput(log: ApiLogEntry, labels: ApiLogExchangeDetailLabels): ApiExchangeCopyInput {
  return apiLogEntryToCopyInput(log, {
    requestHeaders: labels.requestHeaders,
    requestBody: labels.requestBody,
    responseHeaders: labels.responseHeaders,
    responseBody: labels.responseBody,
  });
}

export function ApiLogExchangeDetail({ log, labels, actions, responseViewerProps }: ApiLogExchangeDetailProps) {
  const copyLabel = labels.copy ?? "Copy";
  const copiedLabel = labels.copied ?? "Copied!";

  const getCopyInput = useCallback(() => buildLogCopyInput(log, labels), [log, labels]);

  const copyDropdownLabels: ApiExchangeCopyDropdownLabels = {
    btnCopy: labels.btnCopy ?? copyLabel,
    copied: copiedLabel,
    copyHtml: labels.copyHtml ?? "Copy HTML",
    copyMarkdown: labels.copyMarkdown ?? "Copy Markdown",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 p-5 bg-base-200/50 rounded-2xl border border-base-300 shadow-inner">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={{ color: "slate", size: "sm" }} className="font-black bg-base-300 text-base-content/80">
                {log.method}
              </Badge>
              <span className="font-mono text-sm font-bold text-base-content break-all leading-tight">{log.url}</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-base-content/40">
              <span className="flex items-center gap-1.5">
                {labels.status}:{" "}
                <b className={(log.status_code ?? 0) >= 400 ? "text-error" : "text-success"}>
                  {log.status_code ?? "-"}
                </b>
              </span>
              <span className="flex items-center gap-1.5">
                {labels.time}: <span className="text-base-content/80">{new Date(log.timestamp).toLocaleString()}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <ApiExchangeCopyDropdown getInput={getCopyInput} labels={copyDropdownLabels} />
            {actions}
          </div>
        </div>
      </div>

      <ApiRequestViewer
        title={labels.request}
        headers={log.request_headers ?? {}}
        body={log.request_body ?? ""}
        labels={{
          body: labels.requestBody,
          headers: labels.requestHeaders,
          empty: labels.empty,
        }}
        enableCopy
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
      />

      <ApiResponseViewer
        {...responseViewerProps}
        loading={false}
        error={null}
        response={{
          statusCode: log.status_code ?? 0,
          headers: log.response_headers ?? {},
          body: log.response_body ?? "",
          elapsedMs: null,
        }}
        showMetaBar={false}
        enableCopy
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
      />
    </div>
  );
}
