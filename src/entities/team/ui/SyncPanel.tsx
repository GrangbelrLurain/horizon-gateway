import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { TeamWorkspaceController } from "../model/useTeamWorkspace";
import { DEFAULT_SYNC_OPTIONS } from "../sync";
import { buildCatalogCountsFromSnapshot, loadSyncSnapshot, SYNC_CATALOG_KINDS, type SyncSnapshot } from "../syncDiff";
import type { ResourceKind } from "../types";
import { SyncActionBar } from "./SyncActionBar";
import { emptyCatalogCounts, type SyncCatalogCounts, SyncCatalogPane } from "./SyncCatalogPane";
import { SyncDiffListPane } from "./SyncDiffListPane";

interface SyncPanelProps {
  ctrl: TeamWorkspaceController;
  onClose: () => void;
}

export function SyncPanel({ ctrl, onClose }: SyncPanelProps) {
  const { lang, activeWorkspaceId, syncing, handleExecuteSync } = ctrl;
  const [activeKind, setActiveKind] = useState<ResourceKind>("domains");
  const [syncAction, setSyncAction] = useState<"push" | "pull">("push");
  const [catalogCounts, setCatalogCounts] = useState<Partial<Record<ResourceKind, SyncCatalogCounts>>>({});
  const [snapshot, setSnapshot] = useState<SyncSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const handleCountsChange = useCallback((kind: ResourceKind, counts: SyncCatalogCounts) => {
    setCatalogCounts((prev) => ({ ...prev, [kind]: counts }));
  }, []);

  const reloadSnapshot = useCallback(async () => {
    if (!activeWorkspaceId) {
      setSnapshot(null);
      return;
    }
    setSnapshotLoading(true);
    try {
      const next = await loadSyncSnapshot(activeWorkspaceId);
      setSnapshot(next);
      setCatalogCounts(buildCatalogCountsFromSnapshot(next, DEFAULT_SYNC_OPTIONS.matchKey));
    } catch (e) {
      console.warn("SyncPanel loadSyncSnapshot:", e);
      setSnapshot(null);
      setCatalogCounts(Object.fromEntries(SYNC_CATALOG_KINDS.map((kind) => [kind, emptyCatalogCounts(kind)])));
    } finally {
      setSnapshotLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    void reloadSnapshot();
  }, [reloadSnapshot, refreshToken]);

  const handleSync = async (options: Parameters<typeof handleExecuteSync>[1]) => {
    const ok = await handleExecuteSync(syncAction, options, { stayOpen: true });
    if (ok) {
      setRefreshToken((t) => t + 1);
    }
  };

  if (!activeWorkspaceId) {
    return null;
  }

  return (
    <div className="flex flex-col h-full min-h-0 shrink-0 flex-1 min-w-[680px] max-w-[920px] border-r border-base-300 bg-base-100">
      <div className="flex items-center gap-2 h-10 px-3 border-b border-base-300 bg-base-200/80 shrink-0">
        <span className="text-primary shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${snapshotLoading || syncing !== null ? "animate-spin" : ""}`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-base-content truncate">
            {lang === "ko" ? "설정 동기화" : "Settings sync"}
          </p>
          <p className="text-[10px] text-base-content/45 font-medium truncate">
            {lang === "ko" ? "카테고리 → Push/Pull → 항목 선택" : "Category → Push/Pull → select items"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-bold px-2 py-1 rounded-md text-base-content/50 hover:text-base-content hover:bg-base-200"
        >
          {lang === "ko" ? "닫기" : "Close"}
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <SyncCatalogPane
          lang={lang}
          activeKind={activeKind}
          onSelectKind={setActiveKind}
          counts={catalogCounts}
          loading={snapshotLoading || syncing !== null}
        />

        <div className="flex flex-col flex-1 min-h-0 min-w-[360px]">
          <SyncActionBar
            lang={lang}
            action={syncAction}
            onActionChange={setSyncAction}
            disabled={syncing !== null || snapshotLoading}
          />
          <SyncDiffListPane
            lang={lang}
            action={syncAction}
            kind={activeKind}
            snapshot={snapshot}
            snapshotLoading={snapshotLoading}
            busy={syncing !== null}
            onCountsChange={handleCountsChange}
            onRefresh={() => setRefreshToken((t) => t + 1)}
            onSync={(options) => void handleSync(options)}
          />
        </div>
      </div>
    </div>
  );
}
