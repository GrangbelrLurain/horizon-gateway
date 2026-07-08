import { isTauri } from "@tauri-apps/api/core";
import { commands, unwrap } from "@/shared/api";

export async function openDetachedWindow(path: string, title: string, width = 1200, height = 800): Promise<void> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const label = `detached-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  if (!isTauri()) {
    window.open(normalizedPath, "_blank");
    return;
  }

  const result = await commands.openWindow(label, title, normalizedPath, width, height);
  unwrap(result);
}
