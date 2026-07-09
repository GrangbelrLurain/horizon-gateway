export type PanelId =
  | "overview"
  | "monitor"
  | "proxy"
  | "api"
  | "api/logs"
  | "api/log"
  | "api/mocking"
  | "api/schema"
  | "debug";

export type DomainPanelId = PanelId;

export type HubSurfaceId =
  | "chrome/infrastructure"
  | "chrome/settings"
  | "chrome/groups"
  | "chrome/add-domain"
  | "chrome/profile"
  | "global/pipeline"
  | "global/crypto"
  | "global/preview"
  | "global/api-client"
  | "global/json-schema"
  | "global/server-logs"
  | "global/api-logs"
  | "global/mocking"
  | "global/schema-explorer"
  | "global/proxy-graph";

const VALID_SURFACE_IDS: HubSurfaceId[] = [
  "chrome/infrastructure",
  "chrome/settings",
  "chrome/groups",
  "chrome/add-domain",
  "chrome/profile",
  "global/pipeline",
  "global/crypto",
  "global/preview",
  "global/api-client",
  "global/json-schema",
  "global/server-logs",
  "global/api-logs",
  "global/mocking",
  "global/schema-explorer",
  "global/proxy-graph",
];

export function parseHubSurfaceId(value: string | undefined): HubSurfaceId | null {
  if (!value) {
    return null;
  }
  return VALID_SURFACE_IDS.includes(value as HubSurfaceId) ? (value as HubSurfaceId) : null;
}

export function isChromeSurface(id: HubSurfaceId): boolean {
  return id.startsWith("chrome/");
}

export interface PanelEntry {
  id: PanelId;
  params?: Record<string, string>;
}

export interface HubSearchParams {
  d?: number;
  p?: string;
  logId?: string;
  g?: string;
}

export const TOP_LEVEL_PANELS: PanelId[] = ["overview", "monitor", "proxy", "api", "debug"];

export function parsePanelId(value: string | undefined): PanelId | null {
  if (!value) {
    return null;
  }
  const valid: PanelId[] = [
    "overview",
    "monitor",
    "proxy",
    "api",
    "api/logs",
    "api/log",
    "api/mocking",
    "api/schema",
    "debug",
  ];
  return valid.includes(value as PanelId) ? (value as PanelId) : null;
}

export function panelIdToPath(panel: PanelEntry): string {
  if (panel.id === "api/log" && panel.params?.logId) {
    return `api/log?logId=${panel.params.logId}`;
  }
  return panel.id;
}

export function buildPanelsFromSearch(
  d?: number,
  p?: string,
  logId?: string,
): { domainId: number | null; panels: PanelEntry[] } {
  if (!d) {
    return { domainId: null, panels: [] };
  }

  const panelId = parsePanelId(p) ?? "overview";

  if (panelId === "overview") {
    return { domainId: d, panels: [{ id: "overview" }] };
  }

  if (panelId === "api/log") {
    if (logId) {
      return {
        domainId: d,
        panels: [{ id: "overview" }, { id: "api/logs" }, { id: "api/log", params: { logId } }],
      };
    }
    return { domainId: d, panels: [{ id: "overview" }, { id: "api/logs" }] };
  }

  if (panelId.startsWith("api/")) {
    return { domainId: d, panels: [{ id: "overview" }, { id: panelId }] };
  }

  return { domainId: d, panels: [{ id: "overview" }, { id: panelId }] };
}
