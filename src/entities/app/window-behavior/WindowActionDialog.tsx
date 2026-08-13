import { ArrowDownToLine, Minus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button/Button";
import { Modal } from "@/shared/ui/modal/Modal";
import { windowBehaviorEn, windowBehaviorKo } from "./i18n";

type CloseChoice = "hide" | "quit";
type MinimizeChoice = "taskbar" | "tray";

interface WindowActionDialogProps {
  kind: "close" | "minimize";
  lang: "ko" | "en";
  onCancel: () => void;
  onConfirm: (choice: CloseChoice | MinimizeChoice, remember: boolean) => void;
}

export function WindowActionDialog({ kind, lang, onCancel, onConfirm }: WindowActionDialogProps) {
  const t = lang === "ko" ? windowBehaviorKo : windowBehaviorEn;
  const [remember, setRemember] = useState(false);
  const [choice, setChoice] = useState<CloseChoice | MinimizeChoice>(kind === "close" ? "hide" : "taskbar");

  const options =
    kind === "close"
      ? [
          { id: "hide" as const, title: t.hideToTray, hint: t.hideToTrayHint, icon: ArrowDownToLine },
          { id: "quit" as const, title: t.quitApp, hint: t.quitAppHint, icon: X },
        ]
      : [
          { id: "taskbar" as const, title: t.minimizeToTaskbar, hint: t.minimizeToTaskbarHint, icon: Minus },
          { id: "tray" as const, title: t.hideToTray, hint: t.hideToTrayHint, icon: ArrowDownToLine },
        ];

  const confirmLabel =
    kind === "close"
      ? choice === "quit"
        ? t.quitApp
        : t.hideToTray
      : choice === "tray"
        ? t.hideToTray
        : t.minimizeToTaskbar;

  return (
    <Modal isOpen onClose={onCancel} size="sm">
      <Modal.Header
        title={kind === "close" ? t.closeTitle : t.minimizeTitle}
        description={kind === "close" ? t.closeDesc : t.minimizeDesc}
      />
      <Modal.Body className="space-y-2">
        {options.map((opt) => {
          const selected = choice === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setChoice(opt.id)}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                selected ? "border-primary bg-primary/10" : "border-base-300 bg-base-100 hover:bg-base-200/60"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {opt.title}
              </span>
              <span className="block text-[11px] text-base-content/50 mt-0.5 leading-snug">{opt.hint}</span>
            </button>
          );
        })}
        <label className="flex items-center gap-2 pt-1 text-xs font-medium text-base-content/70 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-sm checkbox-primary"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          {t.remember}
        </label>
      </Modal.Body>
      <Modal.Footer>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button size="sm" variant="primary" onClick={() => onConfirm(choice, remember)}>
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
