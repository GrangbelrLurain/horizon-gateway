import { createFileRoute } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import { Edit2, FlaskConical, Pause, Play, Plus, Power, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { languageAtom } from "@/entities/app/i18n/store";
import { proxyMockingEnabledAtom, proxyRunningAtom } from "@/entities/app/status/store";
import type { MockRule, Scenario } from "@/entities/mocking";
import * as mockingApi from "@/entities/mocking/api-ui";
import { ProxyServerWarning } from "@/entities/proxy/ui/ProxyServerWarning";
import { commands, unwrap } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { ConfirmModal } from "@/shared/ui/modal/ConfirmModal";
import { Modal } from "@/shared/ui/modal/Modal";
import { StatusToggle } from "@/shared/ui/status-toggle/StatusToggle";
import { en } from "./en";
import { ko } from "./ko";
import { selectedScenarioIdAtom } from "./store";

export const Route = createFileRoute("/apis/mocking/")({
  component: MockingDashboard,
});

function MockingDashboard() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;

  const [mockingEnabled, setMockingEnabled] = useAtom(proxyMockingEnabledAtom);
  const isProxyRunning = useAtomValue(proxyRunningAtom);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useAtom(selectedScenarioIdAtom);
  const [rules, setRules] = useState<MockRule[]>([]);

  // Modals
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [scenarioForm, setScenarioForm] = useState({ name: "", description: "" });

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MockRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    host: "",
    method: "GET",
    url_pattern: "",
    response_status: 200,
    response_headers: "",
    response_body: "",
    enabled: true,
  });

  const [scenarioToDelete, setScenarioToDelete] = useState<string | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  const loadRules = useCallback(async (scenarioId: string) => {
    try {
      const data = await mockingApi.getMockRulesByScenario(scenarioId);
      setRules(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadScenarios = useCallback(async () => {
    try {
      const data = await mockingApi.getScenarios();
      setScenarios(data);
      if (data.length > 0 && !selectedScenarioId) {
        setSelectedScenarioId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedScenarioId, setSelectedScenarioId]);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  useEffect(() => {
    if (selectedScenarioId) {
      loadRules(selectedScenarioId);
    } else {
      setRules([]);
    }
  }, [selectedScenarioId, loadRules]);

  const [mockingLoading, setMockingLoading] = useState(false);
  const toggleMocking = async (enabled: boolean) => {
    if (mockingEnabled === null) {
      return;
    }
    setMockingLoading(true);
    try {
      const res = await commands.setMockingEnabled({ enabled }).then(unwrap);
      if (res.success) {
        setMockingEnabled(enabled);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMockingLoading(false);
    }
  };

  const handleToggleScenario = async (id: string, enabled: boolean) => {
    try {
      const updatedScenarios = await mockingApi.setScenarioEnabled(id, enabled);
      setScenarios(updatedScenarios);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveScenario = async () => {
    try {
      if (editingScenario) {
        await mockingApi.updateScenario(editingScenario.id, scenarioForm.name, scenarioForm.description);
      } else {
        const created = await mockingApi.createScenario(scenarioForm.name, scenarioForm.description);
        setSelectedScenarioId(created.id);
      }
      setIsScenarioModalOpen(false);
      loadScenarios();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      await mockingApi.deleteScenario(id);
      if (selectedScenarioId === id) {
        setSelectedScenarioId(null);
      }
      loadScenarios();
    } catch (e) {
      console.error(e);
    } finally {
      setScenarioToDelete(null);
    }
  };

  const openScenarioModal = (scenario?: Scenario) => {
    if (scenario) {
      setEditingScenario(scenario);
      setScenarioForm({ name: scenario.name, description: scenario.description || "" });
    } else {
      setEditingScenario(null);
      setScenarioForm({ name: "", description: "" });
    }
    setIsScenarioModalOpen(true);
  };

  // Rule actions
  const handleSaveRule = async () => {
    if (!selectedScenarioId) {
      return;
    }
    try {
      let headers = {};
      try {
        headers = ruleForm.response_headers ? JSON.parse(ruleForm.response_headers) : {};
      } catch (_e) {
        alert("Headers must be valid JSON object");
        return;
      }

      if (editingRule) {
        await mockingApi.updateMockRule(
          editingRule.id,
          ruleForm.name,
          ruleForm.host || null,
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
          ruleForm.host || null,
          ruleForm.method,
          ruleForm.url_pattern,
          Number(ruleForm.response_status),
          headers,
          ruleForm.response_body,
          ruleForm.enabled,
        );
      }
      setIsRuleModalOpen(false);
      loadRules(selectedScenarioId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await mockingApi.deleteMockRule(id);
      if (selectedScenarioId) {
        loadRules(selectedScenarioId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRuleToDelete(null);
    }
  };

  const handleToggleRule = async (rule: MockRule) => {
    try {
      await mockingApi.updateMockRule(
        rule.id,
        rule.name,
        rule.host,
        rule.method,
        rule.url_pattern,
        rule.response_status,
        rule.response_headers,
        rule.response_body,
        !rule.enabled,
      );
      if (selectedScenarioId) {
        loadRules(selectedScenarioId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openRuleModal = (rule?: MockRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({
        name: rule.name,
        host: rule.host || "",
        method: rule.method,
        url_pattern: rule.url_pattern,
        response_status: rule.response_status,
        response_headers: JSON.stringify(rule.response_headers, null, 2),
        response_body: rule.response_body || "",
        enabled: rule.enabled,
      });
    } else {
      setEditingRule(null);
      setRuleForm({
        name: "",
        host: "",
        method: "GET",
        url_pattern: "",
        response_status: 200,
        response_headers: '{\n  "Content-Type": "application/json"\n}',
        response_body: "{}",
        enabled: true,
      });
    }
    setIsRuleModalOpen(true);
  };

  return (
    <div className="flex flex-col tablet:flex-row h-full gap-6">
      {/* Sidebar: Scenarios */}
      <div className="w-full tablet:w-64 flex flex-col gap-4 shrink-0 tablet:border-r border-base-300 tablet:pr-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">{t.scenarios}</h2>
          {isProxyRunning && (
            <Button variant="secondary" size="sm" onClick={() => openScenarioModal()}>
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex tablet:flex-col gap-2 overflow-x-auto tablet:overflow-y-auto [scrollbar-width:none] pb-2 tablet:pb-0">
          {scenarios.length === 0 ? (
            <div className="text-sm text-base-content/50">{t.noScenariosDesc}</div>
          ) : (
            scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`p-3 rounded-xl border text-left flex justify-between items-center group transition-colors shrink-0 tablet:shrink-1 min-w-[160px] tablet:min-w-0 ${selectedScenarioId === s.id ? `bg-primary/10 border-primary shadow-sm shadow-primary/5` : `bg-base-100 border-base-300 hover:border-primary/50`}`}
                onClick={() => setSelectedScenarioId(s.id)}
                disabled={!isProxyRunning}
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-bold truncate text-sm">{s.name}</span>
                  {s.description && <span className="text-[10px] text-base-content/50 truncate">{s.description}</span>}
                </div>
                {isProxyRunning && (
                  <div className="flex gap-1 opacity-100 group-hover:opacity-100 transition-opacity">
                    <div
                      role="button"
                      tabIndex={0}
                      className={`p-1 hover:text-success transition-colors ${s.enabled ? `text-success` : `text-base-content/20`}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleScenario(s.id, !s.enabled);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleToggleScenario(s.id, !s.enabled)}
                    >
                      <Power className={`w-3.5 h-3.5 ${s.enabled ? `fill-success/20` : ``}`} />
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      className="p-1 hover:text-primary opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        openScenarioModal(s);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && openScenarioModal(s)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      className="p-1 hover:text-error"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScenarioToDelete(s.id);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && setScenarioToDelete(s.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Area: Mock Rules */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <ProxyServerWarning />
        {isProxyRunning && (
          <>
            <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <FlaskConical className="w-5 h-5 tablet:w-6 tablet:h-6" />
                </div>
                <h1 className="text-2xl tablet:text-3xl font-black tracking-tight">{t.mockRules}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 tablet:gap-4">
                <StatusToggle
                  label={lang === "ko" ? "모킹" : "Mocking"}
                  checked={mockingEnabled ?? false}
                  onChange={toggleMocking}
                  loading={mockingLoading}
                  icon={<FlaskConical className="w-3.5 h-3.5" />}
                />
                <Button
                  variant="primary"
                  onClick={() => openRuleModal()}
                  disabled={!selectedScenarioId}
                  className="h-9 tablet:h-auto font-bold text-xs tablet:text-sm"
                >
                  <Plus className="w-4 h-4 tablet:mr-2" />
                  <span className="hidden tablet:inline">{t.addRule}</span>
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!selectedScenarioId ? (
                <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                  <FlaskConical className="w-12 h-12 mb-4 opacity-50" />
                  <p className="font-bold">{t.noScenarios}</p>
                </div>
              ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                  <p>{t.noRulesDesc}</p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
                  {rules.map((rule) => (
                    <Card key={rule.id} className={`p-4 flex flex-col gap-3 ${!rule.enabled && `opacity-50`}`}>
                      <div className="font-bold text-sm truncate">{rule.name}</div>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-black text-xs px-2 py-0.5 rounded uppercase ${rule.method === `GET` ? `bg-success/20 text-success` : rule.method === `POST` ? `bg-info/20 text-info` : `bg-warning/20 text-warning`}`}
                          >
                            {rule.method}
                          </span>
                          <span className="font-mono text-sm font-bold truncate max-w-[200px]" title={rule.url_pattern}>
                            {rule.url_pattern}
                          </span>
                          {rule.host && (
                            <span className="text-[10px] bg-base-200 text-base-content/50 px-1.5 py-0.5 rounded font-medium">
                              {rule.host}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleRule(rule)}
                          >
                            {rule.enabled ? (
                              <Pause className="w-4 h-4 text-warning" />
                            ) : (
                              <Play className="w-4 h-4 text-success" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRuleModal(rule)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-error hover:text-error"
                            onClick={() => setRuleToDelete(rule.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>{" "}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`font-bold ${rule.response_status >= 400 ? `text-error` : `text-success`}`}>
                          {rule.response_status}
                        </span>
                        <span className="text-base-content/50">Response Mock</span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Scenario Modal */}
      <Modal isOpen={isScenarioModalOpen} onClose={() => setIsScenarioModalOpen(false)}>
        <Modal.Header title={editingScenario ? t.editScenario : t.createScenario} />
        <Modal.Body className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="scenario-name" className="text-xs font-bold uppercase">
              {t.name}
            </label>
            <input
              id="scenario-name"
              className="input input-bordered border-base-300 w-full font-bold bg-base-100/50"
              value={scenarioForm.name}
              onChange={(e) => setScenarioForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="scenario-desc" className="text-xs font-bold uppercase">
              {t.description}
            </label>
            <input
              id="scenario-desc"
              className="input input-bordered border-base-300 w-full text-sm bg-base-100/50"
              value={scenarioForm.description}
              onChange={(e) => setScenarioForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setIsScenarioModalOpen(false)}>
            {t.cancel}
          </Button>
          <Button variant="primary" onClick={handleSaveScenario} disabled={!scenarioForm.name}>
            {t.save}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Rule Modal */}
      <Modal isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)}>
        <Modal.Header title={editingRule ? t.editRule : t.addRule} />
        <Modal.Body className="flex flex-col gap-4 h-[60vh] overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label htmlFor="rule-name" className="text-xs font-bold uppercase">
              {t.name}
            </label>
            <input
              id="rule-name"
              className="input input-bordered border-base-300 w-full font-bold bg-base-100/50"
              placeholder="e.g. Success Response"
              value={ruleForm.name}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 w-1/3">
              <label htmlFor="rule-method" className="text-xs font-bold uppercase">
                {t.method}
              </label>
              <select
                id="rule-method"
                className="select select-bordered border-base-300 w-full font-bold bg-base-100/50"
                value={ruleForm.method}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, method: e.target.value }))}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-2/3">
              <label htmlFor="rule-status" className="text-xs font-bold uppercase">
                {t.status}
              </label>
              <input
                id="rule-status"
                type="number"
                className="input input-bordered border-base-300 w-full font-bold bg-base-100/50 tabular-nums"
                value={ruleForm.response_status}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, response_status: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rule-host" className="text-xs font-bold uppercase">
              {t.host}
            </label>
            <input
              id="rule-host"
              className="input input-bordered border-base-300 w-full font-mono text-sm bg-base-100/50"
              placeholder="b2c-api.modetour.dev (optional)"
              value={ruleForm.host}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, host: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rule-url" className="text-xs font-bold uppercase">
              {t.urlPattern}
            </label>
            <input
              id="rule-url"
              className="input input-bordered border-base-300 w-full font-mono text-sm bg-base-100/50"
              placeholder="/api/v1/users"
              value={ruleForm.url_pattern}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, url_pattern: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rule-headers" className="text-xs font-bold uppercase">
              {t.headers} (JSON)
            </label>
            <textarea
              id="rule-headers"
              className="textarea textarea-bordered border-base-300 w-full font-mono text-sm h-24 bg-base-100/50 leading-relaxed"
              value={ruleForm.response_headers}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, response_headers: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rule-body" className="text-xs font-bold uppercase">
              {t.body}
            </label>
            <textarea
              id="rule-body"
              className="textarea textarea-bordered border-base-300 w-full font-mono text-sm h-48 bg-base-100/50 leading-relaxed"
              value={ruleForm.response_body}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, response_body: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={ruleForm.enabled}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            <span className="text-sm font-bold uppercase">{t.enabled}</span>
          </label>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setIsRuleModalOpen(false)}>
            {t.cancel}
          </Button>
          <Button variant="primary" onClick={handleSaveRule} disabled={!ruleForm.url_pattern || !ruleForm.name}>
            {t.save}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        isOpen={scenarioToDelete !== null}
        onClose={() => setScenarioToDelete(null)}
        onConfirm={() => {
          if (scenarioToDelete) {
            handleDeleteScenario(scenarioToDelete);
          }
        }}
        title={t.deleteScenario}
        message={t.deleteConfirm}
        confirmText="Delete"
        cancelText={t.cancel}
        type="danger"
      />

      <ConfirmModal
        isOpen={ruleToDelete !== null}
        onClose={() => setRuleToDelete(null)}
        onConfirm={() => {
          if (ruleToDelete) {
            handleDeleteRule(ruleToDelete);
          }
        }}
        title="Delete Mock Rule"
        message={t.deleteRuleConfirm}
        confirmText="Delete"
        cancelText={t.cancel}
        type="danger"
      />
    </div>
  );
}
