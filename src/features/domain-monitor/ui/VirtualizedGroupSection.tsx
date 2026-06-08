import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, Grid2X2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DomainStatusLog } from "@/shared/api";
import { Badge } from "@/shared/ui/badge/badge";
import { Card } from "@/shared/ui/card/card";

const CARD_MIN_WIDTH = 320;
const CARD_ROW_ESTIMATE = 180;
const ROW_GAP = 24;

export interface VirtualizedGroupSectionProps {
  group: string;
  apps: DomainStatusLog[];
}

export function VirtualizedGroupSection({ group, apps }: VirtualizedGroupSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);

  useEffect(() => {
    if (!parentRef.current) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const newCols = Math.max(1, Math.floor(width / (CARD_MIN_WIDTH + 16)));
        setCols(newCols);
      }
    });
    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(apps.length / cols);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_ROW_ESTIMATE + ROW_GAP,
    overscan: 3,
  });

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex items-center justify-between group/title cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
        onKeyDown={(e) => e.key === "Enter" && setIsCollapsed(!isCollapsed)}
        tabIndex={0}
        role="button"
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--p),0.4)]" />
          <h2 className="text-2xl font-black text-base-content tracking-tighter uppercase">{group}</h2>
          <Badge
            variant={{ color: "gray" }}
            className="bg-base-200 text-base-content/40 border-0 font-black uppercase tracking-widest text-[9px] px-2.5"
          >
            {apps.length} Units
          </Badge>
        </div>
        <motion.div
          animate={{ rotate: isCollapsed ? -90 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <ChevronDown className="w-6 h-6 text-base-content/10 group-hover/title:text-primary transition-colors" />
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div ref={parentRef} className="overflow-visible rounded-3xl no-scrollbar relative py-4 px-2">
              <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const start = virtualRow.index * cols;
                  const rowApps = apps.slice(start, start + cols);
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="absolute top-0 left-0 w-full pb-8"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                        {rowApps.map((app) => (
                          <Card
                            key={app.url}
                            className="group relative overflow-hidden p-6 flex flex-col gap-5 bg-base-100 border border-base-300 hover:border-primary/40 hover:shadow-2xl transition-all duration-300 rounded-[2rem] shadow-sm"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 max-w-[200px]">
                                  <Grid2X2 className="w-4 h-4 text-base-content/20 shrink-0 group-hover:text-primary transition-colors" />
                                  <span className="text-sm font-black text-base-content truncate tracking-tight">
                                    {app.url}
                                  </span>
                                  <a
                                    href={app.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-base-content/20 hover:text-primary transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 bg-base-200/50 w-fit px-2 py-0.5 rounded-md leading-none">
                                  {app.status}
                                </span>
                                {app.errorMessage && (
                                  <span
                                    className="text-[10px] italic text-error font-bold truncate max-w-[150px]"
                                    title={app.errorMessage ?? undefined}
                                  >
                                    {app.errorMessage}
                                  </span>
                                )}
                              </div>
                              <div
                                className={clsx(
                                  "w-2.5 h-2.5 rounded-full animate-pulse",
                                  app.ok
                                    ? "bg-success shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                                    : "bg-error shadow-[0_0_8px_rgba(248,113,113,0.6)]",
                                )}
                              />
                            </div>

                            <div className="flex items-end justify-between mt-auto pt-4 border-t border-base-300/30">
                              <div className="flex flex-col">
                                <span className="text-[9px] text-base-content/30 uppercase font-black tracking-[0.2em] leading-none mb-2">
                                  Latency
                                </span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-3xl font-black text-base-content tracking-tighter">
                                    {app.latency}
                                  </span>
                                  <span className="text-[10px] font-black text-base-content/20 uppercase">ms</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div
                                  className={clsx(
                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                                    app.level === "error"
                                      ? "bg-error/10 border-error/20 text-error shadow-lg shadow-error/5"
                                      : app.level === "warning"
                                        ? "bg-warning/10 border-warning/20 text-warning shadow-lg shadow-warning/5"
                                        : "bg-success/10 border-success/20 text-success shadow-lg shadow-success/5",
                                  )}
                                >
                                  {app.level}
                                </div>
                              </div>
                            </div>

                            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/5 rounded-full -z-10 group-hover:scale-150 transition-transform duration-700" />
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
