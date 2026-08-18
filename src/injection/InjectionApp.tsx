import { useCallback, useEffect, useRef, useState } from "react";
import type { Annotation } from "@/entities/inspector";
import { useInjectionAppState } from "./hooks/useInjectionAppState";
import { resolveAnnotation } from "./lib/locator";
import { EditPolicyModal } from "./ui/EditPolicyModal";
import { GuideModal } from "./ui/GuideModal";
import { InjectionToast } from "./ui/InjectionToast";
import { InspectOverlay } from "./ui/InspectOverlay";
import { LogDetailModal } from "./ui/LogDetailModal";
import { MockEditorModal } from "./ui/MockEditorModal";
import { MockListPopover } from "./ui/MockListPopover";
import { NewPolicyModal } from "./ui/NewPolicyModal";
import type { PolicyBadgeGroupItem } from "./ui/PolicyBadge";
import { PolicyBadge } from "./ui/PolicyBadge";
import { PrxPopover } from "./ui/PrxPopover";
import { Toolbar } from "./ui/Toolbar";
import { TrafficLogPopover } from "./ui/TrafficLogPopover";

export interface PolicyCluster {
  items: PolicyBadgeGroupItem[];
}

export function buildPolicyClusters(policies: Annotation[]): PolicyCluster[] {
  const resolvedItems: {
    item: PolicyBadgeGroupItem;
    el: HTMLElement | null;
    top: number;
    left: number;
  }[] = [];

  policies.forEach((ann, i) => {
    const item: PolicyBadgeGroupItem = { annotation: ann, index: i + 1 };
    let el: HTMLElement | null = null;
    let top = -99999;
    let left = -99999;

    try {
      const res = resolveAnnotation(ann);
      el = res.el;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          left = Math.max(4, Math.min(rect.left - 12, window.innerWidth - 32));
          top = Math.max(4, Math.min(rect.top - 12, window.innerHeight - 32));
        }
      }
    } catch {
      // ignore resolution error
    }

    resolvedItems.push({ item, el, top, left });
  });

  const clusters: PolicyCluster[] = [];

  resolvedItems.forEach((res) => {
    const targetCluster = clusters.find((cluster) => {
      return cluster.items.some((existingItem) => {
        const existingRes = resolvedItems.find((r) => r.item.annotation.id === existingItem.annotation.id);
        if (!existingRes) {
          return false;
        }

        // Condition 1: Same HTML element
        if (res.el && existingRes.el && res.el === existingRes.el) {
          return true;
        }

        // Condition 2: Same selector string
        if (
          res.item.annotation.selector &&
          existingItem.annotation.selector &&
          res.item.annotation.selector.trim() === existingItem.annotation.selector.trim()
        ) {
          return true;
        }

        // Condition 3: Proximity within 24px X/Y axes
        if (res.top > -90000 && existingRes.top > -90000) {
          const distLeft = Math.abs(res.left - existingRes.left);
          const distTop = Math.abs(res.top - existingRes.top);
          if (distLeft <= 24 && distTop <= 24) {
            return true;
          }
        }

        return false;
      });
    });

    if (targetCluster) {
      targetCluster.items.push(res.item);
    } else {
      clusters.push({ items: [res.item] });
    }
  });

  return clusters;
}

export function InjectionApp() {
  const s = useInjectionAppState();
  const [clusters, setClusters] = useState<PolicyCluster[]>([]);

  // Keep a ref to the latest values so recompute stays stable (no dep churn).
  // Without this, every SSE push changes currentPagePolicies → new recompute →
  // useEffect cleanup+setup → subscribeAnnotations re-registered every second.
  const currentPagePoliciesRef = useRef(s.currentPagePolicies);
  const showPolicyBadgesRef = useRef(s.showPolicyBadges);
  const editingElementRef = useRef(s.editingElement);
  currentPagePoliciesRef.current = s.currentPagePolicies;
  showPolicyBadgesRef.current = s.showPolicyBadges;
  editingElementRef.current = s.editingElement;

  const recompute = useCallback(() => {
    if (!showPolicyBadgesRef.current || editingElementRef.current) {
      return;
    }
    const nextClusters = buildPolicyClusters(currentPagePoliciesRef.current);
    setClusters(nextClusters);
  }, []); // stable — refs are always up-to-date

  useEffect(() => {
    recompute();
    const t = setInterval(recompute, 1000);
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      clearInterval(t);
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  return (
    <div style={{ display: "block" }}>
      {s.hoveredElement && <InspectOverlay hoveredElement={s.hoveredElement} />}

      {s.showPolicyBadges &&
        !s.editingElement &&
        clusters.map((cluster) => {
          const clusterId = cluster.items.map((it) => it.annotation.id).join("-");
          const isClusterActive = cluster.items.some((it) => s.activeBadgeId === it.annotation.id);
          return (
            <PolicyBadge
              key={clusterId}
              items={cluster.items}
              isActive={isClusterActive}
              onToggle={() => {
                const firstId = cluster.items[0]?.annotation.id ?? null;
                s.setActiveBadgeId(isClusterActive ? null : firstId);
              }}
              onEdit={(target) => s.setEditingAnnotation(target)}
              onCopyDescription={(target) => s.copyDescription(target)}
              onCopySelector={(target) => s.copySelector(target)}
              onCopySummary={(target) => s.copySummary(target)}
              onDelete={(id) => s.deleteAnnotation(id)}
              onPromote={(target, idx) => void s.promoteAnnotation(target, idx)}
              onValidation={(target, validation) => void s.persistValidation(target, validation)}
              onRecapture={(target) => s.recaptureAnnotation(target)}
            />
          );
        })}

      <Toolbar s={s} />

      {s.isPrxPopoverOpen && <PrxPopover s={s} />}
      {s.isMockListOpen && <MockListPopover s={s} />}
      {s.isLogPopoverOpen && <TrafficLogPopover s={s} />}
      {s.editingMockRule && <MockEditorModal s={s} />}
      {s.selectedLogDetail && <LogDetailModal s={s} />}
      {s.isGuideModalOpen && <GuideModal s={s} />}
      {s.editingElement && <NewPolicyModal s={s} />}
      {s.editingAnnotation && (
        <EditPolicyModal
          annotation={s.editingAnnotation}
          onClose={() => s.setEditingAnnotation(null)}
          onSaved={s.fetchAnnotations}
          showToast={s.showToast}
        />
      )}
      <InjectionToast message={s.toastMessage} onClose={() => s.setToastMessage(null)} />
    </div>
  );
}
