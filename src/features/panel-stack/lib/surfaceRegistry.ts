import { type ComponentType, type LazyExoticComponent, lazy } from "react";
import type { HubSurfaceId } from "../types";

export type SurfaceTitleKey =
  | "infrastructure"
  | "settings"
  | "addDomain"
  | "manageGroups"
  | "profile"
  | "toolsPipeline"
  | "toolsCrypto"
  | "toolsPreview"
  | "toolsApiClient"
  | "toolsJsonSchema"
  | "toolsServerLogs"
  | "apiLogs"
  | "apiMocking"
  | "apiSchema";

export interface SurfaceRegistryEntry {
  id: HubSurfaceId;
  titleKey: SurfaceTitleKey;
  route: string;
  detachWidth: number;
  detachHeight: number;
  kind: "chrome" | "global";
  Component: LazyExoticComponent<ComponentType> | ComponentType;
}

const ChromeInfrastructure = lazy(() =>
  import("../ui/surfaces/ChromeInfrastructureSurface").then((m) => ({ default: m.ChromeInfrastructureSurface })),
);
const ChromeSettings = lazy(() =>
  import("../ui/surfaces/ChromeSettingsSurface").then((m) => ({ default: m.ChromeSettingsSurface })),
);
const ChromeGroups = lazy(() =>
  import("../ui/surfaces/ChromeGroupsSurface").then((m) => ({ default: m.ChromeGroupsSurface })),
);
const ChromeAddDomain = lazy(() =>
  import("../ui/surfaces/ChromeAddDomainSurface").then((m) => ({ default: m.ChromeAddDomainSurface })),
);
const ChromeProfile = lazy(() =>
  import("../ui/surfaces/ChromeProfileSurface").then((m) => ({ default: m.ChromeProfileSurface })),
);
const GlobalPipeline = lazy(() =>
  import("../ui/surfaces/GlobalPipelineSurface").then((m) => ({ default: m.GlobalPipelineSurface })),
);
const GlobalCrypto = lazy(() =>
  import("../ui/surfaces/GlobalCryptoSurface").then((m) => ({ default: m.GlobalCryptoSurface })),
);
const GlobalJsonSchema = lazy(() =>
  import("../ui/surfaces/GlobalJsonSchemaSurface").then((m) => ({ default: m.GlobalJsonSchemaSurface })),
);
const GlobalSchemaExplorer = lazy(() =>
  import("../ui/surfaces/GlobalSchemaExplorerSurface").then((m) => ({ default: m.GlobalSchemaExplorerSurface })),
);
const GlobalRoutePage = lazy(() =>
  import("../ui/surfaces/GlobalRoutePageSurface").then((m) => ({ default: m.GlobalRoutePageSurface })),
);

export const SURFACE_REGISTRY: Record<HubSurfaceId, SurfaceRegistryEntry> = {
  "chrome/infrastructure": {
    id: "chrome/infrastructure",
    titleKey: "infrastructure",
    route: "/popup/infrastructure",
    detachWidth: 520,
    detachHeight: 680,
    kind: "chrome",
    Component: ChromeInfrastructure,
  },
  "chrome/settings": {
    id: "chrome/settings",
    titleKey: "settings",
    route: "/popup/settings",
    detachWidth: 720,
    detachHeight: 820,
    kind: "chrome",
    Component: ChromeSettings,
  },
  "chrome/groups": {
    id: "chrome/groups",
    titleKey: "manageGroups",
    route: "/popup/groups",
    detachWidth: 640,
    detachHeight: 600,
    kind: "chrome",
    Component: ChromeGroups,
  },
  "chrome/add-domain": {
    id: "chrome/add-domain",
    titleKey: "addDomain",
    route: "/popup/add-domain",
    detachWidth: 480,
    detachHeight: 520,
    kind: "chrome",
    Component: ChromeAddDomain,
  },
  "chrome/profile": {
    id: "chrome/profile",
    titleKey: "profile",
    route: "/profile",
    detachWidth: 520,
    detachHeight: 680,
    kind: "chrome",
    Component: ChromeProfile,
  },
  "global/pipeline": {
    id: "global/pipeline",
    titleKey: "toolsPipeline",
    route: "/sandbox/pipeline",
    detachWidth: 1200,
    detachHeight: 800,
    kind: "global",
    Component: GlobalPipeline,
  },
  "global/crypto": {
    id: "global/crypto",
    titleKey: "toolsCrypto",
    route: "/sandbox/crypto",
    detachWidth: 960,
    detachHeight: 720,
    kind: "global",
    Component: GlobalCrypto,
  },
  "global/preview": {
    id: "global/preview",
    titleKey: "toolsPreview",
    route: "/sandbox/preview",
    detachWidth: 1100,
    detachHeight: 760,
    kind: "global",
    Component: GlobalRoutePage,
  },
  "global/api-client": {
    id: "global/api-client",
    titleKey: "toolsApiClient",
    route: "/apis/client",
    detachWidth: 1200,
    detachHeight: 860,
    kind: "global",
    Component: GlobalRoutePage,
  },
  "global/json-schema": {
    id: "global/json-schema",
    titleKey: "toolsJsonSchema",
    route: "/apis/json-schema",
    detachWidth: 1000,
    detachHeight: 760,
    kind: "global",
    Component: GlobalJsonSchema,
  },
  "global/server-logs": {
    id: "global/server-logs",
    titleKey: "toolsServerLogs",
    route: "/server-logs",
    detachWidth: 1000,
    detachHeight: 720,
    kind: "global",
    Component: GlobalRoutePage,
  },
  "global/api-logs": {
    id: "global/api-logs",
    titleKey: "apiLogs",
    route: "/apis/logs",
    detachWidth: 1200,
    detachHeight: 860,
    kind: "global",
    Component: GlobalRoutePage,
  },
  "global/mocking": {
    id: "global/mocking",
    titleKey: "apiMocking",
    route: "/apis/mocking",
    detachWidth: 1200,
    detachHeight: 860,
    kind: "global",
    Component: GlobalRoutePage,
  },
  "global/schema-explorer": {
    id: "global/schema-explorer",
    titleKey: "apiSchema",
    route: "/apis/schema",
    detachWidth: 1100,
    detachHeight: 800,
    kind: "global",
    Component: GlobalSchemaExplorer,
  },
};

export const GLOBAL_TOOL_SURFACES: HubSurfaceId[] = [
  "global/pipeline",
  "global/crypto",
  "global/preview",
  "global/api-client",
  "global/json-schema",
  "global/schema-explorer",
  "global/server-logs",
];

export function getSurfaceEntry(id: HubSurfaceId): SurfaceRegistryEntry {
  return SURFACE_REGISTRY[id];
}
