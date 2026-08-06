import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button/Button";
import { getTeamEntitlement } from "../lib/entitlement";
import type { TeamWorkspaceController } from "../model/useTeamWorkspace";
import { TeamPanelFrame } from "./TeamPanelFrame";

interface BillingPanelProps {
  ctrl: TeamWorkspaceController;
  onClose: () => void;
}

export function BillingPanel({ ctrl, onClose }: BillingPanelProps) {
  const { lang, activeWorkspace, guard, unlimited, activeIsPro, handleCheckout, syncing, supaProfile } = ctrl;

  if (!activeWorkspace) {
    return null;
  }

  const entitlement = getTeamEntitlement(supaProfile);

  return (
    <TeamPanelFrame
      title={lang === "ko" ? "요금제" : "Billing"}
      subtitle={activeWorkspace.name}
      icon={<CreditCard className="w-3.5 h-3.5" />}
      onClose={onClose}
      widthClassName="w-[360px] min-w-[320px] max-w-[400px]"
    >
      <div className="flex flex-col gap-4">
        <div className="p-3 rounded-xl border border-base-200 bg-base-200/40 flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
            {lang === "ko" ? "이 워크스페이스" : "This workspace"}
          </p>
          <p className="text-sm font-bold">
            {activeWorkspace.plan === "pro" ? "Team Pro" : "Free"} · {activeWorkspace.status}
          </p>
          <p className="text-[11px] text-base-content/55">
            {unlimited
              ? lang === "ko"
                ? `멤버 ${guard.memberCount}명 (unlimited)`
                : `${guard.memberCount} members (unlimited)`
              : lang === "ko"
                ? `좌석 ${guard.memberCount} / ${guard.seatLimit}`
                : `Seats ${guard.memberCount} / ${guard.seatLimit}`}
          </p>
        </div>

        <p className="text-[11px] text-base-content/55 leading-relaxed">
          {lang === "ko"
            ? "결제는 워크스페이스 단위입니다. Free는 소유 워크스페이스 1개·좌석 3명, Pro는 이 워크스페이스의 좌석·한도를 확장합니다."
            : "Billing is per workspace. Free: 1 owned workspace and 3 seats. Pro expands seats/limits for this workspace."}
        </p>

        {entitlement && (
          <p className="text-[10px] text-base-content/40">
            {lang === "ko"
              ? `계정 바이패스: ${entitlement} (내부/스폰서)`
              : `Account bypass: ${entitlement} (internal/sponsor)`}
          </p>
        )}

        <Button
          variant="primary"
          size="sm"
          className="gap-1.5 w-full"
          onClick={() => void handleCheckout()}
          disabled={activeIsPro || syncing !== null}
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
          {activeIsPro
            ? unlimited
              ? lang === "ko"
                ? "Unlimited 이용 중"
                : "Unlimited active"
              : lang === "ko"
                ? "Team Pro 이용 중"
                : "Team Pro active"
            : lang === "ko"
              ? "이 워크스페이스 Pro 업그레이드"
              : "Upgrade this workspace to Pro"}
        </Button>
      </div>
    </TeamPanelFrame>
  );
}
