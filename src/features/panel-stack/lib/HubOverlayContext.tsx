import { createContext, type RefObject, useContext } from "react";

const HubOverlayContainerContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function HubOverlayProvider({
  containerRef,
  children,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return <HubOverlayContainerContext.Provider value={containerRef}>{children}</HubOverlayContainerContext.Provider>;
}

export function useHubOverlayContainer() {
  return useContext(HubOverlayContainerContext);
}
