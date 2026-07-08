import { useAtomValue } from "jotai";
import { languageAtom } from "@/entities/app";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { useActiveSurfaceId } from "../../lib/ActiveSurfaceContext";
import { getSurfaceEntry } from "../../lib/surfaceRegistry";
import { GlobalRouteEmbed } from "./GlobalRouteEmbed";

export function GlobalRoutePageSurface() {
  const surfaceId = useActiveSurfaceId();
  const lang = useAtomValue(languageAtom);

  const route = surfaceId ? getSurfaceEntry(surfaceId).route : null;

  if (!route) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-base-content/50">
        {lang === "ko" ? "도구를 불러올 수 없습니다" : "Unable to load tool"}
      </div>
    );
  }

  return (
    <HubSurfaceEmbedProvider>
      <GlobalRouteEmbed route={route} />
    </HubSurfaceEmbedProvider>
  );
}
