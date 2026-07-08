import { InfrastructureContent } from "@/features/popup-window";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";

export function ChromeInfrastructureSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <div className="p-4 overflow-y-auto h-full">
        <InfrastructureContent />
      </div>
    </HubSurfaceEmbedProvider>
  );
}
