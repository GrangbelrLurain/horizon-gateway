import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";
import { languageAtom, usePromiseModal } from "@/entities/app";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import { openPopupWindow } from "@/features/popup-window";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import {
  type BulkFeatureKey,
  bulkAssignGroup,
  bulkRemoveDomains,
  setBulkApiLogging,
  setBulkMonitor,
  setBulkProxy,
} from "../lib/bulkDomainFeatures";
import { useDomainHubData } from "./useDomainHubData";

export function useDomainBulkActions() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const { alert: showAlert } = usePromiseModal();
  const apiLinks = useAtomValue(apiLoggingLinksAtom);
  const { proxyActive, getFeatureState, fetchAll } = useDomainHubData();
  const [bulkLoading, setBulkLoading] = useState(false);

  const applyFeatureToDomains = useCallback(
    async (domainIds: number[], key: BulkFeatureKey, enabled: boolean) => {
      if (domainIds.length === 0) {
        return;
      }
      if (key === "monitor") {
        await setBulkMonitor(domainIds, enabled);
        return;
      }
      if (key === "api") {
        await setBulkApiLogging(domainIds, enabled, apiLinks);
        return;
      }
      if (!proxyActive) {
        void openPopupWindow("infrastructure");
        return;
      }
      const states = domainIds.map((domainId) => ({ domainId, state: getFeatureState(domainId) }));
      const { skipped } = await setBulkProxy(states, enabled, proxyActive);
      if (skipped > 0) {
        await showAlert(t.bulkModeEnter, t.bulkProxySkipped(skipped), "warning");
      }
    },
    [apiLinks, getFeatureState, proxyActive, showAlert, t],
  );

  const bulkFeatureToggle = useCallback(
    async (domainIds: number[], key: BulkFeatureKey, enabled: boolean) => {
      if (domainIds.length === 0) {
        return;
      }
      setBulkLoading(true);
      try {
        await applyFeatureToDomains(domainIds, key, enabled);
        await fetchAll();
      } catch (e) {
        console.error(e);
        await showAlert(t.errorGeneric, t.saveFailed, "danger");
      } finally {
        setBulkLoading(false);
      }
    },
    [applyFeatureToDomains, fetchAll, showAlert, t],
  );

  const bulkAssign = useCallback(
    async (domainIds: number[], groupId: number | null) => {
      if (domainIds.length === 0) {
        return;
      }
      setBulkLoading(true);
      try {
        await bulkAssignGroup(domainIds, groupId);
        await fetchAll();
      } catch (e) {
        console.error(e);
        await showAlert(t.errorGeneric, t.saveFailed, "danger");
      } finally {
        setBulkLoading(false);
      }
    },
    [fetchAll, showAlert, t],
  );

  const bulkDelete = useCallback(
    async (domainIds: number[]) => {
      if (domainIds.length === 0) {
        return;
      }
      setBulkLoading(true);
      try {
        await bulkRemoveDomains(domainIds);
        await fetchAll();
      } catch (e) {
        console.error(e);
        await showAlert(t.errorGeneric, t.saveFailed, "danger");
      } finally {
        setBulkLoading(false);
      }
    },
    [fetchAll, showAlert, t],
  );

  return {
    bulkLoading,
    bulkFeatureToggle,
    bulkAssign,
    bulkDelete,
  };
}
