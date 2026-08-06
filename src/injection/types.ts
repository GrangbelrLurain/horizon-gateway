export interface EditingElement {
  tagName: string;
  selector: string;
  target: HTMLElement;
}

export interface MockedApiEntry {
  id: string;
  url: string;
  method: string;
  ruleName?: string;
  ruleId?: string;
  timestamp: number;
}

export interface ApiTrafficLog {
  id: string;
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
  isMocked: boolean;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}

export interface MockRule {
  id: string;
  name: string;
  scenario_id?: string;
  host?: string;
  method: string;
  url_pattern: string;
  response_status: number;
  response_headers?: Record<string, string>;
  response_body?: string;
  delay_ms?: number;
  enabled: boolean;
}

export interface LocalRoute {
  id: number;
  domain_id: number;
  domain: string;
  target_host: string;
  target_port: number;
  enabled: boolean;
}

export interface GatewayStatus {
  proxy: boolean;
  proxyCount?: number;
  mocking: boolean;
  mockCount?: number;
  logging: boolean;
  inspector?: boolean;
}
