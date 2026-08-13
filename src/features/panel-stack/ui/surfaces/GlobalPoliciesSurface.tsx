import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { PoliciesView } from "./PoliciesView";

export function GlobalPoliciesSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <PoliciesView />
    </HubSurfaceEmbedProvider>
  );
}
