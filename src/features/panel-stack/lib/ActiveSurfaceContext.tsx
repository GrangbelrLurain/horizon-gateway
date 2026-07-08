import { createContext, useContext } from "react";
import type { HubSurfaceId } from "../types";

const ActiveSurfaceContext = createContext<HubSurfaceId | null>(null);

export function ActiveSurfaceProvider({ surfaceId, children }: { surfaceId: HubSurfaceId; children: React.ReactNode }) {
  return <ActiveSurfaceContext.Provider value={surfaceId}>{children}</ActiveSurfaceContext.Provider>;
}

export function useActiveSurfaceId(): HubSurfaceId | null {
  return useContext(ActiveSurfaceContext);
}
