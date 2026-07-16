import { useVirtualizer } from "@tanstack/react-virtual";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import { atom, useAtom, useAtomValue } from "jotai";
import { ChevronRight, Gift, Sparkles, X } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { appStatusLoadedAtom, languageAtom } from "@/entities/app";
import { domainsAtom } from "@/entities/domain";
import { Button } from "@/shared/ui/button/Button";
import { type ChangelogItem, getParsedChangelog } from "./changelogData";

export const updateChangelogModalOpenAtom = atom(false);

const BADGE_COLOR: Record<ChangelogItem["changes"][number]["type"], string> = {
  added: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  changed: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  fixed: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  removed: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  deprecated: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  security: "bg-red-500/10 text-red-400 border border-red-500/20",
};

function badgeLabel(type: ChangelogItem["changes"][number]["type"], lang: string): string {
  if (lang === "ko") {
    switch (type) {
      case "added":
        return "추가";
      case "changed":
        return "변경";
      case "fixed":
        return "수정";
      case "removed":
        return "제거";
      case "deprecated":
        return "지원종료";
      case "security":
        return "보안";
      default:
        return type;
    }
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
}

const ChangelogVersionBlock = memo(function ChangelogVersionBlockComponent({
  item,
  lang,
}: {
  item: ChangelogItem;
  lang: string;
}) {
  return (
    <section className="space-y-4 pb-8">
      <div className="flex items-center gap-3 border-b border-slate-800/40 pb-2">
        <span className="text-base font-black text-slate-200">v{item.version}</span>
        {item.date && (
          <span className="text-[10px] font-bold text-slate-500 bg-slate-850 px-2 py-0.5 rounded-md border border-slate-800">
            {item.date}
          </span>
        )}
      </div>

      <div className="space-y-3 pl-1">
        {item.changes.map((change, idx) => (
          <div key={`${item.version}-${idx}`} className="flex items-start gap-3">
            <span
              className={`mt-0.5 px-2 py-0.5 rounded text-[9px] font-bold shrink-0 uppercase tracking-wider select-none ${BADGE_COLOR[change.type]}`}
            >
              {badgeLabel(change.type, lang)}
            </span>
            <div className="space-y-1 min-w-0">
              <h4 className="text-xs font-bold text-slate-200">{change.title}</h4>
              {change.description && (
                <p className="text-xs text-slate-400 leading-relaxed font-medium">{change.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

function estimateVersionHeight(item: ChangelogItem): number {
  if (!item) {
    return 100;
  }
  // header + each change row (title ± description)
  return 56 + item.changes.reduce((sum, change) => sum + (change.description ? 72 : 40), 0) + 24;
}

export function UpdateChangelogModal() {
  const [isOpen, setIsOpen] = useAtom(updateChangelogModalOpenAtom);
  const appStatusLoaded = useAtomValue(appStatusLoadedAtom);
  const lang = useAtomValue(languageAtom);
  const domains = useAtomValue(domainsAtom);

  const [currentVer, setCurrentVer] = useState("2.5.4");
  const [isAutoTriggered, setIsAutoTriggered] = useState(false);
  const [listReady, setListReady] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const list = getParsedChangelog(lang);

  useEffect(() => {
    if (!appStatusLoaded) {
      return;
    }

    const checkVersion = async () => {
      let version = "2.5.4";
      if (isTauri()) {
        try {
          version = await getVersion();
        } catch (e) {
          console.error("Failed to get version from Tauri app:", e);
        }
      }
      setCurrentVer(version);

      const lastSeen = localStorage.getItem("horizon-gateway-last-seen-version");

      if (lastSeen === null) {
        if (domains.length === 0) {
          localStorage.setItem("horizon-gateway-last-seen-version", version);
        } else {
          setIsOpen(true);
          setIsAutoTriggered(true);
        }
      } else if (lastSeen !== version) {
        setIsOpen(true);
        setIsAutoTriggered(true);
      }
    };

    void checkVersion();
  }, [appStatusLoaded, domains.length, setIsOpen]);

  useEffect(() => {
    if (!isOpen) {
      setListReady(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      setListReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  const virtualizer = useVirtualizer({
    count: listReady ? list.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateVersionHeight(list[index]),
    overscan: 4,
  });

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem("horizon-gateway-last-seen-version", currentVer);
    setIsAutoTriggered(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <div
            className="absolute inset-0"
            onClick={() => {
              if (!isAutoTriggered) {
                handleClose();
              }
            }}
          />

          <div
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-black/80 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-changelog-title"
          >
            <div className="relative flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="update-changelog-title"
                    className="text-lg font-black text-slate-100 tracking-tight flex items-center gap-2"
                  >
                    {lang === "ko" ? "업데이트 안내" : "What's New"}
                    <span className="text-[10px] font-bold py-0.5 px-2 bg-primary/10 text-primary border border-primary/20 rounded-full">
                      v{currentVer}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    {lang === "ko"
                      ? `전체 릴리스 이력 · ${list.length}개 버전`
                      : `Full release history · ${list.length} versions`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8 rounded-full border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div
              ref={parentRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 select-text [scrollbar-gutter:stable] contain-[layout_paint]"
            >
              {listReady ? (
                <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = list[virtualRow.index];
                    if (!item) {
                      return null;
                    }
                    return (
                      <div
                        key={item.version}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        className="absolute top-0 left-0 w-full"
                        style={{ transform: `translateY(${virtualRow.start}px)` }}
                      >
                        <ChangelogVersionBlock item={item} lang={lang} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-40" aria-hidden />
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 select-none">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Enjoy Horizon Gateway
              </span>
              <Button
                variant="primary"
                onClick={handleClose}
                className="font-bold h-9 px-5 rounded-xl shadow-lg shadow-primary/10 flex items-center gap-1.5"
              >
                {lang === "ko" ? "시작하기" : "Get Started"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
