import type { ComponentType } from "react";

export type RouteSurfaceLoader = () => Promise<{ default: ComponentType }>;

const loaders = new Map<string, RouteSurfaceLoader>();

export function registerRouteSurface(route: string, loader: RouteSurfaceLoader): void {
  loaders.set(route, loader);
}

export function getRouteSurfaceLoader(route: string): RouteSurfaceLoader | undefined {
  return loaders.get(route);
}

export function hasRouteSurface(route: string): boolean {
  return loaders.has(route);
}
