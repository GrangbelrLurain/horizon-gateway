import { SettingsContent } from "@/features/popup-window";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";

export function ChromeSettingsSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <div className="h-full min-h-0 overflow-hidden">
        <SettingsContent />
      </div>
    </HubSurfaceEmbedProvider>
  );
}
