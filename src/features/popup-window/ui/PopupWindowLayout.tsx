import { useRouterState } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { languageAtom } from "@/entities/app";
import { useIsPopupWindow } from "@/shared/lib/tauri/useEmbedMode";
import { popupEn } from "../i18n/en";
import { popupKo } from "../i18n/ko";
import { PopupShell } from "./PopupShell";

const POPUP_PAGE_META: Record<
  string,
  { titleKey: keyof typeof popupEn; accent: "indigo" | "emerald" | "amber" | "rose" }
> = {};

interface PopupWindowLayoutProps {
  children: ReactNode;
}

export function PopupWindowLayout({ children }: PopupWindowLayoutProps) {
  const isPopup = useIsPopupWindow();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;

  if (!isPopup) {
    return <>{children}</>;
  }

  if (pathname.startsWith("/popup/")) {
    return <>{children}</>;
  }

  const base = pathname.replace(/\/$/, "") || pathname;
  const meta = POPUP_PAGE_META[base] ?? { titleKey: "detachedDefault" as const, accent: "indigo" as const };

  return (
    <PopupShell title={t[meta.titleKey]} accent={meta.accent} fullWidth>
      <div className="h-full min-h-0 overflow-y-auto p-4">{children}</div>
    </PopupShell>
  );
}
