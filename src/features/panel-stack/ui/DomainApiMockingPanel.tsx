import { useAtomValue } from "jotai";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { languageAtom, proxyMockingEnabledAtom, proxyRunningAtom, usePromiseModal } from "@/entities/app";
import type { MockRule, Scenario } from "@/entities/mocking";
import * as mockingApi from "@/entities/mocking";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { ConfirmModal } from "@/shared/ui/modal/ConfirmModal";
import { Modal } from "@/shared/ui/modal/Modal";
import { StatusToggle } from "@/shared/ui/status-toggle/StatusToggle";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { useApiExchangeHandoffEffect } from "../hooks/useHubHandoff";
import { usePanelNavigation } from "../hooks/usePanelNavigation";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { HandoffBanner } from "./HandoffBanner";
import { Panel } from "./Panel";

interface DomainApiMockingPanelProps {
  domain: Domain;
  onClose: () => void;
}

interface RuleForm {
  name: string;
  method: string;
  url_pattern: string;
  response_status: string;
  response_headers: string;
  response_body: string;
  enabled: boolean;
}

const DEFAULT_RULE_FORM: RuleForm = {
  name: "",
  method: "GET",
  url_pattern: "/*",
  response_status: "200",
  response_headers: '{\n  "Content-Type": "application/json"\n}',
  response_body: "{}",
  enabled: true,
};

function matchesHost(rule: MockRule, host: string) {
  return !rule.host || rule.host.toLowerCase().includes(host);
}

export function DomainApiMockingPanel({ domain, onClose }: DomainApiMockingPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const nav = usePanelNavigation();
  const { alert: showAlert } = usePromiseModal();
  const { getDomainHost } = useDomainHubData();
  const host = getDomainHost(domain);
  const mockingEnabled = useAtomValue(proxyMockingEnabledAtom);
  const proxyRunning = useAtomValue(proxyRunningAtom);
  const [rules, setRules] = useState<MockRule[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MockRule | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleForm>(DEFAULT_RULE_FORM);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  const load = useCallback(async () => {
    try {
      const sc = await mockingApi.getScenarios();
      setScenarios(sc);
      setSelectedScenarioId((prev) => prev ?? sc[0]?.id ?? null);
      const allRules: MockRule[] = [];
      for (const s of sc) {
        const r = await mockingApi.getMockRulesByScenario(s.id);
        allRules.push(...r);
      }
      setRules(allRules.filter((r) => matchesHost(r, host)));
    } catch (e) {
      console.error(e);
    }
  }, [host]);

  useEffect(() => {
    void load();
  }, [load]);

  useApiExchangeHandoffEffect(
    useCallback((handoff) => {
      let path = handoff.url;
      try {
        path = new URL(handoff.url).pathname;
      } catch {
        // keep raw url
      }

      setEditingRule(null);
      setRuleForm({
        name: `${handoff.method} ${path}`,
        method: handoff.method,
        url_pattern: path.includes("*") ? path : `${path}*`,
        response_status: String(handoff.response.status || 200),
        response_headers: JSON.stringify(handoff.response.headers ?? { "Content-Type": "application/json" }, null, 2),
        response_body: handoff.response.body ?? "{}",
        enabled: false,
      });
      setIsRuleModalOpen(true);
    }, []),
  );

  const scenarioRules = rules.filter((r) => !selectedScenarioId || r.scenario_id === selectedScenarioId);

  const toggleMocking = async (enabled: boolean) => {
    if (mockingEnabled === null) {
      return;
    }
    setLoading(true);
    try {
      await commands.setMockingEnabled({ enabled }).then(unwrap);
    } catch (e) {
      console.error(e);
      await showAlert(t.errorGeneric, t.saveFailed, "danger");
    } finally {
      setLoading(false);
    }
  };

  const toggleRuleEnabled = async (rule: MockRule, enabled: boolean) => {
    try {
      await mockingApi.updateMockRule(
        rule.id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        enabled,
      );
      await load();
    } catch (e) {
      console.error(e);
      await showAlert(t.errorGeneric, t.mockingSaveFailed, "danger");
    }
  };

  const openRuleModal = (rule?: MockRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({
        name: rule.name,
        method: rule.method,
        url_pattern: rule.url_pattern,
        response_status: String(rule.response_status),
        response_headers: JSON.stringify(rule.response_headers ?? {}, null, 2),
        response_body: rule.response_body ?? "",
        enabled: rule.enabled,
      });
    } else {
      setEditingRule(null);
      setRuleForm(DEFAULT_RULE_FORM);
    }
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!selectedScenarioId) {
      return;
    }
    let headers: Record<string, string> = {};
    try {
      headers = ruleForm.response_headers ? JSON.parse(ruleForm.response_headers) : {};
    } catch {
      await showAlert(t.errorGeneric, t.mockingHeadersInvalid, "warning");
      return;
    }

    setSavingRule(true);
    try {
      if (editingRule) {
        await mockingApi.updateMockRule(
          editingRule.id,
          ruleForm.name,
          host,
          ruleForm.method,
          ruleForm.url_pattern,
          Number(ruleForm.response_status),
          headers,
          ruleForm.response_body,
          ruleForm.enabled,
        );
      } else {
        await mockingApi.createMockRule(
          ruleForm.name,
          selectedScenarioId,
          host,
          ruleForm.method,
          ruleForm.url_pattern,
          Number(ruleForm.response_status),
          headers,
          ruleForm.response_body,
          ruleForm.enabled,
        );
      }
      setIsRuleModalOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      await showAlert(t.errorGeneric, t.mockingSaveFailed, "danger");
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete) {
      return;
    }
    try {
      await mockingApi.deleteMockRule(ruleToDelete);
      await load();
    } catch (e) {
      console.error(e);
      await showAlert(t.errorGeneric, t.mockingSaveFailed, "danger");
    } finally {
      setRuleToDelete(null);
    }
  };

  return (
    <Panel id="api/mocking" title={t.apiMocking} subtitle={host} onClose={onClose} width="lg">
      <div className="space-y-4">
        <HandoffBanner />
        <StatusToggle
          label="Mocking"
          checked={!!mockingEnabled}
          onChange={toggleMocking}
          loading={loading}
          disabled={!proxyRunning}
        />

        {scenarios.length > 0 ? (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-base-content/40">
              {t.mockingScenario}
            </label>
            <select
              className="mt-1 w-full h-8 rounded-lg border border-base-300 bg-base-100 px-2 text-xs"
              value={selectedScenarioId ?? ""}
              onChange={(e) => setSelectedScenarioId(e.target.value || null)}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-xs text-base-content/50">{t.mockingNoScenario}</p>
        )}

        <div className="space-y-2">
          {scenarioRules.length === 0 ? (
            <p className="text-xs text-base-content/50">{t.mockingNoRules}</p>
          ) : (
            scenarioRules.map((rule) => (
              <div key={rule.id} className="p-3 rounded-xl border border-base-300 bg-base-200/30">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold truncate flex-1">{rule.name}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-base-300">{rule.method}</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-success toggle-xs"
                      checked={rule.enabled}
                      onChange={(e) => void toggleRuleEnabled(rule, e.target.checked)}
                    />
                    <button
                      type="button"
                      className="p-1 hover:text-primary"
                      onClick={() => openRuleModal(rule)}
                      aria-label={t.mockingEditRule}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1 hover:text-error"
                      onClick={() => setRuleToDelete(rule.id)}
                      aria-label={t.mockingDeleteRule}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-base-content/50 mt-1 truncate">{rule.url_pattern}</p>
                <p className="text-[10px] text-base-content/40 mt-1">→ {rule.response_status}</p>
              </div>
            ))
          )}
        </div>

        {selectedScenarioId && (
          <Button variant="secondary" size="sm" className="w-full text-xs gap-1.5" onClick={() => openRuleModal()}>
            <Plus className="w-3.5 h-3.5" />
            {t.mockingAddRule}
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          className="w-full text-xs"
          onClick={() => nav.openGlobalSurface("global/mocking")}
        >
          {t.mockingOpenFull}
        </Button>
        {scenarios.length > 0 && (
          <p className="text-[10px] text-base-content/40 text-center">{t.mockingScenariosCount(scenarios.length)}</p>
        )}
      </div>

      <Modal isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)}>
        <Modal.Header title={editingRule ? t.mockingEditRule : t.mockingAddRule} />
        <Modal.Body className="space-y-3 max-h-[50vh] overflow-y-auto">
          <div>
            <label className="text-[10px] font-bold uppercase text-base-content/50">{t.mockingRuleName}</label>
            <input
              className="input input-bordered input-sm w-full mt-1"
              value={ruleForm.name}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase text-base-content/50">{t.mockingMethod}</label>
              <select
                className="select select-bordered select-sm w-full mt-1"
                value={ruleForm.method}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, method: e.target.value }))}
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="text-[10px] font-bold uppercase text-base-content/50">{t.mockingResponseStatus}</label>
              <input
                type="number"
                className="input input-bordered input-sm w-full mt-1"
                value={ruleForm.response_status}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, response_status: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-base-content/50">{t.mockingUrlPattern}</label>
            <input
              className="input input-bordered input-sm w-full mt-1 font-mono"
              value={ruleForm.url_pattern}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, url_pattern: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-base-content/50">Headers (JSON)</label>
            <textarea
              className="textarea textarea-bordered w-full mt-1 font-mono text-xs h-20"
              value={ruleForm.response_headers}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, response_headers: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-base-content/50">Body</label>
            <textarea
              className="textarea textarea-bordered w-full mt-1 font-mono text-xs h-24"
              value={ruleForm.response_body}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, response_body: e.target.value }))}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setIsRuleModalOpen(false)} disabled={savingRule}>
            {t.mockingCancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSaveRule()}
            disabled={savingRule || !ruleForm.name}
          >
            {t.mockingSave}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        isOpen={ruleToDelete !== null}
        onClose={() => setRuleToDelete(null)}
        onConfirm={() => void handleDeleteRule()}
        title={t.mockingDeleteRule}
        message={t.mockingDeleteConfirm}
        confirmText={t.mockingDeleteRule}
        cancelText={t.mockingCancel}
        type="danger"
      />
    </Panel>
  );
}
