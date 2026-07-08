import { commands, unwrap } from "@/shared/api";

export type PopupWindowId = "infrastructure" | "settings" | "tools" | "add-domain" | "groups" | "mobile";

const POPUP_CONFIG: Record<PopupWindowId, { url: string; title: string; width: number; height: number }> = {
  infrastructure: { url: "/popup/infrastructure", title: "Infrastructure", width: 520, height: 680 },
  settings: { url: "/popup/settings", title: "Settings", width: 720, height: 820 },
  tools: { url: "/popup/tools", title: "Tools", width: 480, height: 560 },
  "add-domain": { url: "/popup/add-domain", title: "Add Domain", width: 480, height: 520 },
  groups: { url: "/popup/groups", title: "Manage Groups", width: 640, height: 600 },
  mobile: { url: "/popup/mobile", title: "Mobile Connection", width: 560, height: 720 },
};

export async function openPopupWindow(id: PopupWindowId): Promise<void> {
  const config = POPUP_CONFIG[id];
  const label = `popup-${id}`;
  unwrap(await commands.openWindow(label, config.title, config.url, config.width, config.height));
}
