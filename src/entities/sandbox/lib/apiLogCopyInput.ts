import type { ApiLogEntry } from "@/shared/api";
import type { ApiExchangeCopyInput } from "./copyApiExchange";

export type ApiLogCopyFieldLabels = {
  requestHeaders: string;
  requestBody: string;
  responseHeaders: string;
  responseBody: string;
};

export function apiLogEntryToCopyInput(log: ApiLogEntry, labels: ApiLogCopyFieldLabels): ApiExchangeCopyInput {
  return {
    method: log.method,
    url: log.url,
    requestHeaders: log.request_headers ?? {},
    requestBody: log.request_body,
    timestamp: log.timestamp,
    labels,
    response: {
      statusCode: log.status_code ?? 0,
      headers: log.response_headers ?? {},
      body: log.response_body ?? "",
      elapsedMs: null,
    },
  };
}
