import { GroupsContent } from "@/features/popup-window";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";

export function ChromeGroupsSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <div className="p-4 overflow-y-auto h-full">
        <GroupsContent />
      </div>
    </HubSurfaceEmbedProvider>
  );
}
