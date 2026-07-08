import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { Activity, ListChecks, Loader2, Server, Trash2, Wifi } from "lucide-react";
import { useState } from "react";
import { languageAtom } from "@/entities/app";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import { Button } from "@/shared/ui/button/Button";
import { ConfirmModal } from "@/shared/ui/modal/ConfirmModal";
import { useDomainBulkActions } from "../hooks/useDomainBulkActions";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { domainListBulkSelectedIdsAtom } from "../store";
import { Panel } from "./Panel";

interface DomainBulkManagePanelProps {
  onClose: () => void;
}

export function DomainBulkManagePanel({ onClose }: DomainBulkManagePanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [selectedIds, setSelectedIds] = useAtom(domainListBulkSelectedIdsAtom);
  const { groups, getFeatureState } = useDomainHubData();
  const { bulkLoading, bulkFeatureToggle, bulkApiBodyToggle, bulkAssign, bulkDelete } = useDomainBulkActions();
  const apiLinks = useAtomValue(apiLoggingLinksAtom);
  const [bulkGroupId, setBulkGroupId] = useState<number | "">("");
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [localLoading, setLocalLoading] = useState<Record<string, boolean>>({});

  const getFeatureStates = (key: "monitor" | "proxy" | "api") => {
    if (selectedIds.length === 0) {
      return { allEnabled: false, noneEnabled: true, isMixed: false };
    }
    const states = selectedIds.map((id) => getFeatureState(id));
    const enabledCount = states.filter((s) => {
      if (key === "monitor") {
        return !!s.monitorEnabled;
      }
      if (key === "proxy") {
        return !!s.proxyEnabled;
      }
      return !!s.apiLoggingEnabled;
    }).length;

    const allEnabled = enabledCount === selectedIds.length;
    const noneEnabled = enabledCount === 0;
    const isMixed = !allEnabled && !noneEnabled;

    return { allEnabled, noneEnabled, isMixed };
  };

  const getApiBodyStates = () => {
    if (selectedIds.length === 0) {
      return { allBodyEnabled: false, noneBodyEnabled: true, isBodyMixed: false };
    }
    const enabledCount = selectedIds.filter((id) => {
      const link = apiLinks.find((l) => l.domainId === id);
      return !!link?.bodyEnabled;
    }).length;

    const allBodyEnabled = enabledCount === selectedIds.length;
    const noneBodyEnabled = enabledCount === 0;
    const isBodyMixed = !allBodyEnabled && !noneBodyEnabled;

    return { allBodyEnabled, noneBodyEnabled, isBodyMixed };
  };

  const handleAssignGroup = async () => {
    const ids = [...selectedIds];
    await bulkAssign(ids, bulkGroupId === "" ? null : bulkGroupId);
    setSelectedIds([]);
  };

  const handleUngroup = async () => {
    const ids = [...selectedIds];
    await bulkAssign(ids, null);
    setSelectedIds([]);
  };

  const handleDelete = async () => {
    const ids = [...selectedIds];
    await bulkDelete(ids);
    setSelectedIds([]);
    setBulkDeleteConfirm(false);
  };

  return (
    <>
      <Panel
        id="bulk-manage"
        title={t.bulkPanelTitle}
        subtitle={t.bulkSelected(selectedIds.length)}
        onClose={onClose}
        width="lg"
      >
        {selectedIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mb-4">
              <ListChecks className="w-7 h-7 text-base-content/25" />
            </div>
            <p className="text-sm font-bold text-base-content/60">{t.bulkPanelEmpty}</p>
            <p className="text-xs text-base-content/40 mt-2 max-w-[240px]">{t.bulkPanelEmptyHint}</p>
          </div>
        ) : (
          <div className="p-4 space-y-5">
            <section className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                {t.filterFeatureLabel}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {(["monitor", "proxy", "api"] as const).map((key) => {
                  const { allEnabled, noneEnabled, isMixed } = getFeatureStates(key);
                  const anyEnabled = !noneEnabled;
                  const isLoading = localLoading[key];

                  const { allBodyEnabled, isBodyMixed } =
                    key === "api" ? getApiBodyStates() : { allBodyEnabled: false, isBodyMixed: false };

                  return (
                    <div
                      key={key}
                      className={clsx(
                        "flex flex-col gap-1 p-3 rounded-xl border border-base-300/60 bg-base-200/30 transition-all",
                        !anyEnabled && "opacity-60 hover:opacity-80",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={clsx(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              anyEnabled ? "bg-base-200 text-base-content/50" : "bg-base-300/50 text-base-content/30",
                            )}
                          >
                            {key === "monitor" ? (
                              <Activity className="w-4 h-4" />
                            ) : key === "proxy" ? (
                              <Server className="w-4 h-4" />
                            ) : (
                              <Wifi className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-base-content">
                                {key === "monitor" ? t.monitor : key === "proxy" ? t.proxy : t.api}
                              </span>
                              {allEnabled ? (
                                <span className="text-[8px] font-bold text-success bg-success/15 px-1 py-0.5 rounded">
                                  ON
                                </span>
                              ) : noneEnabled ? (
                                <span className="text-[8px] font-bold text-base-content/30 bg-base-300 px-1 py-0.5 rounded">
                                  OFF
                                </span>
                              ) : (
                                <span className="text-[8px] font-bold text-warning bg-warning/15 px-1 py-0.5 rounded">
                                  {t.bulkMixedState}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-base-content/40 mt-0.5 truncate">
                              {key === "monitor"
                                ? t.monitorEnableHint
                                : key === "proxy"
                                  ? t.proxyRouteToggleHint
                                  : t.apiEnableHint}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center shrink-0">
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          ) : (
                            <input
                              type="checkbox"
                              className="toggle toggle-success toggle-sm"
                              checked={allEnabled}
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate = isMixed;
                                }
                              }}
                              disabled={bulkLoading}
                              onChange={async (e) => {
                                const targetVal = e.target.checked;
                                setLocalLoading((prev) => ({ ...prev, [key]: true }));
                                try {
                                  await bulkFeatureToggle(selectedIds, key, targetVal);
                                } finally {
                                  setLocalLoading((prev) => ({ ...prev, [key]: false }));
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Sub-row for API Body Logging */}
                      {key === "api" && anyEnabled && (
                        <div className="w-full pl-11 pt-2 border-t border-base-300/30 mt-2">
                          <div className="flex items-center justify-between text-xs py-1 px-2">
                            <span className="text-base-content/70">{t.apiBodyLogging}</span>
                            {localLoading["api-body"] ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                            ) : (
                              <input
                                type="checkbox"
                                className="toggle toggle-success toggle-xs"
                                checked={allBodyEnabled}
                                ref={(el) => {
                                  if (el) {
                                    el.indeterminate = isBodyMixed;
                                  }
                                }}
                                disabled={bulkLoading}
                                onChange={async (e) => {
                                  const targetVal = e.target.checked;
                                  setLocalLoading((prev) => ({ ...prev, "api-body": true }));
                                  try {
                                    await bulkApiBodyToggle(selectedIds, targetVal);
                                  } finally {
                                    setLocalLoading((prev) => ({ ...prev, "api-body": false }));
                                  }
                                }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3 pt-2 border-t border-base-300/60">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                {t.domainEditGroup}
              </h3>
              <div className="flex gap-2">
                <select
                  className="flex-1 h-9 rounded-lg border border-base-300 bg-base-100 px-3 text-sm min-w-0"
                  value={bulkGroupId}
                  onChange={(e) => setBulkGroupId(e.target.value === "" ? "" : Number(e.target.value))}
                  disabled={bulkLoading}
                >
                  <option value="">{t.domainEditNoGroup}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 text-xs shrink-0 px-4"
                  disabled={bulkLoading || bulkGroupId === ""}
                  onClick={() => void handleAssignGroup()}
                >
                  {t.bulkAssignGroup}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs"
                disabled={bulkLoading}
                onClick={() => void handleUngroup()}
              >
                {t.bulkUngroup}
              </Button>
            </section>

            <section className="pt-2 border-t border-base-300/60">
              <Button
                variant="secondary"
                size="sm"
                className={clsx("w-full h-9 text-xs gap-2", "text-error hover:bg-error/10 border-error/30")}
                disabled={bulkLoading}
                onClick={() => setBulkDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4" />
                {t.bulkDeleteSelected}
              </Button>
            </section>
          </div>
        )}
      </Panel>

      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t.bulkDeleteConfirmTitle}
        message={t.bulkDeleteConfirmMessage(selectedIds.length)}
        confirmText={t.domainDeleteConfirm}
        cancelText={t.domainEditCancel}
        type="danger"
      />
    </>
  );
}
