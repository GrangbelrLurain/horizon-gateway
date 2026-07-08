import type { DomainPanelId, HubSurfaceId } from "../types";

export type HubHandoffKind = "api-exchange" | "json";

export interface HandoffSource {
  panelId: DomainPanelId | string;
  domainId?: number;
  logId?: string;
  label: string;
}

export interface ApiExchangeHandoff {
  id: string;
  createdAt: number;
  kind: "api-exchange";
  source: HandoffSource;
  method: string;
  url: string;
  request: { headers: Record<string, string>; body: string | null };
  response: { status: number; headers: Record<string, string>; body: string | null };
  focus: "request" | "response" | "both";
}

export interface JsonPayloadHandoff {
  id: string;
  createdAt: number;
  kind: "json";
  source: HandoffSource;
  payload: string;
  contentType?: string;
}

export type HubHandoff = ApiExchangeHandoff | JsonPayloadHandoff;

export type HandoffTarget =
  | { scope: "domain"; panelId: DomainPanelId; domainId: number }
  | { scope: "global"; surfaceId: HubSurfaceId };

export function createHandoffId(): string {
  return `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createApiExchangeHandoff(
  data: Omit<ApiExchangeHandoff, "id" | "createdAt" | "kind">,
): ApiExchangeHandoff {
  return {
    ...data,
    id: createHandoffId(),
    createdAt: Date.now(),
    kind: "api-exchange",
  };
}
