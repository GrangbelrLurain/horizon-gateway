import clsx from "clsx";
import { ChevronRight, Home, X } from "lucide-react";
import type { PanelEntry, PanelId } from "../types";

interface PanelBreadcrumbProps {
  domainLabel: string;
  panels: PanelEntry[];
  lang: "ko" | "en";
  onNavigate: (panelId: PanelId, index: number) => void;
  onClose: () => void;
  onGoHome: () => void;
}

const PANEL_LABELS: Record<PanelId, { ko: string; en: string }> = {
  overview: { ko: "개요", en: "Overview" },
  monitor: { ko: "모니터링", en: "Monitor" },
  proxy: { ko: "프록시", en: "Proxy" },
  api: { ko: "API", en: "API" },
  "api/logs": { ko: "로그", en: "Logs" },
  "api/log": { ko: "상세", en: "Detail" },
  "api/mocking": { ko: "모킹", en: "Mocking" },
  "api/schema": { ko: "스키마", en: "Schema" },
  debug: { ko: "디버그", en: "Debug" },
};

export function PanelBreadcrumb({ domainLabel, panels, lang, onNavigate, onClose, onGoHome }: PanelBreadcrumbProps) {
  if (panels.length === 0) {
    return null;
  }

  const label = (id: PanelId) => PANEL_LABELS[id][lang];

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-base-300 bg-base-100/90 shrink-0 min-h-[40px]">
      <button
        type="button"
        onClick={onGoHome}
        className="p-1.5 rounded-lg text-base-content/40 hover:text-primary hover:bg-base-200 transition-colors shrink-0"
        title={lang === "ko" ? "도메인 목록" : "Domain list"}
      >
        <Home className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => onNavigate("overview", 0)}
          className="text-[11px] font-bold text-base-content/60 hover:text-primary truncate max-w-[120px] shrink-0"
        >
          {domainLabel}
        </button>
        {panels.slice(1).map((panel, i) => (
          <div key={`${panel.id}-${i}`} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="w-3 h-3 text-base-content/25" />
            <button
              type="button"
              onClick={() => onNavigate(panel.id, i + 1)}
              className={clsx(
                "text-[11px] font-bold px-1.5 py-0.5 rounded-md transition-colors",
                i === panels.slice(1).length - 1
                  ? "text-primary bg-primary/10"
                  : "text-base-content/50 hover:text-primary",
              )}
            >
              {label(panel.id)}
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-base-content/50 hover:text-error hover:bg-error/10 transition-colors shrink-0"
        title={
          lang === "ko"
            ? panels.length > 1
              ? "패널 닫기"
              : "도메인 선택 해제"
            : panels.length > 1
              ? "Close panels"
              : "Deselect domain"
        }
      >
        <X className="w-3 h-3" />
        {lang === "ko" ? "닫기" : "Close"}
      </button>
    </div>
  );
}
