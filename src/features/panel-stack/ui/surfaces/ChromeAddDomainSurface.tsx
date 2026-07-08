import { AddDomainContent } from "@/features/popup-window";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";

export function ChromeAddDomainSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <div className="p-4 overflow-y-auto h-full">
        <AddDomainContent />
      </div>
    </HubSurfaceEmbedProvider>
  );
}
