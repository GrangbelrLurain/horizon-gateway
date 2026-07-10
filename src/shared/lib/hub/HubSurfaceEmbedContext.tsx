import { createContext, type ReactNode, useContext, useMemo } from "react";

type HubSurfaceEmbedContextValue = {
  embedded: boolean;
  dismiss?: () => void;
};

const HubSurfaceEmbedContext = createContext<HubSurfaceEmbedContextValue>({ embedded: false });

export function HubSurfaceEmbedProvider({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  const parent = useContext(HubSurfaceEmbedContext);
  const value = useMemo(
    () => ({
      embedded: true,
      dismiss: onDismiss ?? parent.dismiss,
    }),
    [onDismiss, parent.dismiss],
  );

  return <HubSurfaceEmbedContext.Provider value={value}>{children}</HubSurfaceEmbedContext.Provider>;
}

export function useIsHubSurfaceEmbed(): boolean {
  return useContext(HubSurfaceEmbedContext).embedded;
}

export function useHubSurfaceDismiss(): (() => void) | undefined {
  return useContext(HubSurfaceEmbedContext).dismiss;
}
