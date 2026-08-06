import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { Modal } from "@/shared/ui/modal/Modal";
import type { TeamWorkspaceController } from "../model/useTeamWorkspace";

export type WorkspaceSettingsModalMode = "edit" | "delete";

interface WorkspaceSettingsModalProps {
  ctrl: TeamWorkspaceController;
  mode: WorkspaceSettingsModalMode | null;
  onClose: () => void;
}

export function WorkspaceSettingsModal({ ctrl, mode, onClose }: WorkspaceSettingsModalProps) {
  const { lang, activeWorkspace, renamingWorkspace, deletingWorkspace, handleRenameWorkspace, handleDeleteWorkspace } =
    ctrl;

  const [editName, setEditName] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  useEffect(() => {
    if (!mode || !activeWorkspace) {
      return;
    }
    setEditName(activeWorkspace.name);
    setDeleteConfirmName("");
  }, [mode, activeWorkspace?.id, activeWorkspace?.name]);

  if (!activeWorkspace || !mode) {
    return null;
  }

  const isEdit = mode === "edit";
  const nameChanged = editName.trim() !== activeWorkspace.name && editName.trim().length > 0;
  const deleteNameMatches = deleteConfirmName.trim() === activeWorkspace.name;

  const handleClose = () => {
    if (renamingWorkspace || deletingWorkspace) {
      return;
    }
    onClose();
  };

  const submitEdit = async () => {
    const ok = await handleRenameWorkspace(editName);
    if (ok) {
      onClose();
    }
  };

  const submitDelete = async () => {
    if (!deleteNameMatches) {
      return;
    }
    const ok = await handleDeleteWorkspace();
    if (ok) {
      onClose();
    }
  };

  return (
    <Modal isOpen={mode !== null} onClose={handleClose} size="md">
      <Modal.Header
        title={
          isEdit
            ? lang === "ko"
              ? "워크스페이스 수정"
              : "Edit workspace"
            : lang === "ko"
              ? "워크스페이스 삭제"
              : "Delete workspace"
        }
        description={activeWorkspace.name}
      />
      <Modal.Body className="pt-2 pb-6">
        {isEdit ? (
          <label htmlFor="workspace-edit-name" className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
              {lang === "ko" ? "이름" : "Name"}
            </span>
            <Input
              id="workspace-edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={renamingWorkspace}
              className="w-full rounded-2xl bg-base-200 border-base-300 focus:bg-base-100 font-bold tracking-tight h-12 px-4 shadow-inner"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameChanged) {
                  void submitEdit();
                }
              }}
            />
          </label>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-base-content/60 leading-relaxed">
              {lang === "ko"
                ? "삭제하면 멤버·초대·동기화 데이터가 모두 제거됩니다. 되돌릴 수 없습니다."
                : "This removes all members, invites, and sync data. This cannot be undone."}
            </p>
            <label htmlFor="workspace-delete-confirm" className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 pl-1">
                {lang === "ko"
                  ? `확인을 위해 「${activeWorkspace.name}」 입력`
                  : `Type "${activeWorkspace.name}" to confirm`}
              </span>
              <Input
                id="workspace-delete-confirm"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                disabled={deletingWorkspace}
                placeholder={activeWorkspace.name}
                className="w-full rounded-2xl bg-base-200 border-base-300 focus:bg-base-100 font-bold tracking-tight h-12 px-4 shadow-inner font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteNameMatches) {
                    void submitDelete();
                  }
                }}
              />
            </label>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={renamingWorkspace || deletingWorkspace}>
          {lang === "ko" ? "취소" : "Cancel"}
        </Button>
        {isEdit ? (
          <Button variant="primary" disabled={!nameChanged || renamingWorkspace} onClick={() => void submitEdit()}>
            {renamingWorkspace ? <Loader2 className="w-4 h-4 animate-spin" /> : lang === "ko" ? "저장" : "Save"}
          </Button>
        ) : (
          <Button
            variant="primary"
            className="bg-error hover:bg-error/90 border-error text-error-content"
            disabled={!deleteNameMatches || deletingWorkspace}
            onClick={() => void submitDelete()}
          >
            {deletingWorkspace ? <Loader2 className="w-4 h-4 animate-spin" /> : lang === "ko" ? "삭제" : "Delete"}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
