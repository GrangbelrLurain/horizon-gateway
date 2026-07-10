import clsx from "clsx";
import { Download, FolderOpen, X } from "lucide-react";
import { Button } from "@/shared/ui/button/Button";

export interface ApiLogsBulkExportBarLabels {
  selected: (count: number) => string;
  selectAll: string;
  clearSelection: string;
  downloadHtml: string;
  openFolder?: string;
  downloadComplete?: string;
}

interface ApiLogsBulkExportBarProps {
  selectedCount: number;
  totalCount: number;
  labels: ApiLogsBulkExportBarLabels;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDownloadHtml: () => void;
  lastSavedPath?: string | null;
  onOpenFolder?: () => void;
  className?: string;
}

export function ApiLogsBulkExportBar({
  selectedCount,
  totalCount,
  labels,
  onSelectAll,
  onClearSelection,
  onDownloadHtml,
  lastSavedPath,
  onOpenFolder,
  className,
}: ApiLogsBulkExportBarProps) {
  if (selectedCount === 0 && !lastSavedPath) {
    return null;
  }

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-primary/10 border border-primary/25 rounded-xl shrink-0",
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        {selectedCount > 0 ? (
          <>
            <span className="text-xs font-bold text-primary">{labels.selected(selectedCount)}</span>
            {selectedCount < totalCount && (
              <>
                <span className="text-base-content/20">·</span>
                <button
                  type="button"
                  className="text-[11px] font-bold text-primary hover:underline"
                  onClick={onSelectAll}
                >
                  {labels.selectAll}
                </button>
              </>
            )}
            <span className="text-base-content/20">·</span>
            <button
              type="button"
              className="text-[11px] font-bold text-base-content/50 hover:underline inline-flex items-center gap-1"
              onClick={onClearSelection}
            >
              <X className="w-3 h-3" />
              {labels.clearSelection}
            </button>
          </>
        ) : (
          <span className="text-xs font-bold text-success">{labels.downloadComplete}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {lastSavedPath && onOpenFolder && labels.openFolder && (
          <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs font-bold" onClick={onOpenFolder}>
            <FolderOpen className="w-3.5 h-3.5" />
            {labels.openFolder}
          </Button>
        )}
        {selectedCount > 0 && (
          <Button variant="primary" size="sm" className="h-8 gap-1.5 text-xs font-bold" onClick={onDownloadHtml}>
            <Download className="w-3.5 h-3.5" />
            {labels.downloadHtml}
          </Button>
        )}
      </div>
    </div>
  );
}
