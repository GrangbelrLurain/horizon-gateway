import type { MockRule, Scenario } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";

export const getScenarios = async (): Promise<Scenario[]> => {
  const res = unwrap(await commands.getScenarios());
  return res.data;
};

export const createScenario = async (name: string, description?: string): Promise<Scenario> => {
  const res = unwrap(await commands.createScenario({ name, description: description ?? null }));
  return res.data;
};

export const updateScenario = async (
  id: string,
  name?: string,
  description?: string,
  enabled?: boolean,
): Promise<Scenario> => {
  return unwrap(await commands.updateScenario(id, name ?? null, description ?? null, enabled ?? null));
};

export const setScenarioEnabled = async (id: string, enabled: boolean): Promise<Scenario[]> => {
  return unwrap(await commands.setScenarioEnabled(id, enabled));
};

export const deleteScenario = async (id: string): Promise<boolean> => {
  return unwrap(await commands.deleteScenario(id));
};

export const getMockRules = async (): Promise<MockRule[]> => {
  const res = unwrap(await commands.getMockRules());
  return res.data;
};

export const getMockRulesByScenario = async (scenarioId: string): Promise<MockRule[]> => {
  const res = unwrap(await commands.getMockRulesByScenario({ scenarioId }));
  return res.data;
};

export const createMockRule = async (
  name: string,
  scenarioId: string,
  host: string | null,
  method: string,
  urlPattern: string,
  responseStatus: number,
  responseHeaders: Record<string, string>,
  responseBody: string | null,
  enabled: boolean,
): Promise<MockRule> => {
  const res = unwrap(
    await commands.createMockRule({
      name,
      scenarioId,
      host,
      method,
      urlPattern,
      responseStatus,
      responseHeaders,
      responseBody,
      enabled,
    }),
  );
  return res.data;
};

export const updateMockRule = async (
  id: string,
  name?: string,
  host?: string | null,
  method?: string,
  urlPattern?: string,
  responseStatus?: number,
  responseHeaders?: Record<string, string>,
  responseBody?: string | null,
  enabled?: boolean,
): Promise<MockRule> => {
  const res = unwrap(
    await commands.updateMockRule({
      id,
      name: name ?? null,
      host: host ?? null,
      method: method ?? null,
      urlPattern: urlPattern ?? null,
      responseStatus: responseStatus ?? null,
      responseHeaders: responseHeaders ?? null,
      responseBody: responseBody ?? null,
      enabled: enabled ?? null,
    }),
  );
  return res.data;
};

export const deleteMockRule = async (id: string): Promise<boolean> => {
  return unwrap(await commands.deleteMockRule(id));
};

export const createMockRuleFromLog = async (logDate: string, logId: string, scenarioId: string): Promise<MockRule> => {
  const res = unwrap(
    await commands.createMockRuleFromLog({
      logDate,
      logId,
      scenarioId,
      name: "",
    }),
  );
  return res.data;
};
