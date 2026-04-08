import { invoke } from "@tauri-apps/api/core";
import type { MockRule, Scenario } from "../../entities/scenario/types/mocking";

export const getScenarios = (): Promise<Scenario[]> => {
  return invoke("get_scenarios");
};

export const createScenario = (name: string, description?: string): Promise<Scenario> => {
  return invoke("create_scenario", { name, description });
};

export const updateScenario = (id: string, name?: string, description?: string): Promise<Scenario> => {
  return invoke("update_scenario", { id, name, description });
};

export const deleteScenario = (id: string): Promise<boolean> => {
  return invoke("delete_scenario", { id });
};

export const getMockRules = (): Promise<MockRule[]> => {
  return invoke("get_mock_rules");
};

export const getMockRulesByScenario = (scenarioId: string): Promise<MockRule[]> => {
  return invoke("get_mock_rules_by_scenario", { scenarioId });
};

export const createMockRule = (
  scenarioId: string,
  host: string | null,
  method: string,
  urlPattern: string,
  responseStatus: number,
  responseHeaders: Record<string, string>,
  responseBody: string | null,
  enabled: boolean,
): Promise<MockRule> => {
  return invoke("create_mock_rule", {
    scenarioId,
    host,
    method,
    urlPattern,
    responseStatus,
    responseHeaders,
    responseBody,
    enabled,
  });
};

export const updateMockRule = (
  id: string,
  host?: string | null,
  method?: string,
  urlPattern?: string,
  responseStatus?: number,
  responseHeaders?: Record<string, string>,
  responseBody?: string | null,
  enabled?: boolean,
): Promise<MockRule> => {
  return invoke("update_mock_rule", {
    id,
    host,
    method,
    urlPattern,
    responseStatus,
    responseHeaders,
    responseBody,
    enabled,
  });
};

export const deleteMockRule = (id: string): Promise<boolean> => {
  return invoke("delete_mock_rule", { id });
};

export const createMockRuleFromLog = (logDate: string, logId: string, scenarioId: string): Promise<MockRule> => {
  return invoke("create_mock_rule_from_log", { logDate, logId, scenarioId });
};
