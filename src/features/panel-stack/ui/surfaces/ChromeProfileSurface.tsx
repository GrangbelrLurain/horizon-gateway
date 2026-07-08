import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { GlobalRouteEmbed } from "./GlobalRouteEmbed";

export function ChromeProfileSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <GlobalRouteEmbed route="/profile" />
    </HubSurfaceEmbedProvider>
  );
}
