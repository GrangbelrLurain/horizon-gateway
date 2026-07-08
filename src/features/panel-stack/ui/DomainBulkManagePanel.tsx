import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { ListChecks, Trash2 } from "lucide-react";
import { useState } from "react";
import { languageAtom } from "@/entities/app";
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
  const { groups } = useDomainHubData();
  const { bulkLoading, bulkFeatureToggle, bulkAssign, bulkDelete } = useDomainBulkActions();
  const [bulkGroupId, setBulkGroupId] = useState<number | "">("");
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

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
                {(["monitor", "proxy", "api"] as const).map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-base-300/60 bg-base-200/30"
                  >
                    <span className="text-sm font-bold text-base-content/80">
                      {key === "monitor" ? t.monitor : key === "proxy" ? t.proxy : t.api}
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs px-3"
                        disabled={bulkLoading}
                        onClick={() => void bulkFeatureToggle(selectedIds, key, true)}
                      >
                        {t.bulkTurnOn}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs px-3"
                        disabled={bulkLoading}
                        onClick={() => void bulkFeatureToggle(selectedIds, key, false)}
                      >
                        {t.bulkTurnOff}
                      </Button>
                    </div>
                  </div>
                ))}
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
