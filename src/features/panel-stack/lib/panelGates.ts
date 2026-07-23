import type { DomainFeatureState } from "@/entities/domain";
import type { PanelId } from "../types";

export function canOpenPanel(panelId: PanelId, features: DomainFeatureState): boolean {
  if (panelId === "debug") {
    return true;
  }
  if (panelId === "monitor") {
    // Always openable so users can enable/configure like the proxy panel.
    return true;
  }
  if (panelId === "proxy") {
    return true;
  }
  // Mocking is independent of API logging.
  if (panelId === "api/mocking") {
    return true;
  }
  if (panelId === "api" || panelId.startsWith("api/")) {
    return features.apiLoggingEnabled === true;
  }
  return true;
}
