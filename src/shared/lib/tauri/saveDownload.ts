import { isTauri } from "@tauri-apps/api/core";

export type SaveTextFilter = {
  name: string;
  extensions: string[];
};

export type SaveTextDownloadResult =
  | { status: "cancelled" }
  | { status: "saved"; path: string }
  /** Browser / non-Tauri: triggered a blob download; no filesystem path available */
  | { status: "browser"; filename: string };

export type SaveTextDownloadOptions = {
  content: string;
  defaultPath: string;
  filters?: SaveTextFilter[];
  /** MIME type for browser blob download. Defaults to text/plain. */
  mimeType?: string;
};

export type SaveTextDownloadStreamOptions = {
  defaultPath: string;
  filters?: SaveTextFilter[];
  mimeType?: string;
  /** Write the file in chunks to avoid holding the full document in memory. */
  write: (appendChunk: (chunk: string) => Promise<void>) => Promise<void>;
};

/**
 * Save text content via native save dialog (Tauri) or browser download fallback.
 */
export async function saveTextDownload(options: SaveTextDownloadOptions): Promise<SaveTextDownloadResult> {
  const { content, defaultPath, filters, mimeType = "text/plain;charset=utf-8" } = options;

  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath,
      filters: filters ?? [{ name: "Text", extensions: ["txt"] }],
    });
    if (!path) {
      return { status: "cancelled" };
    }
    await writeTextFile(path, content);
    return { status: "saved", path };
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = defaultPath;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { status: "browser", filename: defaultPath };
}

/**
 * Stream a large text download (Tauri append writes). Browser falls back to buffering chunks then downloading.
 */
export async function saveTextDownloadStream(options: SaveTextDownloadStreamOptions): Promise<SaveTextDownloadResult> {
  const { defaultPath, filters, mimeType = "text/plain;charset=utf-8", write } = options;

  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath,
      filters: filters ?? [{ name: "Text", extensions: ["txt"] }],
    });
    if (!path) {
      return { status: "cancelled" };
    }

    let first = true;
    await write(async (chunk) => {
      if (first) {
        await writeTextFile(path, chunk);
        first = false;
        return;
      }
      await writeTextFile(path, chunk, { append: true });
    });
    return { status: "saved", path };
  }

  const parts: string[] = [];
  await write(async (chunk) => {
    parts.push(chunk);
  });
  return saveTextDownload({
    content: parts.join(""),
    defaultPath,
    filters,
    mimeType,
  });
}

/** Reveal a saved file in the OS file manager (selects the file when possible). */
export async function revealInFolder(path: string): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}
