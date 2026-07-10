import type { SaveTextDownloadResult } from "@/shared/lib/tauri/saveDownload";
import { revealInFolder, saveTextDownloadStream } from "@/shared/lib/tauri/saveDownload";
import type { ApiExchangeCopyInput } from "./copyApiExchange";
import {
  type ApiExchangeHtmlExportLabels,
  buildApiExchangesHtmlHead,
  buildApiExchangesHtmlTail,
  buildEntryDataScriptTag,
  buildExportEntry,
  buildExportMeta,
} from "./exportApiExchangesHtml";

export type DownloadApiExchangesHtmlResult = SaveTextDownloadResult;

/**
 * Single-file HTML export.
 * Writes head → per-entry JSON script tags → tail, so the app never holds one giant string,
 * and the browser never JSON.parses all bodies at once (lazy parse on scroll).
 */
export async function downloadApiExchangesHtml(
  inputs: ApiExchangeCopyInput[],
  labels: ApiExchangeHtmlExportLabels,
  filename: string,
): Promise<DownloadApiExchangesHtmlResult> {
  const meta = buildExportMeta(inputs);

  return saveTextDownloadStream({
    defaultPath: filename,
    filters: [{ name: "HTML", extensions: ["html"] }],
    mimeType: "text/html;charset=utf-8",
    write: async (appendChunk) => {
      await appendChunk(buildApiExchangesHtmlHead(meta, labels));
      for (let i = 0; i < inputs.length; i++) {
        await appendChunk(buildEntryDataScriptTag(i, buildExportEntry(inputs[i])));
      }
      await appendChunk(buildApiExchangesHtmlTail(labels));
    },
  });
}

export async function revealDownloadedApiExchangesHtml(path: string): Promise<void> {
  await revealInFolder(path);
}
