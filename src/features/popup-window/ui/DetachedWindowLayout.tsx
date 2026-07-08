import { useRouterState } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { languageAtom } from "@/entities/app";
import { useIsDetachedWindow } from "@/shared/lib/tauri/useEmbedMode";
import { popupEn } from "../i18n/en";
import { popupKo } from "../i18n/ko";
import { PopupShell } from "./PopupShell";

const DETACHED_PATH_META: Record<
  string,
  { titleKey: keyof typeof popupEn; accent: "indigo" | "emerald" | "amber" | "rose" }
> = {
  "/apis/mocking": { titleKey: "detachedMocking", accent: "indigo" },
  "/apis/client": { titleKey: "detachedApiClient", accent: "indigo" },
  "/apis/json-schema": { titleKey: "detachedJsonSchema", accent: "indigo" },
  "/apis/schema": { titleKey: "schemaExplorerTitle", accent: "indigo" },
  "/proxy/inspector": { titleKey: "detachedInspector", accent: "emerald" },
  "/ux/live-capture": { titleKey: "detachedLiveCapture", accent: "emerald" },
  "/ux/policies": { titleKey: "detachedPolicies", accent: "emerald" },
  "/sandbox/pipeline": { titleKey: "toolsPipeline", accent: "amber" },
  "/sandbox/crypto": { titleKey: "toolsCrypto", accent: "amber" },
  "/sandbox/preview": { titleKey: "toolsPreview", accent: "amber" },
  "/server-logs": { titleKey: "toolsServerLogs", accent: "rose" },
  "/monitor/logs": { titleKey: "detachedMonitorLogs", accent: "emerald" },
  "/popup/schema-explorer": { titleKey: "schemaExplorerTitle", accent: "indigo" },
};

function resolveMeta(pathname: string) {
  const base = pathname.split("?")[0].replace(/\/$/, "") || "/";
  return DETACHED_PATH_META[base] ?? { titleKey: "detachedDefault" as const, accent: "indigo" as const };
}

interface DetachedWindowLayoutProps {
  children: ReactNode;
}

export function DetachedWindowLayout({ children }: DetachedWindowLayoutProps) {
  const isDetached = useIsDetachedWindow();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? popupKo : popupEn;

  if (!isDetached) {
    return <>{children}</>;
  }

  const meta = resolveMeta(pathname);
  const title = t[meta.titleKey];

  return (
    <PopupShell title={title} accent={meta.accent} fullWidth>
      <div className="h-full min-h-0 flex flex-col p-4">{children}</div>
    </PopupShell>
  );
}
