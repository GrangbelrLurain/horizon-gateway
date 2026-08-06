import { useCallback, useState } from "react";
import {
  deleteMockRuleApi,
  fetchMockRulesApi,
  saveMockRuleApi,
  saveMockRuleFromRequestApi,
  toggleAllMockRulesApi,
  toggleMockRuleApi,
} from "../api/gateway";
import type { MockedApiEntry, MockRule } from "../types";

export function useMockRules() {
  const [backendMockRules, setBackendMockRules] = useState<MockRule[]>([]);
  const [mockedRequests, setMockedRequests] = useState<MockedApiEntry[]>([]);
  const [editingMockRule, setEditingMockRule] = useState<Partial<MockRule> | null>(null);
  const [mockTab, setMockTab] = useState<"edit" | "preview">("edit");

  const fetchMockRules = useCallback(() => {
    fetchMockRulesApi()
      .then((data) => setBackendMockRules(data))
      .catch(() => {});
  }, []);

  const handleToggleMockRule = async (target: string | MockRule | MockedApiEntry, enabledState?: boolean) => {
    if (typeof target === "string") {
      await toggleMockRuleApi(target, enabledState);
    } else {
      const isBackendRule = "url_pattern" in target;
      if (isBackendRule) {
        const nextState = enabledState !== undefined ? enabledState : !(target as MockRule).enabled;
        await toggleMockRuleApi((target as MockRule).id, nextState);
      } else {
        const req = target as MockedApiEntry;
        const nextState = enabledState !== undefined ? enabledState : true;
        await saveMockRuleFromRequestApi(req, nextState);
      }
    }
    fetchMockRules();
  };

  const handleToggleAllMockRules = async (enabled: boolean) => {
    await toggleAllMockRulesApi(enabled);
    fetchMockRules();
  };

  const handleSaveMockRule = async (rule: Partial<MockRule>) => {
    await saveMockRuleApi(rule);
    setEditingMockRule(null);
    fetchMockRules();
  };

  const handleDeleteMockRule = async (id: string) => {
    await deleteMockRuleApi(id);
    fetchMockRules();
  };

  return {
    backendMockRules,
    mockedRequests,
    setMockedRequests,
    editingMockRule,
    setEditingMockRule,
    mockTab,
    setMockTab,
    fetchMockRules,
    handleToggleMockRule,
    handleToggleAllMockRules,
    handleSaveMockRule,
    handleDeleteMockRule,
  };
}
