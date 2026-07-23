import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { MonitorManagementView } from "./MonitorManagementView";

export function GlobalMonitorSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <MonitorManagementView />
    </HubSurfaceEmbedProvider>
  );
}
