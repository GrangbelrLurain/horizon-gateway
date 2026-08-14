import { useNavigate } from "@tanstack/react-router";
import { isTauri } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { commands, unwrap } from "@/shared/api";
import { canonicalizeHubSurfaceId } from "@/shared/lib/hub/canonicalizeHubSurfaceId";

export { canonicalizeHubSurfaceId } from "@/shared/lib/hub/canonicalizeHubSurfaceId";

export function useOpenHubSurface() {
  const navigate = useNavigate();

  return useCallback(
    (id: string) => {
      const g = canonicalizeHubSurfaceId(id);
      void navigate({
        to: "/",
        // biome-ignore lint/suspicious/noExplicitAny: TanStack search updater is wider than HubSearchParams
        search: ((prev: Record<string, unknown>) => ({ ...prev, g })) as any,
      });
    },
    [navigate],
  );
}

export async function openDetachedHubSurface(
  id: string,
  title: string,
  width: number,
  height: number,
  extraSearch?: Record<string, string>,
): Promise<void> {
  const g = canonicalizeHubSurfaceId(id);
  const params = new URLSearchParams({ g, ...extraSearch });
  const path = `/?${params.toString()}`;
  const label = `detached-${g.replaceAll("/", "-")}`;

  if (!isTauri()) {
    window.open(path, "_blank");
    return;
  }

  unwrap(await commands.openWindow(label, title, path, width, height));
}
