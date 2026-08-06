import { useInjectionAppState } from "./hooks/useInjectionAppState";
import { GuideModal } from "./ui/GuideModal";
import { InspectOverlay } from "./ui/InspectOverlay";
import { LogDetailModal } from "./ui/LogDetailModal";
import { MockEditorModal } from "./ui/MockEditorModal";
import { MockListPopover } from "./ui/MockListPopover";
import { NewPolicyModal } from "./ui/NewPolicyModal";
import { PolicyBadge } from "./ui/PolicyBadge";
import { PrxPopover } from "./ui/PrxPopover";
import { Toolbar } from "./ui/Toolbar";
import { TrafficLogPopover } from "./ui/TrafficLogPopover";

export function InjectionApp() {
  const s = useInjectionAppState();

  return (
    <div style={{ display: "block" }}>
      {s.hoveredElement && <InspectOverlay hoveredElement={s.hoveredElement} />}

      {s.showPolicyBadges &&
        !s.editingElement &&
        s.currentPagePolicies.map((ann, i) => (
          <PolicyBadge
            key={ann.id}
            annotation={ann}
            index={i + 1}
            isActive={s.activeBadgeId === ann.id}
            onToggle={() => s.setActiveBadgeId(s.activeBadgeId === ann.id ? null : ann.id)}
          />
        ))}

      <Toolbar s={s} />

      {s.isPrxPopoverOpen && <PrxPopover s={s} />}
      {s.isMockListOpen && <MockListPopover s={s} />}
      {s.isLogPopoverOpen && <TrafficLogPopover s={s} />}
      {s.editingMockRule && <MockEditorModal s={s} />}
      {s.selectedLogDetail && <LogDetailModal s={s} />}
      {s.isGuideModalOpen && <GuideModal s={s} />}
      {s.editingElement && <NewPolicyModal s={s} />}
    </div>
  );
}
