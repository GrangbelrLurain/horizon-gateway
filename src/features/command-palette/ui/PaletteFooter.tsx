interface PaletteFooterProps {
  lang: "ko" | "en";
  hasSession: boolean;
}

export function PaletteFooter({ lang, hasSession }: PaletteFooterProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-base-200/40 border-t border-base-300 text-[10px] text-base-content/50">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-base-300/60 font-mono">↑↓</kbd>
          {lang === "ko" ? "탐색" : "Navigate"}
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-base-300/60 font-mono">↵</kbd>
          {lang === "ko" ? "선택" : "Select"}
        </span>
        {hasSession && (
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-base-300/60 font-mono">⌫</kbd>
            {lang === "ko" ? "이전" : "Back"}
          </span>
        )}
      </div>
      <div>
        <kbd className="px-1.5 py-0.5 rounded bg-base-300/60 font-mono">Esc</kbd> {lang === "ko" ? "닫기" : "Close"}
      </div>
    </div>
  );
}
