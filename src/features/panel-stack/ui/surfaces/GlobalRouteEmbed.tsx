import { type ComponentType, type LazyExoticComponent, lazy, Suspense } from "react";
import { getRouteSurfaceLoader } from "@/shared/lib/hub/routeSurfaceRegistry";
import { LoadingScreen } from "@/shared/ui/loader/LoadingScreen";

const lazyCache = new Map<string, LazyExoticComponent<ComponentType>>();

function getLazyRouteComponent(route: string): LazyExoticComponent<ComponentType> | null {
  const loader = getRouteSurfaceLoader(route);
  if (!loader) {
    return null;
  }
  let cached = lazyCache.get(route);
  if (!cached) {
    cached = lazy(loader);
    lazyCache.set(route, cached);
  }
  return cached;
}

interface GlobalRouteEmbedProps {
  route: string;
}

export function GlobalRouteEmbed({ route }: GlobalRouteEmbedProps) {
  const LazyPage = getLazyRouteComponent(route);
  if (!LazyPage) {
    return null;
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden p-4">
      <Suspense fallback={<LoadingScreen />}>
        <LazyPage />
      </Suspense>
    </div>
  );
}
