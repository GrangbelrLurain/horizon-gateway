import type { LucideIcon } from "lucide-react";
import { Activity, Bug, FileJson, FileText, LayoutDashboard, ListChecks, ScrollText, Server, Wifi } from "lucide-react";
import type { PanelId } from "../types";

export const PANEL_ICONS: Record<PanelId, LucideIcon> = {
  overview: LayoutDashboard,
  monitor: Activity,
  proxy: Server,
  api: Wifi,
  "api/logs": ScrollText,
  "api/log": FileText,
  "api/mocking": ListChecks,
  "api/schema": FileJson,
  debug: Bug,
};

export function getPanelIcon(id: string): LucideIcon | undefined {
  return PANEL_ICONS[id as PanelId];
}
