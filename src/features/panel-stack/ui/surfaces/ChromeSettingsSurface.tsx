import { SettingsContent } from "@/features/popup-window";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";

export function ChromeSettingsSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <div className="p-4 overflow-y-auto h-full">
        <SettingsContent />
      </div>
    </HubSurfaceEmbedProvider>
  );
}
