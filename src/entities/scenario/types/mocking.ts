export interface MockingSettings {
  enabled: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
}

export interface MockRule {
  id: string;
  scenario_id: string;
  host?: string | null;
  method: string;
  url_pattern: string;
  response_status: number;
  response_headers: Record<string, string>;
  response_body: string | null;
  enabled: boolean;
}
