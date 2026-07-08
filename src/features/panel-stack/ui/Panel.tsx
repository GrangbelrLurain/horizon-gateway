import clsx from "clsx";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { languageAtom } from "@/entities/app";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { getPanelIcon } from "../lib/panelIcons";
import {
  collapsedPanelsAtom,
  domainListOverlayOpenAtom,
  manualExpandedPanelsAtom,
  panelOverlayOpenAtom,
} from "../store";
import { CollapseOverlay } from "./CollapseOverlay";
import { CollapseStrip } from "./CollapseStrip";

export interface PanelProps {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onClose?: () => void;
  width?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
}

export const PANEL_WIDTH_PX = {
  sm: 280,
  md: 360,
  lg: 480,
} as const;

const WIDTH = {
  sm: "w-[280px] min-w-[240px]",
  md: "w-[360px] min-w-[300px]",
  lg: "w-[480px] min-w-[400px]",
};

export function Panel({ id, title, subtitle, icon, onClose, width = "md", children, className }: PanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [collapsedPanels, setCollapsedPanels] = useAtom(collapsedPanelsAtom);
  const [panelOverlayId, setPanelOverlayId] = useAtom(panelOverlayOpenAtom);
  const setDomainListOverlayOpen = useSetAtom(domainListOverlayOpenAtom);
  const setManualExpanded = useSetAtom(manualExpandedPanelsAtom);
  const key = id || title;
  const collapsed = collapsedPanels[key] === true;
  const overlayOpen = panelOverlayId === key;
  const panelIcon = icon ?? (id ? getPanelIcon(id) : undefined);
  const PanelIcon = panelIcon;

  useEffect(() => {
    return () => {
      setPanelOverlayId((prev) => (prev === key ? null : prev));
    };
  }, [key, setPanelOverlayId]);

  const handleOpenOverlay = () => {
    setDomainListOverlayOpen(false);
    setPanelOverlayId(key);
  };

  const handlePinExpand = () => {
    setPanelOverlayId(null);
    setCollapsedPanels((prev) => ({
      ...prev,
      [key]: false,
    }));
    setManualExpanded((prev) => new Set(prev).add(key));
  };

  const handleCloseOverlay = () => {
    setPanelOverlayId((prev) => (prev === key ? null : prev));
  };

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCollapsed = !collapsed;
    setCollapsedPanels((prev) => ({
      ...prev,
      [key]: nextCollapsed,
    }));
    setManualExpanded((prev) => {
      const next = new Set(prev);
      if (nextCollapsed) {
        next.delete(key);
        setPanelOverlayId((overlay) => (overlay === key ? null : overlay));
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderExpanded = (options: { overlay?: boolean }) => (
    <div
      className={clsx(
        "flex flex-col h-full border-r border-base-300 bg-base-100 shrink-0 overflow-hidden",
        options.overlay ? "w-full" : WIDTH[width],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-base-300 bg-base-100/80 shrink-0">
        <div className="flex items-start gap-2 min-w-0">
          {PanelIcon && (
            <div className="w-7 h-7 rounded-lg bg-base-200 flex items-center justify-center text-base-content/50 shrink-0 mt-0.5">
              <PanelIcon className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-black text-base-content truncate">{title}</h2>
            {subtitle && <p className="text-[10px] text-base-content/50 truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {options.overlay ? (
            <button
              type="button"
              onClick={handleCloseOverlay}
              className="p-1 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleToggleCollapse}
                className="p-1 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors"
                title="Collapse panel"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">{children}</div>
    </div>
  );

  if (collapsed) {
    return (
      <>
        <CollapseStrip
          title={title}
          icon={panelIcon}
          onPinExpand={handlePinExpand}
          onOverlay={handleOpenOverlay}
          pinExpandLabel={t.sidebarPinExpand}
          className={className}
        />
        <CollapseOverlay
          open={overlayOpen}
          onClose={handleCloseOverlay}
          widthPx={PANEL_WIDTH_PX[width]}
          ariaLabel={title}
        >
          {renderExpanded({ overlay: true })}
        </CollapseOverlay>
      </>
    );
  }

  return renderExpanded({});
}
