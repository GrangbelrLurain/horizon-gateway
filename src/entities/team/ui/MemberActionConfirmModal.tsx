import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button/Button";
import { Modal } from "@/shared/ui/modal/Modal";

export type MemberConfirmAction = "promote_admin" | "revoke_admin" | "remove_member";

export interface MemberConfirmTarget {
  memberId: string;
  label: string;
}

interface MemberActionConfirmModalProps {
  lang: "ko" | "en";
  action: MemberConfirmAction | null;
  target: MemberConfirmTarget | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function MemberActionConfirmModal({
  lang,
  action,
  target,
  busy,
  onClose,
  onConfirm,
}: MemberActionConfirmModalProps) {
  if (!action || !target) {
    return null;
  }

  const title =
    action === "promote_admin"
      ? lang === "ko"
        ? "Admin 지정"
        : "Make Admin"
      : action === "revoke_admin"
        ? lang === "ko"
          ? "Admin 해제"
          : "Remove Admin"
        : lang === "ko"
          ? "멤버 제거"
          : "Remove member";

  const description =
    action === "promote_admin"
      ? lang === "ko"
        ? `${target.label}님에게 Admin 권한을 부여합니다. 초대·공유 토큰 생성이 가능해집니다.`
        : `${target.label} will be able to invite members and create shareable tokens.`
      : action === "revoke_admin"
        ? lang === "ko"
          ? `${target.label}님의 Admin 권한을 해제하고 Member로 변경합니다.`
          : `${target.label} will become a regular Member.`
        : lang === "ko"
          ? `${target.label}님을 이 워크스페이스에서 제거합니다.`
          : `${target.label} will be removed from this workspace.`;

  const confirmLabel =
    action === "promote_admin"
      ? lang === "ko"
        ? "Admin 지정"
        : "Make Admin"
      : action === "revoke_admin"
        ? lang === "ko"
          ? "Admin 해제"
          : "Remove Admin"
        : lang === "ko"
          ? "제거"
          : "Remove";

  const isDestructive = action === "remove_member";

  return (
    <Modal isOpen={action !== null && target !== null} onClose={() => !busy && onClose()} size="md">
      <Modal.Header title={title} description={target.label} />
      <Modal.Body className="pt-2 pb-6">
        <p className="text-sm text-base-content/60 leading-relaxed">{description}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {lang === "ko" ? "취소" : "Cancel"}
        </Button>
        <Button
          variant="primary"
          className={isDestructive ? "bg-error hover:bg-error/90 border-error text-error-content" : undefined}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
