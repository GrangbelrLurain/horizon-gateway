import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { ProxyGraphView } from "./ProxyGraphView";

export function GlobalProxyGraphSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <ProxyGraphView />
    </HubSurfaceEmbedProvider>
  );
}
