import { createContext, type ReactNode, useContext } from "react";

const HubSurfaceEmbedContext = createContext(false);

export function HubSurfaceEmbedProvider({ children }: { children: ReactNode }) {
  return <HubSurfaceEmbedContext.Provider value={true}>{children}</HubSurfaceEmbedContext.Provider>;
}

export function useIsHubSurfaceEmbed(): boolean {
  return useContext(HubSurfaceEmbedContext);
}
