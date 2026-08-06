import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { Modal } from "@/shared/ui/modal/Modal";
import type { TeamWorkspaceController } from "../model/useTeamWorkspace";

export interface TransferOwnershipTarget {
  profileId: string;
  label: string;
}

interface TransferOwnershipModalProps {
  ctrl: TeamWorkspaceController;
  target: TransferOwnershipTarget | null;
  onClose: () => void;
}

export function TransferOwnershipModal({ ctrl, target, onClose }: TransferOwnershipModalProps) {
  const { lang, activeWorkspace, transferringOwnership, handleTransferOwnership } = ctrl;
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    setConfirmName("");
  }, [target?.profileId, activeWorkspace?.id]);

  if (!activeWorkspace || !target) {
    return null;
  }

  const nameMatches = confirmName.trim() === activeWorkspace.name;

  const handleClose = () => {
    if (transferringOwnership) {
      return;
    }
    onClose();
  };

  const submit = async () => {
    if (!nameMatches) {
      return;
    }
    const ok = await handleTransferOwnership(target.profileId, target.label);
    if (ok) {
      onClose();
    }
  };

  return (
    <Modal isOpen={target !== null} onClose={handleClose} size="md">
      <Modal.Header
        title={lang === "ko" ? "Owner 권한 넘기기" : "Transfer ownership"}
        description={activeWorkspace.name}
      />
      <Modal.Body className="pt-2 pb-6">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-base-content/60 leading-relaxed">
            {lang === "ko" ? (
              <>
                <span className="font-bold text-base-content">{target.label}</span>
                님에게 Owner 권한을 넘깁니다. 본인은 Admin으로 변경되며, 워크스페이스 삭제·Owner 넘기기 권한을 잃습니다.
              </>
            ) : (
              <>
                Transfer ownership to <span className="font-bold text-base-content">{target.label}</span>. You will
                become an admin and lose delete/transfer privileges.
              </>
            )}
          </p>
          <label htmlFor="transfer-ownership-confirm" className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
              {lang === "ko"
                ? `확인을 위해 「${activeWorkspace.name}」 입력`
                : `Type "${activeWorkspace.name}" to confirm`}
            </span>
            <Input
              id="transfer-ownership-confirm"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              disabled={transferringOwnership}
              placeholder={activeWorkspace.name}
              className="w-full rounded-2xl bg-base-200 border-base-300 focus:bg-base-100 font-bold tracking-tight h-12 px-4 shadow-inner font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameMatches) {
                  void submit();
                }
              }}
            />
          </label>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={transferringOwnership}>
          {lang === "ko" ? "취소" : "Cancel"}
        </Button>
        <Button variant="primary" disabled={!nameMatches || transferringOwnership} onClick={() => void submit()}>
          {transferringOwnership ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : lang === "ko" ? (
            "Owner 넘기기"
          ) : (
            "Transfer"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
