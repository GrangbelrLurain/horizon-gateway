import { createFileRoute } from "@tanstack/react-router";
import { ProxyGraphView } from "@/features/panel-stack";
import { useIsHubSurfaceEmbed } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { useIsEmbeddedPage } from "@/shared/lib/tauri/useEmbedMode";

export const Route = createFileRoute("/proxy/connections/")({
  component: ProxyConnectionsPage,
});

function ProxyConnectionsPage() {
  const isEmbedded = useIsEmbeddedPage();
  const isHubEmbed = useIsHubSurfaceEmbed();
  const hideChrome = isEmbedded || isHubEmbed;

  return (
    <div className={`w-full h-full min-h-0 flex flex-col overflow-hidden ${hideChrome ? "" : "p-6 pb-20"}`}>
      <ProxyGraphView />
    </div>
  );
}
