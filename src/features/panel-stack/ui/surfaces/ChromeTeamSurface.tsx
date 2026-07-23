import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { GlobalRouteEmbed } from "./GlobalRouteEmbed";

export function ChromeTeamSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <GlobalRouteEmbed route="/team" />
    </HubSurfaceEmbedProvider>
  );
}
